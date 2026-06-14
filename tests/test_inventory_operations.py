import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from tests.factories.entity_factories import (
    UserFactory, ItemFactory, WarehouseFactory
)
from backend import models
from backend.services.inventory_service import InventoryService
from backend.services.posting_engine import PostingEngine
from backend.services.accounting_service import AccountingService
from backend.services.ledger_service import LedgerService
from backend import inventory_engine

pytestmark = pytest.mark.inventory

# ─── Seeding & Setup Helpers ──────────────────────────────────────────────────

def seed_finance_for_operations(db_session):
    """Seed accounts, fiscal years, periods, and posting configurations for operation tests."""
    accounts_data = [
        {"code": "1000", "name": "Bank / Cash Account", "account_type": "ASSET"},
        {"code": "1200", "name": "Inventory Control Account", "account_type": "ASSET"},
        {"code": "1250", "name": "Inventory In Transit Account", "account_type": "ASSET"},
        {"code": "4100", "name": "Inventory Gain Account", "account_type": "REVENUE"},
        {"code": "5100", "name": "Inventory Loss Account", "account_type": "EXPENSE"},
        {"code": "5000", "name": "Inventory Variance Account", "account_type": "EXPENSE"},
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

    configs = [
        {"event_key": "INVENTORY_CONTROL", "account_code": "1200"},
        {"event_key": "INVENTORY_IN_TRANSIT", "account_code": "1250"},
    ]
    for cfg in configs:
        exists = db_session.query(models.PostingConfiguration).filter_by(event_key=cfg["event_key"]).first()
        if not exists:
            p_cfg = models.PostingConfiguration(
                event_key=cfg["event_key"],
                account_id=accounts_by_code[cfg["account_code"]].id
            )
            db_session.add(p_cfg)

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

    db_session.commit()
    return accounts_by_code

@pytest.fixture
def setup_operations_context(db_session):
    accounts = seed_finance_for_operations(db_session)
    tenant_id = models.SYSTEM_DEFAULT_TENANT_UUID
    
    # Configure TenantConfig
    config = db_session.query(models.TenantConfig).filter_by(tenant_uuid=tenant_id).first()
    if not config:
        config = models.TenantConfig(
            tenant_uuid=tenant_id,
            inventory_control_account_id=accounts["1200"].id,
            inventory_adjustment_gain_account_id=accounts["4100"].id,
            inventory_adjustment_loss_account_id=accounts["5100"].id,
            inventory_variance_account_id=accounts["5000"].id,
            inventory_costing_method="FIFO",
            allow_negative_inventory=False
        )
        db_session.add(config)
    else:
        config.inventory_control_account_id = accounts["1200"].id
        config.inventory_adjustment_gain_account_id = accounts["4100"].id
        config.inventory_adjustment_loss_account_id = accounts["5100"].id
        config.inventory_variance_account_id = accounts["5000"].id
    
    db_session.commit()
    return {
        "db": db_session,
        "tenant_id": tenant_id,
        "accounts": accounts,
        "config": config
    }

# ─── Operational Tests ────────────────────────────────────────────────────────

def test_configurable_accounting_validation(setup_operations_context):
    """Verify posting engine raises validation errors if configurable accounts are missing."""
    db = setup_operations_context["db"]
    tenant_id = setup_operations_context["tenant_id"]
    config = setup_operations_context["config"]

    # Temporarily remove one account config
    original_gain_id = config.inventory_adjustment_gain_account_id
    config.inventory_adjustment_gain_account_id = None
    
    # Temporarily rename fallback accounts so that fallback resolution fails
    gain_acc = db.query(models.Account).filter_by(code="4100").first()
    loss_acc = db.query(models.Account).filter_by(code="5100").first()
    if gain_acc:
        gain_acc.code = "4100_temp"
    if loss_acc:
        loss_acc.code = "5100_temp"
    db.commit()

    # Create dummy adjustment
    item = ItemFactory.create(db)
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    adj = models.InventoryAdjustment(
        item_id=item.id,
        warehouse_id=warehouse.id,
        qty_change=10,
        unit_cost=Decimal("15.00"),
        status="DRAFT",
        created_by_id=user.id,
        tenant_id=tenant_id
    )
    db.add(adj)
    db.commit()

    try:
        with pytest.raises(ValueError, match="Required inventory GL account configuration is missing."):
            PostingEngine.post_inventory_adjustment(db, adj, commit=False)
    finally:
        # Restore config and accounts
        config.inventory_adjustment_gain_account_id = original_gain_id
        if gain_acc:
            gain_acc.code = "4100"
        if loss_acc:
            loss_acc.code = "5100"
        db.commit()


def test_positive_stock_adjustment(setup_operations_context):
    """Verify positive stock adjustment increases on-hand stock and posts to GL."""
    db = setup_operations_context["db"]
    tenant_id = setup_operations_context["tenant_id"]
    
    item = ItemFactory.create(db)
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Propose
    from backend import schemas
    payload = schemas.InventoryAdjustmentCreate(
        item_id=item.id,
        warehouse_id=warehouse.id,
        qty_change=Decimal("50"),
        unit_cost=Decimal("20.00"),
        reason_code="FOUND",
        remarks="Found during layout re-org"
    )

    adj = InventoryService.propose_adjustment(db, payload, user.id, tenant_id)
    assert adj.status == "DRAFT"

    # Submit
    adj = InventoryService.submit_adjustment(db, adj.id)
    assert adj.status == "SUBMITTED"

    # Approve
    adj = InventoryService.approve_adjustment(db, adj.id, user.id)
    assert adj.status == "APPROVED"

    # Verify Stock update
    stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    assert stock.quantity_on_hand == 50

    # Verify movement ledger write
    movements = db.query(models.InventoryTransactionLine).filter_by(item_id=item.id, warehouse_id=warehouse.id).all()
    assert len(movements) == 1
    assert movements[0].quantity == 50

    # Verify GL postings: Debit Inventory Control (1200), Credit Gain (4100)
    je = db.query(models.JournalEntry).filter_by(reference_type="ADJUSTMENT", reference_id=adj.id).first()
    assert je is not None
    assert je.status == "POSTED"

    lines = je.journal_lines
    assert len(lines) == 2
    
    debits = sum(l.debit_amount for l in lines)
    credits = sum(l.credit_amount for l in lines)
    assert debits == credits == Decimal("1000.00") # 50 qty * 20.00 unit cost

    control_line = [l for l in lines if l.account.code == "1200"][0]
    gain_line = [l for l in lines if l.account.code == "4100"][0]
    
    assert control_line.debit_amount == Decimal("1000.00")
    assert gain_line.credit_amount == Decimal("1000.00")


def test_negative_stock_adjustment(setup_operations_context):
    """Verify negative stock adjustment decreases stock, consumes FIFO layers, and posts loss."""
    db = setup_operations_context["db"]
    tenant_id = setup_operations_context["tenant_id"]

    item = ItemFactory.create(db)
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Seed initial layers
    inventory_engine.record_receipt(
        db=db,
        item_id=item.id,
        warehouse_id=warehouse.id,
        qty=30,
        unit_cost=Decimal("15.00"),
        reference_type="MANUAL",
        reference_id=uuid.uuid4(),
        user_id=user.id,
        remarks="Seed receipt"
    )
    db.commit()

    # Propose negative adjustment
    from backend import schemas
    payload = schemas.InventoryAdjustmentCreate(
        item_id=item.id,
        warehouse_id=warehouse.id,
        qty_change=Decimal("-10"),
        unit_cost=Decimal("15.00"), # unit cost requested
        reason_code="DAMAGED",
        remarks="Damaged item write-off"
    )

    adj = InventoryService.propose_adjustment(db, payload, user.id, tenant_id)
    adj = InventoryService.submit_adjustment(db, adj.id)
    adj = InventoryService.approve_adjustment(db, adj.id, user.id)

    # Verify Stock reduced
    stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    assert stock.quantity_on_hand == 20

    # Verify GL postings: Debit Loss (5100), Credit Inventory Control (1200)
    je = db.query(models.JournalEntry).filter_by(reference_type="ADJUSTMENT", reference_id=adj.id).first()
    assert je is not None

    loss_line = [l for l in je.journal_lines if l.account.code == "5100"][0]
    control_line = [l for l in je.journal_lines if l.account.code == "1200"][0]

    assert loss_line.debit_amount == Decimal("150.00") # 10 * 15.00
    assert control_line.credit_amount == Decimal("150.00")


def test_warehouse_transfer_workflow(setup_operations_context):
    """Verify full multi-state transfer workflow from Draft to Complete."""
    db = setup_operations_context["db"]
    tenant_id = setup_operations_context["tenant_id"]

    wh_src = WarehouseFactory.create(db)
    wh_dest = WarehouseFactory.create(db)
    item = ItemFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Seed source stock: 100 units @ 10.00
    inventory_engine.record_receipt(
        db=db,
        item_id=item.id,
        warehouse_id=wh_src.id,
        qty=100,
        unit_cost=Decimal("10.00"),
        reference_type="MANUAL",
        reference_id=uuid.uuid4(),
        user_id=user.id
    )
    db.commit()

    # 1. Propose Draft Transfer
    from backend import schemas
    payload = schemas.InventoryTransferCreate(
        source_warehouse_id=wh_src.id,
        destination_warehouse_id=wh_dest.id,
        remarks="Test transfer layout",
        line_items=[
            schemas.InventoryTransferLineCreate(item_id=item.id, qty_requested=40)
        ]
    )

    transfer = InventoryService.create_transfer(db, payload, user.id, tenant_id)
    assert transfer.status == "DRAFT"
    assert len(transfer.lines) == 1
    assert transfer.lines[0].qty_requested == 40

    # 2. Submit
    transfer = InventoryService.submit_transfer(db, transfer.id)
    assert transfer.status == "PENDING_APPROVAL"

    # 3. Approve
    transfer = InventoryService.approve_transfer(db, transfer.id, user.id)
    assert transfer.status == "APPROVED"

    # 4. Dispatch (Deduct from source, add to transit)
    transfer = InventoryService.dispatch_transfer(db, transfer.id, user.id)
    assert transfer.status == "IN_TRANSIT"

    # Source stock should be 100 - 40 = 60
    stock_src = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=wh_src.id).first()
    assert stock_src.quantity_on_hand == 60

    # Destination stock should have 40 transit, 0 on hand
    stock_dest = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=wh_dest.id).first()
    assert stock_dest.quantity_transit == 40
    assert stock_dest.quantity_on_hand == 0

    # 5. Receive (Deduct from transit, add to destination actual)
    # Receive all 40
    receive_qtys = {transfer.lines[0].id: 40}
    transfer = InventoryService.receive_transfer(db, transfer.id, receive_qtys, user.id)
    assert transfer.status == "COMPLETED"

    db.refresh(stock_dest)
    assert stock_dest.quantity_transit == 0
    assert stock_dest.quantity_on_hand == 40

    # Verify FIFO layers created at destination at identical unit cost (10.00)
    dest_layers = db.query(models.InventoryCostLayer).filter_by(item_id=item.id, warehouse_id=wh_dest.id, is_deleted=False).all()
    assert len(dest_layers) == 1
    assert dest_layers[0].remaining_quantity == 40
    assert dest_layers[0].unit_cost == Decimal("10.00")


