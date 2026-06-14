import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from tests.factories.entity_factories import UserFactory, ItemFactory, WarehouseFactory
from backend import models
from backend import manufacturing_engine
from backend.manufacturing_accounting_service import ManufacturingAccountingService
from backend.shop_floor_service import ShopFloorService
from backend.manufacturing_reporting_service import ManufacturingReportingService
from backend.services.accounting_service import AccountingService

def setup_accounting_period(db):
    """Seeds default fiscal year, period, and control accounts if missing."""
    today = datetime.utcnow()
    tenant_id = models.SYSTEM_DEFAULT_TENANT_UUID

    # Seed Fiscal Year
    fy = db.query(models.FiscalYear).filter_by(status="ACTIVE").first()
    if not fy:
        fy = models.FiscalYear(
            id=uuid.uuid4(),
            name=f"FY-{today.year}",
            start_date=today - timedelta(days=180),
            end_date=today + timedelta(days=180),
            status="ACTIVE",
            tenant_id=tenant_id
        )
        db.add(fy)
        db.flush()

    # Seed Accounting Period
    period_name = today.strftime("%Y-%m")
    ap = db.query(models.AccountingPeriod).filter_by(period_name=period_name).first()
    if not ap:
        ap = models.AccountingPeriod(
            id=uuid.uuid4(),
            period_name=period_name,
            start_date=today - timedelta(days=15),
            end_date=today + timedelta(days=15),
            status="OPEN",
            fiscal_year_id=fy.id,
            tenant_id=tenant_id
        )
        db.add(ap)
        db.flush()

    # Seed GL Accounts
    codes_needed = {
        "1200": "Inventory Control Account",
        "1300": "WIP Inventory Account",
        "5100": "Labor Absorption Account",
        "5200": "Manufacturing Overhead Account",
        "1210": "Finished Goods Inventory Account",
        "5300": "Scrap Variance Account",
        "1350": "Rework Inventory Account",
        "5310": "Material Variance Account",
        "5320": "Labor Variance Account",
        "5330": "Overhead Variance Account",
        "5340": "Yield Variance Account"
    }
    
    for code, name in codes_needed.items():
        acc = db.query(models.Account).filter_by(code=code).first()
        if not acc:
            acc = models.Account(
                id=uuid.uuid4(),
                code=code,
                name=name,
                account_type="ASSET" if code.startswith("1") else "REVENUE" if code.startswith("5") else "EXPENSE",
                tenant_id=tenant_id
            )
            db.add(acc)
            db.flush()

    # Seed default GL sequences
    seq = db.query(models.JournalSequence).first()
    if not seq:
        seq = models.JournalSequence(
            id=uuid.uuid4(),
            fiscal_year_id=fy.id,
            current_number=0,
            tenant_id=tenant_id
        )
        db.add(seq)
        db.flush()

