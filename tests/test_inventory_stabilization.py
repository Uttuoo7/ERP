import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from backend import models, database
from backend.services.inventory_service import InventoryService
from tests.factories.entity_factories import UserFactory, ItemFactory, WarehouseFactory
from backend.inventory_engine import record_receipt
from tests.fixtures.auth import auth_headers

pytestmark = pytest.mark.inventory

@pytest.fixture
def test_admin(db_session):
    return UserFactory.create(db_session, role=models.Role.ADMIN)

@pytest.fixture
def test_item(db_session):
    return ItemFactory.create(db_session, unit_price=Decimal("20.00"), standard_rate=Decimal("20.00"), category="Raw Component")

@pytest.fixture
def test_warehouse(db_session):
    return WarehouseFactory.create(db_session)

# ─── RBAC Endpoint Access Tests ───────────────────────────────────────────────

class TestInventoryRbacHardening:
    def test_propose_revaluation_rbac(self, client, test_item, admin_headers, finance_headers, finance_manager_headers, buyer_headers, warehouse_headers):
        payload = {
            "item_id": str(test_item.id),
            "new_cost": 25.00,
            "reason": "Test propose RBAC"
        }
        
        # Allowed roles: ADMIN, SUPER_ADMIN, FINANCE_MANAGER, FINANCE
        for headers in [admin_headers, finance_headers, finance_manager_headers]:
            res = client.post("/api/inventory/revaluations", json=payload, headers=headers)
            assert res.status_code == 200, f"Expected 200 for allowed role, got {res.status_code}"

        # Disallowed roles: BUYER, WAREHOUSE
        for headers in [buyer_headers, warehouse_headers]:
            res = client.post("/api/inventory/revaluations", json=payload, headers=headers)
            assert res.status_code == 403, f"Expected 403 for disallowed role, got {res.status_code}"

    def test_submit_revaluation_rbac(self, client, db_session, test_item, admin_headers, finance_headers, finance_manager_headers, buyer_headers, warehouse_headers):
        # Create a proposed revaluation draft
        reval = InventoryService.propose_revaluation(
            db=db_session,
            item_id=test_item.id,
            new_cost=25.00,
            reason="Market standard rate update",
            tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
        )
        # Ensure it is committed/flushed in db_session
        db_session.commit()

        # Disallowed roles: BUYER, WAREHOUSE
        for headers in [buyer_headers, warehouse_headers]:
            res = client.post(f"/api/inventory/revaluations/{reval.id}/submit", headers=headers)
            assert res.status_code == 403, f"Expected 403 for disallowed role, got {res.status_code}"

        # Allowed roles: ADMIN, SUPER_ADMIN, FINANCE_MANAGER, FINANCE
        # The last one will succeed and change status to SUBMITTED
        res = client.post(f"/api/inventory/revaluations/{reval.id}/submit", headers=finance_manager_headers)
        assert res.status_code == 200, f"Expected 200 for allowed role submit, got {res.status_code}"

    def test_generate_snapshot_rbac(self, client, admin_headers, finance_manager_headers, finance_headers, buyer_headers):
        payload = {
            "snapshot_date": "2026-06-10T12:00:00"
        }
        
        # Custom warehouse manager headers since default warehouse_headers is role WAREHOUSE
        wh_manager_headers = auth_headers(role="WAREHOUSE_MANAGER")

        # Allowed roles: ADMIN, SUPER_ADMIN, FINANCE_MANAGER, WAREHOUSE_MANAGER
        for headers in [admin_headers, finance_manager_headers, wh_manager_headers]:
            res = client.post("/api/inventory/snapshots", json=payload, headers=headers)
            assert res.status_code == 200, f"Expected 200 for allowed role snapshot, got {res.status_code}"

        # Disallowed roles: FINANCE, BUYER
        for headers in [finance_headers, buyer_headers]:
            res = client.post("/api/inventory/snapshots", json=payload, headers=headers)
            assert res.status_code == 403, f"Expected 403 for disallowed role snapshot, got {res.status_code}"


# ─── Revaluation Approval Transaction Persistence ───────────────────────────────