def test_warehouse_transfer_cancellation(setup_operations_context):
    """Verify cancellation of in-transit transfer restores stock to source warehouse."""
    db = setup_operations_context["db"]
    tenant_id = setup_operations_context["tenant_id"]

    wh_src = WarehouseFactory.create(db)
    wh_dest = WarehouseFactory.create(db)
    item = ItemFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Seed stock: 50 units @ 12.00
    inventory_engine.record_receipt(
        db=db,
        item_id=item.id,
        warehouse_id=wh_src.id,
        qty=50,
        unit_cost=Decimal("12.00"),
        reference_type="MANUAL",
        reference_id=uuid.uuid4(),
        user_id=user.id
    )
    db.commit()

    from backend import schemas
    payload = schemas.InventoryTransferCreate(
        source_warehouse_id=wh_src.id,
        destination_warehouse_id=wh_dest.id,
        remarks="Cancellation test",
        line_items=[
            schemas.InventoryTransferLineCreate(item_id=item.id, qty_requested=20)
        ]
    )

    transfer = InventoryService.create_transfer(db, payload, user.id, tenant_id)
    transfer = InventoryService.submit_transfer(db, transfer.id)
    transfer = InventoryService.approve_transfer(db, transfer.id, user.id)
    transfer = InventoryService.dispatch_transfer(db, transfer.id, user.id)
    
    # Cancel the transfer in-transit
    transfer = InventoryService.cancel_transfer(db, transfer.id, user.id)
    assert transfer.status == "CANCELLED"

    # Verify stock restored to source warehouse (50 units on hand)
    stock_src = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=wh_src.id).first()
    assert stock_src.quantity_on_hand == 50

    # Destination warehouse should have 0 on hand and 0 transit
    stock_dest = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=wh_dest.id).first()
    assert stock_dest is None or (stock_dest.quantity_on_hand == 0 and stock_dest.quantity_transit == 0)