def test_manufacturing_mes_lifecycle(db_session):
    """Verifies complete manufacturing execution, quality, and accounting lifecycle."""
    setup_accounting_period(db_session)
    tenant_id = models.SYSTEM_DEFAULT_TENANT_UUID
    
    # 1. Create items (finished good + raw material component)
    fg_item = ItemFactory.create(db_session, sku="FG-ROBOT", name="Finished Good Robot", unit_price=Decimal("500.00"), tenant_id=tenant_id)
    rm_item = ItemFactory.create(db_session, sku="RM-STEEL", name="Raw Material Steel", unit_price=Decimal("50.00"), tenant_id=tenant_id)
    db_session.flush()

    # Seed initial component inventory stock (100 units)
    warehouse = WarehouseFactory.create(db_session, warehouse_code="M-WH-01", name="Mfg Central Warehouse", tenant_id=tenant_id)
    db_session.flush()
    
    stock = models.InventoryStock(
        id=uuid.uuid4(),
        item_id=rm_item.id,
        warehouse_id=warehouse.id,
        current_stock=Decimal("100.00"),
        reserved_stock=Decimal("0.00"),
        available_stock=Decimal("100.00"),
        tenant_id=tenant_id
    )
    db_session.add(stock)
    db_session.flush()

    # 2. Create Master Data: BOM & Routing
    bom = models.BillOfMaterial(
        id=uuid.uuid4(),
        bom_number="BOM-ROBOT-001",
        item_id=fg_item.id,
        revision="V1.0",
        status="ACTIVE",
        tenant_id=tenant_id
    )
    db_session.add(bom)
    db_session.flush()

    bom_line = models.BillOfMaterialLine(
        id=uuid.uuid4(),
        bom_id=bom.id,
        component_item_id=rm_item.id,
        quantity=Decimal("1.5000"), # 1.5 steel sheets per robot
        scrap_factor=Decimal("0.1000"), # 10% scrap allowance
        uom="Nos",
        tenant_id=tenant_id
    )
    db_session.add(bom_line)

    wc = models.WorkCenter(
        id=uuid.uuid4(),
        code="WC-MACH-01",
        name="Milling Station 1",
        capacity_per_day=Decimal("8.0000"),
        cost_per_hour=Decimal("30.0000"),
        available_hours_per_day=Decimal("8.0000"),
        efficiency_percent=Decimal("95.00"),
        utilization_percent=Decimal("90.00"),
        status="ACTIVE",
        tenant_id=tenant_id
    )
    db_session.add(wc)
    db_session.flush()

    routing = models.Routing(
        id=uuid.uuid4(),
        item_id=fg_item.id,
        revision="V1.0",
        status="ACTIVE",
        tenant_id=tenant_id
    )
    db_session.add(routing)
    db_session.flush()

    op = models.RoutingOperation(
        id=uuid.uuid4(),
        routing_id=routing.id,
        sequence_no=10,
        work_center_id=wc.id,
        operation_name="Precision Milling",
        setup_time_minutes=30,
        run_time_minutes=60,
        tenant_id=tenant_id
    )
    db_session.add(op)
    db_session.flush()

    # 3. Create Work Order in PLANNED state
    wo = manufacturing_engine.create_work_order(
        db=db_session,
        item_id=fg_item.id,
        quantity=Decimal("10.0000"), # Make 10 robots
        planned_start_date=datetime.utcnow(),
        planned_end_date=datetime.utcnow() + timedelta(days=2),
        tenant_id=tenant_id
    )
    assert wo.status == 'PLANNED'

    # 4. Release Work Order (BOM Explosion + Routing Copied)
    wo = manufacturing_engine.release_work_order(db_session, wo.id)
    assert wo.status == 'RELEASED'
    
    # Check snapshots
    wom_list = db_session.query(models.WorkOrderMaterial).filter_by(work_order_id=wo.id).all()
    assert len(wom_list) == 1
    assert wom_list[0].quantity_required == Decimal("15.0000") # 10 * 1.5

    woo_list = db_session.query(models.WorkOrderOperation).filter_by(work_order_id=wo.id).all()
    assert len(woo_list) == 1
    assert woo_list[0].operation_name == "Precision Milling"

    # 5. Allocate materials (reserve raw stock)
    wo = manufacturing_engine.allocate_materials(db_session, wo.id, warehouse.id)
    assert wo.status == 'MATERIAL_ALLOCATED'
    
    # Check reserved_stock in inventory
    db_session.refresh(stock)
    assert stock.reserved_stock == Decimal("16.5000") # 15 * 1.10 (scrap factor)

    # 6. Start Work Order
    wo = manufacturing_engine.start_work_order(db_session, wo.id)
    assert wo.status == 'IN_PROGRESS'

    # 7. Issue Materials to WIP (Accounting Postings)
    # Issue 16.5 units of raw material
    ManufacturingAccountingService.post_material_issue(
        db=db_session,
        work_order_id=wo.id,
        component_item_id=rm_item.id,
        warehouse_id=warehouse.id,
        quantity=Decimal("16.5000"),
        unit_cost=Decimal("50.0000"),
        tenant_id=tenant_id
    )
    # WIP debited: 16.5 * $50 = $825.00
    
    # 8. Start & Complete Operation (Triggers Labor + Overhead absorption)
    ShopFloorService.start_operation(db_session, wo.id, woo_list[0].id)
    ShopFloorService.complete_operation(
        db=db_session,
        work_order_id=wo.id,
        operation_id=woo_list[0].id,
        actual_setup_minutes=30,
        actual_run_minutes=90, # 120 minutes total = 2 hours
        scrap_qty=Decimal("1.5000"), # 1.5 scrap units
        tenant_id=tenant_id
    )
    # Setup + Run = 2 hours. Labor booked = 2 * $25.00 = $50.00
    # Overhead booked = 2 * $30.00 (WC cost) = $60.00
    # Scrap variance posted = 1.5 * $10 = $15.00

    # 9. Request QC Inspection
    wo = manufacturing_engine.request_qc_inspection(db_session, wo.id)
    assert wo.status == 'QC_PENDING'

    # Seed Quality Inspection PASSED
    inspect = models.QualityInspection(
        id=uuid.uuid4(),
        inspection_number="QC-ROBOT-001",
        work_order_id=wo.id,
        item_id=fg_item.id,
        inspected_qty=10.0,
        accepted_qty=10.0,
        rejected_qty=0.0,
        inspection_status="PASSED"
    )
    db_session.add(inspect)
    db_session.flush()

    # 10. Complete Work Order & Receive finished goods into inventory
    # Rollup cost is: Material ($825) + Labor ($50) + Overhead ($60) - Scrap ($15) = $920.00 total actual cost for 10 units => $92.00/unit actual cost.
    actual_unit_cost = Decimal("92.0000")
    ManufacturingAccountingService.post_finished_goods_receipt(
        db=db_session,
        work_order_id=wo.id,
        warehouse_id=warehouse.id,
        quantity=Decimal("10.0000"),
        unit_cost=actual_unit_cost,
        tenant_id=tenant_id
    )
    wo.status = 'COMPLETED'
    wo.actual_end_date = datetime.utcnow()
    db_session.flush()

    # Check stock of finished good
    fg_stock = db_session.query(models.InventoryStock).filter_by(item_id=fg_item.id, warehouse_id=warehouse.id).first()
    assert fg_stock is not None
    assert fg_stock.current_stock == Decimal("10.0000")

    # 11. Close Work Order & variance accounting clearance
    ManufacturingAccountingService.post_variance_accounting(db_session, wo.id, tenant_id)
    wo.status = 'CLOSED'
    db_session.flush()

    # WIP Subledger variance should reconcile to 0
    wip_var = ManufacturingAccountingService.get_wip_reconciliation_variance(db_session, tenant_id)
    assert wip_var == Decimal("0.00")

    # Verify period close controls
    assert ManufacturingAccountingService.validate_manufacturing_period_close(db_session, tenant_id) is True
