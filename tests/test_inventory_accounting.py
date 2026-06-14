import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from tests.factories.entity_factories import (
    UserFactory, VendorFactory, ItemFactory, WarehouseFactory, DepartmentFactory
)
from backend import models, inventory_engine
from backend.services.inventory_service import InventoryService
from backend.services.posting_engine import PostingEngine
from backend.services.accounting_service import AccountingService
from backend.services.ledger_service import LedgerService
from backend.services.inventory_reporting_service import InventoryReportingService

pytestmark = pytest.mark.inventory

import jwt

def register_mock_user(db, headers, role="ADMIN"):
    token = headers["Authorization"].split(" ")[1]
    payload = jwt.decode(token, options={"verify_signature": False})
    user_id = uuid.UUID(payload["sub"])
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        user = UserFactory.create(db, id=user_id, role=role)
        db.commit()
    return user

# ─── Seeding Helpers ─────────────────────────────────────────────────────────

def seed_accounting_data(db_session):
    """Seed accounts, fiscal years, periods, and posting configurations."""
    accounts_data = [
        {"code": "1000", "name": "Bank / Cash Account", "account_type": "ASSET"},
        {"code": "1200", "name": "Inventory Control Account", "account_type": "ASSET"},
        {"code": "1250", "name": "Inventory In Transit Account", "account_type": "ASSET"},
        {"code": "1300", "name": "GST Input Receivable Account", "account_type": "ASSET"},
        {"code": "2000", "name": "Accounts Payable Control Account", "account_type": "LIABILITY"},
        {"code": "2100", "name": "GRNI Control Account (Accrual)", "account_type": "LIABILITY"},
        {"code": "2200", "name": "TDS Payable Control Account", "account_type": "LIABILITY"},
        {"code": "5000", "name": "Cost of Goods Sold Account", "account_type": "EXPENSE"},
        {"code": "5100", "name": "Inventory Loss / Scrap Account", "account_type": "EXPENSE"},
    ]
    accounts_by_code = {}
    for data in accounts_data:
        acc = db_session.query(models.Account).filter_by(code=data["code"]).first()
        if not acc:
            acc = models.Account(
                code=data["code"],
                name=data["name"],
                account_type=data["account_type"],
                is_active=True
            )
            db_session.add(acc)
            db_session.flush()
        accounts_by_code[data["code"]] = acc

    today = datetime.utcnow()
    fy_name = f"FY {today.year}"
    fy = db_session.query(models.FiscalYear).filter_by(name=fy_name).first()
    if not fy:
        fy = models.FiscalYear(
            name=fy_name,
            start_date=today - timedelta(days=180),
            end_date=today + timedelta(days=180),
            status="OPEN"
        )
        db_session.add(fy)
        db_session.flush()

    period_name = today.strftime("%Y-%m")
    current_period = db_session.query(models.AccountingPeriod).filter_by(period_name=period_name).first()
    if not current_period:
        current_period = models.AccountingPeriod(
            period_name=period_name,
            start_date=today - timedelta(days=15),
            end_date=today + timedelta(days=15),
            status="OPEN",
            fiscal_year_id=fy.id
        )
        db_session.add(current_period)
        db_session.flush()

    configs = [
        {"event_key": "INVENTORY_RECEIPT", "account_code": "1200"},
        {"event_key": "GRNI_ACCRUAL", "account_code": "2100"},
        {"event_key": "GST_RECEIVABLE", "account_code": "1300"},
        {"event_key": "TDS_PAYABLE", "account_code": "2200"},
        {"event_key": "AP_CONTROL", "account_code": "2000"},
        {"event_key": "BANK_CONTROL", "account_code": "1000"},
        {"event_key": "INVENTORY_CONTROL", "account_code": "1200"},
        {"event_key": "INVENTORY_IN_TRANSIT", "account_code": "1250"},
        {"event_key": "COGS_CONTROL", "account_code": "5000"},
        {"event_key": "SCRAP_EXPENSE", "account_code": "5100"},
    ]
    for cfg in configs:
        exists = db_session.query(models.PostingConfiguration).filter_by(event_key=cfg["event_key"]).first()
        if not exists:
            p_cfg = models.PostingConfiguration(
                event_key=cfg["event_key"],
                account_id=accounts_by_code[cfg["account_code"]].id
            )
            db_session.add(p_cfg)
            
    db_session.flush()
    db_session.commit()
    return accounts_by_code, current_period