def test_cycle_counting_variance_and_auditing(setup_operations_context):
    """Verify cycle count entry sheets, counted_by, verified_by, and approved_by audit flow."""
    db = setup_operations_context["db"]
    tenant_id = setup_operations_context["tenant_id"]

    warehouse = WarehouseFactory.create(db)
    item = ItemFactory.create(db)
    user_staff = UserFactory.create(db, role=models.Role.EMPLOYEE)
    user_mgr = UserFactory.create(db, role=models.Role.WAREHOUSE_MANAGER)

    # Seed stock: 10 units @ 30.00
    inventory_engine.record_receipt(
        db=db,
        item_id=item.id,
        warehouse_id=warehouse.id,
        qty=10,
        unit_cost=Decimal("30.00"),
        reference_type="MANUAL",
        reference_id=uuid.uuid4(),
        user_id=user_mgr.id
    )
    db.commit()

    # 1. Propose count sheet
    cc = InventoryService.create_cycle_count(db, warehouse.id, datetime.utcnow(), "Monthly cycle count", user_mgr.id, tenant_id)
    assert cc.status == "DRAFT"
    assert len(cc.lines) == 1
    assert cc.lines[0].system_qty == 10

    # 2. Staff performs physical count: finds 12 units (variance +2)
    # Put entries
    lines_entry = [
        {"id": cc.lines[0].id, "physical_qty": 12}
    ]
    cc = InventoryService.submit_cycle_count(db, cc.id, lines_entry, user_staff.id)
    assert cc.status == "PENDING_APPROVAL"
    assert cc.lines[0].physical_qty == 12
    assert cc.lines[0].variance_qty == 2
    assert cc.counted_by_id == user_staff.id

    # 3. Manager approves cycle count
    cc = InventoryService.approve_cycle_count(db, cc.id, user_mgr.id, user_mgr.id)
    assert cc.status == "COMPLETED"
    assert cc.verified_by_id == user_mgr.id
    assert cc.approved_by_id == user_mgr.id
    assert cc.approved_at is not None

    # Verify automatic adjustment was proposed and approved, bringing on-hand stock to 12
    stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    assert stock.quantity_on_hand == 12
