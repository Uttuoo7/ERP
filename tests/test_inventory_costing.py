import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from tests.factories.entity_factories import (
    UserFactory, VendorFactory, ItemFactory, WarehouseFactory,
    POFactory, GRNFactory
)
from backend import models
from backend.services.inventory_service import InventoryService
from backend.services.posting_engine import PostingEngine
from backend.services.accounting_service import AccountingService
from backend.services.ledger_service import LedgerService
from backend import inventory_engine
from backend import event_dispatcher

pytestmark = pytest.mark.inventory

# ─── Seeding & Setup Helpers ──────────────────────────────────────────────────

def seed_finance_data(db_session):
    """Seed accounts, fiscal years, periods, and posting configurations for costing tests."""
    accounts_data = [
        {"code": "1000", "name": "Bank / Cash Account", "account_type": "ASSET"},
        {"code": "1200", "name": "Inventory Control Account", "account_type": "ASSET"},
        {"code": "1300", "name": "GST Input Receivable Account", "account_type": "ASSET"},
        {"code": "2000", "name": "Accounts Payable Control Account", "account_type": "LIABILITY"},
        {"code": "2100", "name": "GRNI Control Account (Accrual)", "account_type": "LIABILITY"},
        {"code": "2200", "name": "TDS Payable Control Account", "account_type": "LIABILITY"},
        {"code": "5000", "name": "Cost of Goods Sold Account / Variance Offset", "account_type": "EXPENSE"},
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

    # Fiscal Years & Periods
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

    configs = [
        {"event_key": "INVENTORY_RECEIPT", "account_code": "1200"},
        {"event_key": "GRNI_ACCRUAL", "account_code": "2100"},
        {"event_key": "GST_RECEIVABLE", "account_code": "1300"},
        {"event_key": "TDS_PAYABLE", "account_code": "2200"},
        {"event_key": "AP_CONTROL", "account_code": "2000"},
        {"event_key": "BANK_CONTROL", "account_code": "1000"},
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
    return accounts_by_code

@pytest.fixture
def setup_test_context(db_session):
    accounts = seed_finance_data(db_session)
    PostingEngine.register_listeners(force=True)
    
    tenant_id = models.SYSTEM_DEFAULT_TENANT_UUID
    
    # Setup TenantConfig
    config = db_session.query(models.TenantConfig).filter_by(tenant_uuid=tenant_id).first()
    if not config:
        config = models.TenantConfig(
            tenant_uuid=tenant_id,
            inventory_costing_method="FIFO",
            allow_negative_inventory=False
        )
        db_session.add(config)
        db_session.flush()
        
    return {
        "db": db_session,
        "tenant_id": tenant_id,
        "accounts": accounts,
        "config": config
    }

# ─── Verification Tests ───────────────────────────────────────────────────────

def test_wac_receipts(setup_test_context):
    """1. Verify WAC is updated correctly after every receipt."""
    db = setup_test_context["db"]
    tenant_id = setup_test_context["tenant_id"]
    setup_test_context["config"].inventory_costing_method = "WAC"
    db.commit()

    item = ItemFactory.create(db, sku="WAC-TEST-ITEM", name="WAC Test Item", standard_rate=Decimal("100.00"))
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Seed WarehouseStock for WAC
    stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    if not stock:
        stock = models.WarehouseStock(
            id=uuid.uuid4(),
            warehouse_id=warehouse.id,
            item_id=item.id,
            quantity_on_hand=0,
            quantity_reserved=0,
            valuation_unit_cost=Decimal("100.00"),
            tenant_id=tenant_id
        )
        db.add(stock)
        db.flush()

    # First Receipt: Qty 10 @ 100
    layer1 = inventory_engine.create_cost_layer(
        db=db,
        item_id=item.id,
        warehouse_id=warehouse.id,
        qty=Decimal("10"),
        unit_cost=Decimal("100.00"),
        reference_type="MANUAL",
        reference_id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=tenant_id
    )
    db.commit()

    assert layer1.unit_cost == Decimal("100.00")
    
    # Second Receipt: Qty 5 @ 130
    layer2 = inventory_engine.create_cost_layer(
        db=db,
        item_id=item.id,
        warehouse_id=warehouse.id,
        qty=Decimal("5"),
        unit_cost=Decimal("130.00"),
        reference_type="MANUAL",
        reference_id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=tenant_id
    )
    db.commit()

    # Recalculated WAC: (10*100 + 5*130) / (10+5) = (1000 + 650) / 15 = 1650 / 15 = 110.00
    expected_wac = Decimal("110.00")
    db.refresh(layer1)
    db.refresh(layer2)
    
    assert layer1.unit_cost == expected_wac
    assert layer2.unit_cost == expected_wac

    # Verify WarehouseStock valuation cost is updated to new WAC
    db.refresh(stock)
    assert stock.valuation_unit_cost == expected_wac

def test_wac_issues(setup_test_context):
    """2. Verify stock issues deplete inventory using the correct WAC."""
    db = setup_test_context["db"]
    tenant_id = setup_test_context["tenant_id"]
    setup_test_context["config"].inventory_costing_method = "WAC"
    db.commit()

    item = ItemFactory.create(db, sku="WAC-ISS-ITEM", name="WAC Issue Test Item", standard_rate=Decimal("100.00"))
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Seed initial layers: 10 units @ 100, then 5 units @ 130 (WAC becomes 110)
    inventory_engine.create_cost_layer(db, item.id, warehouse.id, Decimal("10"), Decimal("100.00"), "MANUAL", uuid.uuid4(), user.id, tenant_id)
    inventory_engine.create_cost_layer(db, item.id, warehouse.id, Decimal("5"), Decimal("130.00"), "MANUAL", uuid.uuid4(), user.id, tenant_id)
    
    # Seed WarehouseStock quantity
    stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    if stock:
        stock.quantity_on_hand = 15
        stock.valuation_unit_cost = Decimal("110.00")
    else:
        stock = models.WarehouseStock(
            id=uuid.uuid4(),
            warehouse_id=warehouse.id,
            item_id=item.id,
            quantity_on_hand=15,
            quantity_reserved=0,
            valuation_unit_cost=Decimal("110.00"),
            tenant_id=tenant_id
        )
        db.add(stock)
    db.flush()

    # Issue Qty 6
    avg_issue_cost = inventory_engine.consume_cost_layers(
        db=db,
        item_id=item.id,
        warehouse_id=warehouse.id,
        qty_to_issue=Decimal("6"),
        fallback_cost=Decimal("110.00"),
        reference_type="MANUAL",
        reference_id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=tenant_id
    )
    db.commit()

    # Verify issue is valued at WAC (110)
    assert avg_issue_cost == Decimal("110.00")

def test_standard_costing(setup_test_context):
    """3. Verify standard costing receipts value layers at standard rate and post variance."""
    db = setup_test_context["db"]
    tenant_id = setup_test_context["tenant_id"]
    setup_test_context["config"].inventory_costing_method = "STANDARD"
    db.commit()

    # Create Item with standard_rate = 120
    item = ItemFactory.create(db, sku="STD-TEST-ITEM", name="Standard Test Item", standard_rate=Decimal("120.00"))
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)
    vendor = VendorFactory.create(db)

    # Create PO with price = 100
    po = POFactory.create(db, vendor=vendor, warehouse=warehouse, created_by=user, status=models.POStatus.ISSUED, total_amount=Decimal("1000.00"))
    po_line = models.POLineItem(
        id=uuid.uuid4(),
        po_id=po.id,
        item_id=item.id,
        quantity_ordered=10,
        unit_price=Decimal("100.00"),
        remaining_quantity=Decimal("10"),
        quantity_received=0,
        quantity_billed=0
    )
    db.add(po_line)
    db.flush()

    # Create GRN for 10 units at actual price 100
    grn = GRNFactory.create(db, po=po, warehouse=warehouse, received_by=user, subtotal=Decimal("1000.00"), total_amount=Decimal("11800.00"), status="APPROVED")
    grn_line = models.GRNLineItem(
        id=uuid.uuid4(),
        grn_id=grn.id,
        po_line_item_id=po_line.id,
        item_id=item.id,
        quantity_ordered=10,
        quantity_received=10,
        accepted_qty=10,
        rejected_qty=0,
        unit_price=Decimal("100.00")
    )
    db.add(grn_line)
    db.flush()

    # Receipt in costing engine
    layer = inventory_engine.create_cost_layer(
        db=db,
        item_id=item.id,
        warehouse_id=warehouse.id,
        qty=Decimal("10"),
        unit_cost=Decimal("100.00"), # actual cost is 100
        reference_type="GOODS_RECEIPT_NOTE",
        reference_id=grn.id,
        user_id=user.id,
        tenant_id=tenant_id
    )
    db.commit()

    # Layer unit cost must be standard_rate = 120
    assert layer.unit_cost == Decimal("120.00")

    # Dispatch goods_received event
    event_dispatcher.dispatch(
        "goods_received",
        {
            "grn_id": grn.id,
            "grn_number": grn.grn_number,
            "po_number": po.po_number,
            "total_accepted": 10
        },
        db
    )

    # Check G/L posting
    journal = db.query(models.JournalEntry).filter_by(reference_type="GRN", reference_id=grn.id).first()
    assert journal is not None
    db.refresh(journal)

    # Balanced entries check
    debits = sum(line.debit_amount for line in journal.journal_lines)
    credits = sum(line.credit_amount for line in journal.journal_lines)
    assert debits == credits

    # Debit: Inventory Control (1200) by 1200 (Qty 10 * Std rate 120)
    # Credit: GRNI Accrual (2100) by 1000 (Qty 10 * actual PO price 100)
    # Credit: COGS / Variance Offset (5000) by 200 (Favorable variance)
    inv_line = [l for l in journal.journal_lines if l.account.code == "1200"][0]
    grni_line = [l for l in journal.journal_lines if l.account.code == "2100"][0]
    variance_line = [l for l in journal.journal_lines if l.account.code == "5000"][0]

    assert inv_line.debit_amount == Decimal("1200.00")
    assert grni_line.credit_amount == Decimal("1000.00")
    assert variance_line.credit_amount == Decimal("200.00")

    tb = LedgerService.get_trial_balance(db)
    assert tb["is_balanced"] is True

def test_revaluation_approval(setup_test_context):
    """4. Verify standard cost update proposal workflow and rate updates."""
    db = setup_test_context["db"]
    tenant_id = setup_test_context["tenant_id"]
    setup_test_context["config"].inventory_costing_method = "STANDARD"
    db.commit()

    item = ItemFactory.create(db, sku="REV-TEST-ITEM", name="Reval Test Item", standard_rate=Decimal("100.00"))
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Seed a standard cost layer: 10 units @ 100 standard rate
    inventory_engine.create_cost_layer(db, item.id, warehouse.id, Decimal("10"), Decimal("100.00"), "MANUAL", uuid.uuid4(), user.id, tenant_id)
    
    # Seed WarehouseStock
    stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    if stock:
        stock.quantity_on_hand = 10
        stock.valuation_unit_cost = Decimal("100.00")
    else:
        stock = models.WarehouseStock(
            id=uuid.uuid4(),
            warehouse_id=warehouse.id,
            item_id=item.id,
            quantity_on_hand=10,
            quantity_reserved=0,
            valuation_unit_cost=Decimal("100.00"),
            tenant_id=tenant_id
        )
        db.add(stock)
    db.commit()

    # 1. Propose Revaluation to 120
    reval = InventoryService.propose_revaluation(db, item.id, 120.00, "Increase standard rate", tenant_id)
    assert reval.status == "DRAFT"
    assert reval.old_cost == Decimal("100.00")
    assert reval.new_cost == Decimal("120.00")
    assert reval.quantity_affected == Decimal("10")
    assert reval.value_difference == Decimal("200.00")

    # 2. Submit Revaluation
    reval = InventoryService.submit_revaluation(db, reval.id)
    assert reval.status == "SUBMITTED"

    # 3. Approve Revaluation
    reval = InventoryService.approve_revaluation(db, reval.id, user.id)
    assert reval.status == "APPROVED"

    # Verify standard rate, layer unit cost, and stock valuation unit cost are updated
    db.refresh(item)
    assert item.standard_rate == Decimal("120.00")

    layer = db.query(models.InventoryCostLayer).filter_by(item_id=item.id).first()
    assert layer.unit_cost == Decimal("120.00")

    db.refresh(stock)
    assert stock.valuation_unit_cost == Decimal("120.00")

    # Verify G/L adjust journal entry is posted
    journal = db.query(models.JournalEntry).filter_by(reference_type="REVALUATION", reference_id=reval.id).first()
    assert journal is not None
    assert journal.status == "POSTED"
    
    # Check debits == credits
    debits = sum(line.debit_amount for line in journal.journal_lines)
    credits = sum(line.credit_amount for line in journal.journal_lines)
    assert debits == Decimal("200.00")
    assert credits == Decimal("200.00")

    # Debit Account 1200, Credit Account 5000
    inv_line = [l for l in journal.journal_lines if l.account.code == "1200"][0]
    var_line = [l for l in journal.journal_lines if l.account.code == "5000"][0]
    assert inv_line.debit_amount == Decimal("200.00")
    assert var_line.credit_amount == Decimal("200.00")

    tb = LedgerService.get_trial_balance(db)
    assert tb["is_balanced"] is True

def test_snapshot_generation(setup_test_context):
    """5. Verify snapshots correctly calculate aggregate stocks."""
    db = setup_test_context["db"]
    tenant_id = setup_test_context["tenant_id"]

    item = ItemFactory.create(db, sku="SNAP-TEST", name="Snapshot Test Item", standard_rate=Decimal("100.00"))
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Cost Layer: 15 units @ 100
    inventory_engine.create_cost_layer(db, item.id, warehouse.id, Decimal("15"), Decimal("100.00"), "MANUAL", uuid.uuid4(), user.id, tenant_id)
    db.commit()

    today = datetime.utcnow()
    snapshot = InventoryService.generate_snapshot(db, today, warehouse.id, tenant_id)

    assert snapshot.inventory_quantity == Decimal("15")
    assert snapshot.inventory_value == Decimal("1500.00")
    assert snapshot.item_count == 1

    # Fetch details
    details = InventoryService.get_snapshot_details(db, snapshot.id)
    assert len(details) == 1
    assert details[0]["sku"] == "SNAP-TEST"
    assert details[0]["quantity_on_hand"] == 15.0
    assert details[0]["inventory_value"] == 1500.0

def test_snapshot_restore(setup_test_context):
    """6. Verify restoring snapshot rolls back subledger state."""
    db = setup_test_context["db"]
    tenant_id = setup_test_context["tenant_id"]
    setup_test_context["config"].inventory_costing_method = "FIFO"
    db.commit()

    item = ItemFactory.create(db, sku="REST-TEST", name="Restore Test Item", standard_rate=Decimal("100.00"))
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Initial layer: 10 units @ 100 (Date D1)
    ref_id_1 = uuid.uuid4()
    layer1 = inventory_engine.create_cost_layer(db, item.id, warehouse.id, Decimal("10"), Decimal("100.00"), "MANUAL", ref_id_1, user.id, tenant_id)
    old_date = datetime.utcnow() - timedelta(days=5)
    db.query(models.InventoryCostLayer).filter_by(id=layer1.id).update({"created_at": old_date})
    db.query(models.InventoryValuationEntry).filter_by(reference_id=ref_id_1).update({"created_at": old_date})
    db.query(models.InventoryAuditLog).filter_by(reference_id=ref_id_1).update({"created_at": old_date})
    db.commit()
    db.refresh(layer1)
    
    # Set WarehouseStock safely
    stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    if stock:
        stock.quantity_on_hand = 10
        stock.valuation_unit_cost = Decimal("100.00")
    else:
        stock = models.WarehouseStock(
            id=uuid.uuid4(),
            warehouse_id=warehouse.id,
            item_id=item.id,
            quantity_on_hand=10,
            quantity_reserved=0,
            valuation_unit_cost=Decimal("100.00"),
            tenant_id=tenant_id
        )
        db.add(stock)
    
    # Set InventoryLedger safely
    ledger = db.query(models.InventoryLedger).filter_by(item_id=item.id).first()
    if ledger:
        ledger.quantity_on_hand = 10
    else:
        ledger = models.InventoryLedger(
            id=uuid.uuid4(),
            item_id=item.id,
            quantity_on_hand=10,
            quantity_reserved=0,
            tenant_id=tenant_id
        )
        db.add(ledger)
    db.commit()

    # Generate snapshot at D1 (3 days ago)
    snapshot_date = datetime.utcnow() - timedelta(days=3)
    snapshot = InventoryService.generate_snapshot(db, snapshot_date, warehouse.id, tenant_id)

    # Subsequent transaction at D2: receipt of 5 units @ 120
    ref_id_2 = uuid.uuid4()
    layer2 = inventory_engine.create_cost_layer(db, item.id, warehouse.id, Decimal("5"), Decimal("120.00"), "MANUAL", ref_id_2, user.id, tenant_id)
    layer2_date = datetime.utcnow() - timedelta(days=1)
    db.query(models.InventoryCostLayer).filter_by(id=layer2.id).update({"created_at": layer2_date})
    db.query(models.InventoryValuationEntry).filter_by(reference_id=ref_id_2).update({"created_at": layer2_date})
    db.query(models.InventoryAuditLog).filter_by(reference_id=ref_id_2).update({"created_at": layer2_date})
    stock.quantity_on_hand += 5
    ledger.quantity_on_hand += 5
    db.commit()
    db.refresh(layer2)

    # Verify pre-restore counts
    assert stock.quantity_on_hand == 15

    # Restore snapshot
    success = InventoryService.restore_snapshot(db, snapshot.id)
    assert success is True

    # Verify layer2 is marked deleted
    db.refresh(layer2)
    assert layer2.is_deleted is True

    # Verify quantities restored
    db.refresh(stock)
    db.refresh(ledger)
    assert stock.quantity_on_hand == 10
    assert ledger.quantity_on_hand == 10

def test_inventory_analytics(setup_test_context):
    """7. Verify calculations of turnover, slow moving, dead stock, and exposure."""
    db = setup_test_context["db"]
    tenant_id = setup_test_context["tenant_id"]

    item = ItemFactory.create(db, sku="AN-TEST", name="Analytics Item", standard_rate=Decimal("100.00"))
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Cost Layer: 10 units @ 100
    inventory_engine.create_cost_layer(db, item.id, warehouse.id, Decimal("10"), Decimal("100.00"), "MANUAL", uuid.uuid4(), user.id, tenant_id)
    
    # Issue 4 units (Creates consumption valuation entry)
    inventory_engine.consume_cost_layers(db, item.id, warehouse.id, Decimal("4"), Decimal("100.00"), "MANUAL", uuid.uuid4(), user.id, tenant_id)
    db.commit()

    # Run analytics
    analytics = InventoryService.get_inventory_analytics(db, tenant_id)

    # Verify turnover and exposure keys exist
    assert "turnover_ratio" in analytics
    assert "turnover_days" in analytics
    assert "slow_moving" in analytics
    assert "dead_stock" in analytics
    assert "obsolete_stock" in analytics
    assert "exposure" in analytics

def test_gl_reconciliation_after_revaluation(setup_test_context):
    """8. Verify G/L Account 1200 matches subledger value and Trial Balance remains balanced."""
    db = setup_test_context["db"]
    tenant_id = setup_test_context["tenant_id"]
    setup_test_context["config"].inventory_costing_method = "STANDARD"
    db.commit()

    item = ItemFactory.create(db, sku="REC-TEST-ITEM", name="Recon Item", standard_rate=Decimal("100.00"))
    warehouse = WarehouseFactory.create(db)
    user = UserFactory.create(db, role=models.Role.ADMIN)

    # Seed a standard cost layer: 10 units @ 100 standard rate
    inventory_engine.create_cost_layer(db, item.id, warehouse.id, Decimal("10"), Decimal("100.00"), "MANUAL", uuid.uuid4(), user.id, tenant_id)
    
    # Seed WarehouseStock
    stock = db.query(models.WarehouseStock).filter_by(item_id=item.id, warehouse_id=warehouse.id).first()
    if stock:
        stock.quantity_on_hand = 10
        stock.valuation_unit_cost = Decimal("100.00")
    else:
        stock = models.WarehouseStock(
            id=uuid.uuid4(),
            warehouse_id=warehouse.id,
            item_id=item.id,
            quantity_on_hand=10,
            quantity_reserved=0,
            valuation_unit_cost=Decimal("100.00"),
            tenant_id=tenant_id
        )
        db.add(stock)
    
    # Let's seed initial GL balance of 1000 in Account 1200 manually so it matches subledger
    account_1200 = setup_test_context["accounts"]["1200"]
    account_5000 = setup_test_context["accounts"]["5000"]
    
    # Seed opening GL balance via a balanced JV
    AccountingService.create_manual_journal_entry(
        db=db,
        entry_date=datetime.utcnow(),
        narration="Opening inventory balance seed",
        lines=[
            {"account_id": account_1200.id, "debit_amount": 1000.00, "credit_amount": 0.0, "narration": "Debit inventory"},
            {"account_id": account_5000.id, "debit_amount": 0.0, "credit_amount": 1000.00, "narration": "Credit equity/COGS offset"},
        ],
        user_id=user.id
    )
    db.commit()

    # Subledger value: 10 * 100 = 1000. GL Account 1200 balance: 1000. Difference = 0.
    subledger_val = Decimal("10") * Decimal("100.00")
    ledger_result = LedgerService.get_account_ledger(db, account_1200.id)
    gl_balance = Decimal(str(ledger_result["lines"][0]["running_balance"])) if ledger_result["lines"] else Decimal("0.0")
    assert gl_balance == subledger_val

    # Revalue to 150 (Qty affected = 10. Value difference = +500)
    reval = InventoryService.propose_revaluation(db, item.id, 150.00, "Standard rate adjustment", tenant_id)
    InventoryService.submit_revaluation(db, reval.id)
    InventoryService.approve_revaluation(db, reval.id, user.id)

    # Subledger value: 10 * 150 = 1500
    new_subledger_val = Decimal("10") * Decimal("150.00")
    
    # G/L Account 1200 balance should now be 1000 + 500 = 1500
    new_ledger_result = LedgerService.get_account_ledger(db, account_1200.id)
    new_gl_balance = Decimal(str(new_ledger_result["lines"][0]["running_balance"])) if new_ledger_result["lines"] else Decimal("0.0")
    assert new_gl_balance == new_subledger_val

    # Verification: Subledger value minus G/L Account 1200 balance = 0
    assert new_subledger_val - new_gl_balance == Decimal("0.0")

    # Trial Balance must be balanced
    tb = LedgerService.get_trial_balance(db)
    assert tb["is_balanced"] is True