@pytest.fixture
def setup_accounting_context(db_session):
    accounts, period = seed_accounting_data(db_session)
    PostingEngine.register_listeners(force=True)
    tenant_id = models.SYSTEM_DEFAULT_TENANT_UUID
    
    # Configure TenantConfig
    config = db_session.query(models.TenantConfig).filter_by(tenant_uuid=tenant_id).first()
    if not config:
        config = models.TenantConfig(
            tenant_uuid=tenant_id,
            inventory_control_account_id=accounts["1200"].id,
            inventory_adjustment_gain_account_id=accounts["5000"].id,
            inventory_adjustment_loss_account_id=accounts["5100"].id,
            inventory_variance_account_id=accounts["5000"].id,
            inventory_costing_method="FIFO",
            allow_negative_inventory=False
        )
        db_session.add(config)
    else:
        config.inventory_control_account_id = accounts["1200"].id
        config.inventory_adjustment_gain_account_id = accounts["5000"].id
        config.inventory_adjustment_loss_account_id = accounts["5100"].id
        config.inventory_variance_account_id = accounts["5000"].id
    
    db_session.commit()
    return {
        "db": db_session,
        "tenant_id": tenant_id,
        "accounts": accounts,
        "config": config,
        "period": period
    }

# ─── Tests ───────────────────────────────────────────────────────────────────