class TestRevaluationApprovalPersistence:
    def test_approve_revaluation_atomic_persistence(self, db_session, test_admin, test_item, test_warehouse):
        # Seed active Fiscal Year and an open Accounting Period
        today = datetime.utcnow()
        fy_name = f"FY {today.year}"
        fy = db_session.query(models.FiscalYear).filter_by(name=fy_name).first()
        if not fy:
            fy = models.FiscalYear(
                id=uuid.uuid4(),
                name=fy_name,
                start_date=today - timedelta(days=180),
                end_date=today + timedelta(days=180),
                status="OPEN",
                tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
            )
            db_session.add(fy)
            db_session.flush()

        period_name = today.strftime("%Y-%m")
        current_period = db_session.query(models.AccountingPeriod).filter_by(period_name=period_name).first()
        if not current_period:
            current_period = models.AccountingPeriod(
                id=uuid.uuid4(),
                period_name=period_name,
                start_date=today - timedelta(days=15),
                end_date=today + timedelta(days=15),
                status="OPEN",
                fiscal_year_id=fy.id,
                tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
            )
            db_session.add(current_period)
            db_session.flush()

        # 1. Setup inventory ledger cost configs
        config = db_session.query(models.TenantConfig).first()
        if not config:
            config = models.TenantConfig(
                tenant_uuid=models.SYSTEM_DEFAULT_TENANT_UUID,
                inventory_costing_method="STANDARD",
                allow_negative_inventory=False
            )
            db_session.add(config)
        else:
            config.inventory_costing_method = "STANDARD"
        db_session.commit()

        # Seed double entry posting configs for variance & offset accounts
        cogs_account = db_session.query(models.Account).filter_by(code="5000").first()
        if not cogs_account:
            cogs_account = models.Account(
                id=uuid.uuid4(),
                code="5000",
                name="Cost of Goods Sold",
                account_type="EXPENSE",
                tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
            )
            db_session.add(cogs_account)
        
        inv_account = db_session.query(models.Account).filter_by(code="1200").first()
        if not inv_account:
            inv_account = models.Account(
                id=uuid.uuid4(),
                code="1200",
                name="Inventory Accrual",
                account_type="ASSET",
                tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
            )
            db_session.add(inv_account)
        db_session.flush()

        # Check mapping for INVENTORY_RECEIPT
        cfg = db_session.query(models.PostingConfiguration).filter_by(event_key="INVENTORY_RECEIPT").first()
        if not cfg:
            cfg = models.PostingConfiguration(
                id=uuid.uuid4(),
                event_key="INVENTORY_RECEIPT",
                account_id=inv_account.id,
                tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
            )
            db_session.add(cfg)
        db_session.commit()

        # Record receipt to create initial cost layers
        record_receipt(
            db=db_session,
            item_id=test_item.id,
            warehouse_id=test_warehouse.id,
            qty=10,
            unit_cost=Decimal("20.00"),
            reference_type="MANUAL",
            user_id=test_admin.id
        )
        db_session.commit()

        # 2. Propose revaluation
        reval = InventoryService.propose_revaluation(
            db=db_session,
            item_id=test_item.id,
            new_cost=25.00,
            reason="Market standard rate update",
            tenant_id=models.SYSTEM_DEFAULT_TENANT_UUID
        )
        
        # Submit revaluation
        reval = InventoryService.submit_revaluation(db_session, reval.id)
        assert reval.status == "SUBMITTED"

        # 3. Approve revaluation (which triggers updating layers, valuation entry, GL postings, and atomic commit)
        approved_reval = InventoryService.approve_revaluation(
            db=db_session,
            reval_id=reval.id,
            user_id=test_admin.id
        )
        assert approved_reval.status == "APPROVED"

        # 4. Verify in-session updates
        # Verify standard costing update on item
        db_session.refresh(test_item)
        assert test_item.standard_rate == Decimal("25.00")

        # Verify cost layers updated
        layers = db_session.query(models.InventoryCostLayer).filter_by(item_id=test_item.id).all()
        assert len(layers) == 1
        assert layers[0].unit_cost == Decimal("25.00")

        # Verify GL journal entries are posted
        je = db_session.query(models.JournalEntry).filter_by(reference_id=reval.id).first()
        assert je is not None
        assert je.status == "POSTED"

        lines = db_session.query(models.JournalLine).filter_by(journal_entry_id=je.id).all()
        assert len(lines) == 2
        # Debits sum equals Credits sum
        debits = sum(line.debit_amount for line in lines)
        credits = sum(line.credit_amount for line in lines)
        assert debits == credits
        assert debits == Decimal("50.00") # (25.00 - 20.00) * 10 qty

        # 5. Verify persistence in a completely separate database session bound to the same connection
        new_session = Session(bind=db_session.connection())
        try:
            persisted_reval = new_session.query(models.InventoryRevaluation).filter_by(id=reval.id).first()
            assert persisted_reval is not None
            assert persisted_reval.status == "APPROVED"

            persisted_item = new_session.query(models.Item).filter_by(id=test_item.id).first()
            assert persisted_item.standard_rate == Decimal("25.00")

            persisted_layer = new_session.query(models.InventoryCostLayer).filter_by(item_id=test_item.id).first()
            assert persisted_layer.unit_cost == Decimal("25.00")

            persisted_je = new_session.query(models.JournalEntry).filter_by(reference_id=reval.id).first()
            assert persisted_je is not None
        finally:
            new_session.close()


# ─── Database Indexes Verification ───────────────────────────────────────────

class TestDatabaseIndexes:
    def test_created_at_indexes_exist(self, db_session):
        inspector = inspect(db_session.bind)
        
        # Verify index exists on inventory_cost_layers
        layers_indexes = inspector.get_indexes('inventory_cost_layers')
        assert any(idx['name'] == 'ix_inventory_cost_layers_created_at' for idx in layers_indexes), \
            "ix_inventory_cost_layers_created_at index does not exist in schema"
            
        # Verify index exists on inventory_valuation_entries
        val_indexes = inspector.get_indexes('inventory_valuation_entries')
        assert any(idx['name'] == 'ix_inventory_valuation_entries_created_at' for idx in val_indexes), \
            "ix_inventory_valuation_entries_created_at index does not exist in schema"