class TestInventoryAccounting:

    def test_fifo_material_issue_accounting(self, setup_accounting_context, client, admin_headers):
        """1. Verify FIFO material issue workflow, layer deduction, and G/L postings."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        item = ItemFactory.create(db, sku="FIFO-ISS-SKU", name="FIFO Issue Item", standard_rate=Decimal("10.00"))
        warehouse = WarehouseFactory.create(db)
        user = register_mock_user(db, admin_headers)

        # Create inventory receipts: 10 units @ 15.00
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=10, unit_cost=Decimal("15.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        # Call API to create issue draft
        payload = {
            "warehouse_id": str(warehouse.id),
            "issue_date": datetime.utcnow().isoformat(),
            "issue_type": "ISSUE",
            "remarks": "FIFO consumption test",
            "line_items": [
                {"item_id": str(item.id), "quantity": 4.0}
            ]
        }
        res = client.post("/api/inventory/issues", json=payload, headers=admin_headers)
        assert res.status_code == 200, f"Failed: {res.status_code} - {res.text}"
        issue_id = res.json()["id"]

        # Submit
        res = client.post(f"/api/inventory/issues/{issue_id}/submit", headers=admin_headers)
        assert res.status_code == 200, f"Failed submit: {res.status_code} - {res.text}"
        assert res.json()["status"] == "SUBMITTED"

        # Approve (deducts layer)
        res = client.post(f"/api/inventory/issues/{issue_id}/approve", headers=admin_headers)
        assert res.status_code == 200, f"Failed approve: {res.status_code} - {res.text}"
        assert res.json()["status"] == "APPROVED"

        # Verify WarehouseStock is reduced to 6
        stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
        assert stock.quantity_on_hand == 6

        # Post (posts to GL)
        res = client.post(f"/api/inventory/issues/{issue_id}/post", headers=admin_headers)
        assert res.status_code == 200, f"Failed post: {res.status_code} - {res.text}"
        assert res.json()["status"] == "POSTED"

        # Verify G/L Journal entry
        je = db.query(models.JournalEntry).filter_by(reference_type="ISSUE", reference_id=issue_id).first()
        assert je is not None
        assert je.status == "POSTED"

        # Check balanced posting: Debit COGS (5000) for 60.00 (4 qty * 15.00), Credit Inventory Control (1200) for 60.00
        lines = je.journal_lines
        assert len(lines) == 2
        debits = sum(l.debit_amount for l in lines)
        credits = sum(l.credit_amount for l in lines)
        assert debits == credits == Decimal("60.00")

        cogs_line = [l for l in lines if l.account.code == "5000"][0]
        inv_line = [l for l in lines if l.account.code == "1200"][0]
        assert cogs_line.debit_amount == Decimal("60.00")
        assert inv_line.credit_amount == Decimal("60.00")

        tb = LedgerService.get_trial_balance(db)
        assert tb["is_balanced"] is True


    def test_wac_material_issue_accounting(self, setup_accounting_context, client, admin_headers):
        """2. Verify WAC material issue moving average valuation and GL postings."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "WAC"
        db.commit()

        item = ItemFactory.create(db, sku="WAC-ISS-SKU", name="WAC Issue Item", standard_rate=Decimal("10.00"))
        warehouse = WarehouseFactory.create(db)
        user = register_mock_user(db, admin_headers)

        # Seed initial WarehouseStock
        stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
        if not stock:
            stock = models.WarehouseStock(
                warehouse_id=warehouse.id, item_id=item.id, quantity_on_hand=0, valuation_unit_cost=Decimal("0.00"), tenant_id=tenant_id
            )
            db.add(stock)
            db.flush()

        # Receipt 1: 10 units @ 10.00
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=10, unit_cost=Decimal("10.00"), reference_type="MANUAL", user_id=user.id
        )
        # Receipt 2: 10 units @ 20.00
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=10, unit_cost=Decimal("20.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        # Moving average = (10*10 + 10*20) / 20 = 15.00
        db.refresh(stock)
        assert stock.valuation_unit_cost == Decimal("15.00")

        # Create issue draft for 10 units
        payload = {
            "warehouse_id": str(warehouse.id),
            "issue_date": datetime.utcnow().isoformat(),
            "issue_type": "ISSUE",
            "remarks": "WAC consumption test",
            "line_items": [
                {"item_id": str(item.id), "quantity": 10.0}
            ]
        }
        res = client.post("/api/inventory/issues", json=payload, headers=admin_headers)
        assert res.status_code == 200, f"Failed create issue: {res.status_code} - {res.text}"
        issue_id = res.json()["id"]

        client.post(f"/api/inventory/issues/{issue_id}/submit", headers=admin_headers)
        client.post(f"/api/inventory/issues/{issue_id}/approve", headers=admin_headers)
        client.post(f"/api/inventory/issues/{issue_id}/post", headers=admin_headers)

        # Verify G/L Journal entry: Debit COGS (5000) for 150.00 (10 qty * 15.00), Credit Inventory Control (1200) for 150.00
        je = db.query(models.JournalEntry).filter_by(reference_type="ISSUE", reference_id=issue_id).first()
        assert je is not None
        lines = je.journal_lines
        debits = sum(l.debit_amount for l in lines)
        credits = sum(l.credit_amount for l in lines)
        assert debits == credits == Decimal("150.00")


    def test_standard_cost_accounting(self, setup_accounting_context, client, admin_headers):
        """3. Verify standard cost valuation and GL postings."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "STANDARD"
        db.commit()

        # Create item with standard rate of 12.00
        item = ItemFactory.create(db, sku="STD-ISS-SKU", name="Standard Issue Item", standard_rate=Decimal("12.00"))
        warehouse = WarehouseFactory.create(db)
        user = register_mock_user(db, admin_headers)

        # Receipt: 10 units @ 15.00 actual cost (valued at standard rate 12.00)
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=10, unit_cost=Decimal("15.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        # Create issue draft for 5 units
        payload = {
            "warehouse_id": str(warehouse.id),
            "issue_date": datetime.utcnow().isoformat(),
            "issue_type": "ISSUE",
            "remarks": "Standard cost consumption test",
            "line_items": [
                {"item_id": str(item.id), "quantity": 5.0}
            ]
        }
        res = client.post("/api/inventory/issues", json=payload, headers=admin_headers)
        assert res.status_code == 200, f"Failed create issue: {res.status_code} - {res.text}"
        issue_id = res.json()["id"]

        client.post(f"/api/inventory/issues/{issue_id}/submit", headers=admin_headers)
        client.post(f"/api/inventory/issues/{issue_id}/approve", headers=admin_headers)
        client.post(f"/api/inventory/issues/{issue_id}/post", headers=admin_headers)

        # Verify G/L Journal entry: Debit COGS (5000) for 60.00 (5 qty * 12.00 standard cost), Credit Inventory Control (1200) for 60.00
        je = db.query(models.JournalEntry).filter_by(reference_type="ISSUE", reference_id=issue_id).first()
        assert je is not None
        lines = je.journal_lines
        debits = sum(l.debit_amount for l in lines)
        credits = sum(l.credit_amount for l in lines)
        assert debits == credits == Decimal("60.00")


    def test_material_return_accounting(self, setup_accounting_context, client, admin_headers):
        """4. Verify material return workflow, layer restoration, and reversing GL postings."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        item = ItemFactory.create(db, sku="RET-SKU", name="Return Item", standard_rate=Decimal("20.00"))
        warehouse = WarehouseFactory.create(db)
        user = register_mock_user(db, admin_headers)

        # Create receipt: 10 units @ 20.00
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=10, unit_cost=Decimal("20.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        # Issue 5 units @ 20.00
        inventory_engine.deduct_stock(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=Decimal("5"), reference_type="MANUAL", reference_id=uuid.uuid4(), user_id=user.id
        )
        db.commit()

        # Return 2 units @ 20.00
        payload = {
            "warehouse_id": str(warehouse.id),
            "issue_date": datetime.utcnow().isoformat(),
            "issue_type": "RETURN",
            "remarks": "Return test",
            "line_items": [
                {"item_id": str(item.id), "quantity": 2.0}
            ]
        }
        res = client.post("/api/inventory/returns", json=payload, headers=admin_headers)
        assert res.status_code == 200, f"Failed create return: {res.status_code} - {res.text}"
        return_id = res.json()["id"]

        # Submit, approve, post
        client.post(f"/api/inventory/issues/{return_id}/submit", headers=admin_headers)
        client.post(f"/api/inventory/issues/{return_id}/approve", headers=admin_headers)
        client.post(f"/api/inventory/issues/{return_id}/post", headers=admin_headers)

        # Verify WarehouseStock is increased to 7 (10 - 5 + 2)
        stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
        assert stock.quantity_on_hand == 7

        # Verify G/L Journal entry: Debit Inventory Control (1200) for 40.00, Credit COGS (5000) for 40.00
        je = db.query(models.JournalEntry).filter_by(reference_type="ISSUE", reference_id=return_id).first()
        assert je is not None
        lines = je.journal_lines
        debits = sum(l.debit_amount for l in lines)
        credits = sum(l.credit_amount for l in lines)
        assert debits == credits == Decimal("40.00")

        inv_line = [l for l in lines if l.account.code == "1200"][0]
        cogs_line = [l for l in lines if l.account.code == "5000"][0]
        assert inv_line.debit_amount == Decimal("40.00")
        assert cogs_line.credit_amount == Decimal("40.00")


    def test_scrap_accounting(self, setup_accounting_context, client, admin_headers):
        """5. Verify scrap workflow, stock deduction, and debiting scrap expense (5100)."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        item = ItemFactory.create(db, sku="SCRAP-SKU", name="Scrap Item", standard_rate=Decimal("10.00"))
        warehouse = WarehouseFactory.create(db)
        user = register_mock_user(db, admin_headers)

        # Create receipt: 10 units @ 15.00
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=10, unit_cost=Decimal("15.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        # Scrap 3 units
        payload = {
            "warehouse_id": str(warehouse.id),
            "issue_date": datetime.utcnow().isoformat(),
            "issue_type": "SCRAP",
            "remarks": "Scrap write-off",
            "line_items": [
                {"item_id": str(item.id), "quantity": 3.0}
            ]
        }
        res = client.post("/api/inventory/issues", json=payload, headers=admin_headers)
        assert res.status_code == 200, f"Failed create scrap issue: {res.status_code} - {res.text}"
        scrap_id = res.json()["id"]

        # Submit, approve, post
        client.post(f"/api/inventory/issues/{scrap_id}/submit", headers=admin_headers)
        client.post(f"/api/inventory/issues/{scrap_id}/approve", headers=admin_headers)
        client.post(f"/api/inventory/issues/{scrap_id}/post", headers=admin_headers)

        # Verify G/L Journal entry: Debit Scrap Expense (5100) for 45.00 (3 qty * 15.00), Credit Inventory Control (1200) for 45.00
        je = db.query(models.JournalEntry).filter_by(reference_type="ISSUE", reference_id=scrap_id).first()
        assert je is not None
        lines = je.journal_lines
        debits = sum(l.debit_amount for l in lines)
        credits = sum(l.credit_amount for l in lines)
        assert debits == credits == Decimal("45.00")

        scrap_line = [l for l in lines if l.account.code == "5100"][0]
        inv_line = [l for l in lines if l.account.code == "1200"][0]
        assert scrap_line.debit_amount == Decimal("45.00")
        assert inv_line.credit_amount == Decimal("45.00")


    def test_transfer_in_transit_accounting(self, setup_accounting_context, client, admin_headers):
        """6. Verify warehouse transfer workflow, in-transit stock movements, and double-entry postings."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        wh_src = WarehouseFactory.create(db)
        wh_dest = WarehouseFactory.create(db)
        item = ItemFactory.create(db, sku="TRF-SKU", name="Transfer Item", standard_rate=Decimal("10.00"))
        user = register_mock_user(db, admin_headers)

        # Seed source stock: 10 units @ 50.00
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=wh_src.id,
            qty=10, unit_cost=Decimal("50.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        # Propose Transfer of 6 units
        payload = {
            "source_warehouse_id": str(wh_src.id),
            "destination_warehouse_id": str(wh_dest.id),
            "remarks": "In-transit test transfer",
            "line_items": [
                {"item_id": str(item.id), "qty_requested": 6}
            ]
        }
        res = client.post("/api/inventory/transfers", json=payload, headers=admin_headers)
        assert res.status_code == 200, f"Failed create transfer: {res.status_code} - {res.text}"
        trf_id = res.json()["id"]

        # Submit, approve, dispatch
        client.post(f"/api/inventory/transfers/{trf_id}/submit", headers=admin_headers)
        client.post(f"/api/inventory/transfers/{trf_id}/approve", headers=admin_headers)
        res = client.post(f"/api/inventory/transfers/{trf_id}/dispatch", headers=admin_headers)
        assert res.json()["status"] == "IN_TRANSIT"

        # Verify dispatch GL posting: Debit In Transit (1250) for 300.00 (6 * 50.00), Credit Inventory Control (1200) for 300.00
        je_dispatch = db.query(models.JournalEntry).filter_by(reference_type="TRANSFER", reference_id=trf_id, source_event="warehouse_transfer_dispatched").first()
        assert je_dispatch is not None
        lines = je_dispatch.journal_lines
        debits = sum(l.debit_amount for l in lines)
        credits = sum(l.credit_amount for l in lines)
        assert debits == credits == Decimal("300.00")

        transit_line = [l for l in lines if l.account.code == "1250"][0]
        inv_line = [l for l in lines if l.account.code == "1200"][0]
        assert transit_line.debit_amount == Decimal("300.00")
        assert inv_line.credit_amount == Decimal("300.00")

        # Receive transfer
        # Map transfer line ID to receive quantity
        trf_line_id = res.json()["lines"][0]["id"]
        res = client.post(f"/api/inventory/transfers/{trf_id}/receive", json={str(trf_line_id): 6}, headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "COMPLETED"

        # Verify receipt GL posting: Debit Inventory Control (1200) for 300.00, Credit In Transit (1250) for 300.00
        je_receipt = db.query(models.JournalEntry).filter_by(reference_type="TRANSFER", reference_id=trf_id, source_event="warehouse_transfer_received").first()
        assert je_receipt is not None
        lines = je_receipt.journal_lines
        debits = sum(l.debit_amount for l in lines)
        credits = sum(l.credit_amount for l in lines)
        assert debits == credits == Decimal("300.00")

        inv_line = [l for l in lines if l.account.code == "1200"][0]
        transit_line = [l for l in lines if l.account.code == "1250"][0]
        assert inv_line.debit_amount == Decimal("300.00")
        assert transit_line.credit_amount == Decimal("300.00")

        # Verify Trial Balance remains balanced
        tb = LedgerService.get_trial_balance(db)
        assert tb["is_balanced"] is True

        # Now verify cancellation recovery
        # Dispatch another transfer of remaining 4 units @ 50.00
        payload_2 = {
            "source_warehouse_id": str(wh_src.id),
            "destination_warehouse_id": str(wh_dest.id),
            "remarks": "In-transit test transfer 2",
            "line_items": [
                {"item_id": str(item.id), "qty_requested": 4}
            ]
        }
        res = client.post("/api/inventory/transfers", json=payload_2, headers=admin_headers)
        trf_id_2 = res.json()["id"]

        client.post(f"/api/inventory/transfers/{trf_id_2}/submit", headers=admin_headers)
        client.post(f"/api/inventory/transfers/{trf_id_2}/approve", headers=admin_headers)
        client.post(f"/api/inventory/transfers/{trf_id_2}/dispatch", headers=admin_headers)

        # Source warehouse stock is 0, transit is 4
        stock_src = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=wh_src.id).first()
        assert stock_src.quantity_on_hand == 0

        # Cancel transfer
        client.post(f"/api/inventory/transfers/{trf_id_2}/cancel", headers=admin_headers)

        # Source warehouse stock should be restored to 4
        db.refresh(stock_src)
        assert stock_src.quantity_on_hand == 4

        # Verify Trial Balance remains balanced
        tb = LedgerService.get_trial_balance(db)
        assert tb["is_balanced"] is True


    def test_inventory_close_certification(self, setup_accounting_context, client, admin_headers):
        """7. Verify inventory period closing controls (A-H validations)."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        period = setup_accounting_context["period"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        user = register_mock_user(db, admin_headers)

        # Seed snapshots for each date in period duration to satisfy Validation F
        # Generate daily snapshots
        curr_date = period.start_date
        while curr_date <= period.end_date:
            snapshot = models.InventorySnapshot(
                snapshot_date=curr_date,
                warehouse_id=None,
                inventory_value=Decimal("0.0"),
                inventory_quantity=Decimal("0.0"),
                item_count=0,
                tenant_id=tenant_id
            )
            db.add(snapshot)
            curr_date += timedelta(days=1)
        db.commit()

        # Enforce validations A-H:
        # A. Negative Stock check
        item = ItemFactory.create(db, sku="CLOSE-SKU", name="Close Item", standard_rate=Decimal("10.00"))
        warehouse = WarehouseFactory.create(db)
        neg_stock = models.WarehouseStock(
            warehouse_id=warehouse.id, item_id=item.id, quantity_on_hand=-5, valuation_unit_cost=Decimal("10.00"), tenant_id=tenant_id
        )
        db.add(neg_stock)
        db.commit()

        with pytest.raises(ValueError, match="Negative stock balances exist"):
            InventoryService.close_inventory_period(db, period.id, user.id)

        # Resolve negative stock
        neg_stock.quantity_on_hand = 0
        db.commit()

        # B. Variance check
        # Seed a layer of 100 units @ 10 (subledger = 1000), but GL balance is 0. Check close fails.
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=100, unit_cost=Decimal("10.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        with pytest.raises(ValueError, match="Inventory Subledger vs GL variance"):
            InventoryService.close_inventory_period(db, period.id, user.id)

        # Resolve variance by manual G/L journal to credit / debit Inventory Control (1200) by 1000
        account_1200 = setup_accounting_context["accounts"]["1200"]
        account_5000 = setup_accounting_context["accounts"]["5000"]
        AccountingService.create_manual_journal_entry(
            db=db, entry_date=datetime.utcnow(), narration="variance resolve",
            lines=[
                {"account_id": account_1200.id, "debit_amount": 1000.00, "credit_amount": 0.0, "narration": "resolve"},
                {"account_id": account_5000.id, "debit_amount": 0.0, "credit_amount": 1000.00, "narration": "resolve"}
            ],
            user_id=user.id
        )
        db.commit()

        # C. Open Adjustments check
        from backend import schemas
        payload = schemas.InventoryAdjustmentCreate(
            item_id=item.id, warehouse_id=warehouse.id, qty_change=Decimal("10"), unit_cost=Decimal("10.00"), remarks="Open adj"
        )
        adj = InventoryService.propose_adjustment(db, payload, user.id, tenant_id)
        
        with pytest.raises(ValueError, match="Open inventory adjustment exists"):
            InventoryService.close_inventory_period(db, period.id, user.id)

        # Resolve adjustment (delete or approve)
        db.delete(adj)
        db.commit()

        # D. Open Cycle Counts check
        cc = InventoryService.create_cycle_count(db, warehouse.id, datetime.utcnow(), "Open CC", user.id, tenant_id)
        
        with pytest.raises(ValueError, match="Open cycle count exists"):
            InventoryService.close_inventory_period(db, period.id, user.id)

        # Resolve cycle count
        db.delete(cc)
        db.commit()

        # E. IN_TRANSIT transfers check
        wh_dest = WarehouseFactory.create(db)
        transfer = models.InventoryTransfer(
            transfer_number="TRF-CLOSE-TEST", source_warehouse_id=warehouse.id, destination_warehouse_id=wh_dest.id,
            status="IN_TRANSIT", created_by_id=user.id, tenant_id=tenant_id
        )
        db.add(transfer)
        db.commit()

        with pytest.raises(ValueError, match="Open transfers in transit exist"):
            InventoryService.close_inventory_period(db, period.id, user.id)

        # Resolve transfer
        db.delete(transfer)
        db.commit()

        # H. Unposted Issues check
        unposted_issue = models.InventoryIssue(
            issue_number="IS-CLOSE-TEST", warehouse_id=warehouse.id, issue_date=datetime.utcnow(),
            status="DRAFT", issue_type="ISSUE", tenant_id=tenant_id
        )
        db.add(unposted_issue)
        db.commit()

        with pytest.raises(ValueError, match="Unposted inventory issues exist"):
            InventoryService.close_inventory_period(db, period.id, user.id)

        # Resolve issue
        db.delete(unposted_issue)
        db.commit()

        # Verify successful close when all pass
        period_res = InventoryService.close_inventory_period(db, period.id, user.id)
        assert period_res.status == "CLOSED"


    def test_inventory_ledger_report(self, setup_accounting_context, client, admin_headers):
        """8. Verify movement ledger history is correct."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        item = ItemFactory.create(db, sku="LEDG-SKU", name="Ledger Item", standard_rate=Decimal("10.00"))
        warehouse = WarehouseFactory.create(db)
        user = register_mock_user(db, admin_headers)

        # Receipt 10 units @ 15.00
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=10, unit_cost=Decimal("15.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        start_date = (datetime.utcnow() - timedelta(days=1)).isoformat()
        end_date = (datetime.utcnow() + timedelta(days=1)).isoformat()

        res = client.get(f"/api/inventory/ledger?start_date={start_date}&end_date={end_date}&item_id={item.id}", headers=admin_headers)
        assert res.status_code == 200
        assert len(res.json()) > 0
        assert res.json()[0]["sku"] == "LEDG-SKU"


    def test_inventory_turnover_report(self, setup_accounting_context, client, admin_headers):
        """9. Verify inventory turnover calculations."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        item = ItemFactory.create(db, sku="TURN-SKU", name="Turnover Item", standard_rate=Decimal("10.00"))
        warehouse = WarehouseFactory.create(db)
        user = register_mock_user(db, admin_headers)

        # Cost Layer: 10 units @ 10
        inventory_engine.create_cost_layer(db, item.id, warehouse.id, Decimal("10"), Decimal("10.00"), "MANUAL", uuid.uuid4(), user.id, tenant_id)
        # Consumption of 4 units @ 10
        inventory_engine.consume_cost_layers(db, item.id, warehouse.id, Decimal("4"), Decimal("10.00"), "MANUAL", uuid.uuid4(), user.id, tenant_id)
        db.commit()

        start_date = (datetime.utcnow() - timedelta(days=15)).strftime("%Y-%m-%d")
        end_date = (datetime.utcnow() + timedelta(days=15)).strftime("%Y-%m-%d")

        res = client.get(f"/api/inventory/turnover?start_date={start_date}&end_date={end_date}", headers=admin_headers)
        assert res.status_code == 200
        assert "turnover_ratio" in res.json()


    def test_inventory_consumption_report(self, setup_accounting_context, client, admin_headers):
        """10. Verify inventory consumption report grouping."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        item = ItemFactory.create(db, sku="CONS-SKU", name="Consumption Item", standard_rate=Decimal("10.00"))
        warehouse = WarehouseFactory.create(db)
        department = DepartmentFactory.create(db)
        user = register_mock_user(db, admin_headers)

        # Receipt 10 units @ 15.00
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=10, unit_cost=Decimal("15.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        # Issue 4 units
        payload = {
            "warehouse_id": str(warehouse.id),
            "department_id": str(department.id),
            "issue_date": datetime.utcnow().isoformat(),
            "remarks": "consumption test",
            "line_items": [
                {"item_id": str(item.id), "quantity": 4.0}
            ]
        }
        res = client.post("/api/inventory/issues", json=payload, headers=admin_headers)
        assert res.status_code == 200, f"Failed create issue: {res.status_code} - {res.text}"
        issue_id = res.json()["id"]

        client.post(f"/api/inventory/issues/{issue_id}/submit", headers=admin_headers)
        client.post(f"/api/inventory/issues/{issue_id}/approve", headers=admin_headers)
        client.post(f"/api/inventory/issues/{issue_id}/post", headers=admin_headers)

        start_date = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
        end_date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

        res = client.get(f"/api/inventory/consumption?start_date={start_date}&end_date={end_date}", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data) > 0


    def test_inventory_exposure_report(self, setup_accounting_context, client, admin_headers):
        """11. Verify exposure report obsolete highlights."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        res = client.get("/api/inventory/exposure", headers=admin_headers)
        assert res.status_code == 200
        assert "obsolete_stock" in res.json()


    def test_inventory_gl_reconciliation(self, setup_accounting_context, client, admin_headers):
        """12. Verify subledger value equals GL control balance."""
        db = setup_accounting_context["db"]
        tenant_id = setup_accounting_context["tenant_id"]
        setup_accounting_context["config"].inventory_costing_method = "FIFO"
        db.commit()

        item = ItemFactory.create(db, sku="RECON-SKU", name="Recon Item", standard_rate=Decimal("10.00"))
        warehouse = WarehouseFactory.create(db)
        user = register_mock_user(db, admin_headers)

        # Receipt 10 units @ 15.00
        inventory_engine.record_receipt(
            db=db, item_id=item.id, warehouse_id=warehouse.id,
            qty=10, unit_cost=Decimal("15.00"), reference_type="MANUAL", user_id=user.id
        )
        db.commit()

        # Seed Account 1200 manually via JV to match subledger
        account_1200 = setup_accounting_context["accounts"]["1200"]
        account_5000 = setup_accounting_context["accounts"]["5000"]
        AccountingService.create_manual_journal_entry(
            db=db, entry_date=datetime.utcnow(), narration="recon seed",
            lines=[
                {"account_id": account_1200.id, "debit_amount": 150.00, "credit_amount": 0.0, "narration": "resolve"},
                {"account_id": account_5000.id, "debit_amount": 0.0, "credit_amount": 150.00, "narration": "resolve"}
            ],
            user_id=user.id
        )
        db.commit()

        subledger_total = db.query(
            models.InventoryCostLayer.remaining_quantity * models.InventoryCostLayer.unit_cost
        ).filter(
            models.InventoryCostLayer.is_deleted == False
        ).scalar() or Decimal("0.0")

        debit_sum = db.query(models.JournalLine.debit_amount).filter(
            models.JournalLine.account_id == account_1200.id,
            models.JournalLine.is_deleted == False
        ).scalar() or Decimal("0.0")
        credit_sum = db.query(models.JournalLine.credit_amount).filter(
            models.JournalLine.account_id == account_1200.id,
            models.JournalLine.is_deleted == False
        ).scalar() or Decimal("0.0")
        gl_balance = debit_sum - credit_sum

        variance = abs(Decimal(str(subledger_total)) - Decimal(str(gl_balance)))
        assert variance == Decimal("0.0")
