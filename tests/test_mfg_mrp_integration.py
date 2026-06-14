import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy import text
from tests.factories.entity_factories import (
    UserFactory, ItemFactory, WarehouseFactory, POFactory, VendorFactory
)
from backend import models, schemas, inventory_engine
from backend.services.inventory_service import InventoryService
from backend.mfg_mrp_services import (
    run_mrp_engine, approve_recommendation, confirm_mrp_plan
)

pytestmark = pytest.mark.mrp_planning

def setup_integration_test_data(db_session):
    """Seed baseline test entities."""
    user = db_session.query(models.User).filter_by(username="mrp_integ_admin").first()
    if not user:
        user = UserFactory.create(db_session, role=models.Role.ADMIN, username="mrp_integ_admin")
    
    # Check if item exists, otherwise create
    item = db_session.query(models.Item).filter_by(sku="MRP-INT-ITEM").first()
    if not item:
        item = ItemFactory.create(
            db_session,
            sku="MRP-INT-ITEM",
            name="MRP Integration Raw Material",
            standard_rate=Decimal("120.00")
        )
    
    source_wh = db_session.query(models.Warehouse).filter_by(warehouse_code="MRP-S-WH").first()
    if not source_wh:
        source_wh = WarehouseFactory.create(db_session, warehouse_code="MRP-S-WH", name="Source Warehouse")
        
    dest_wh = db_session.query(models.Warehouse).filter_by(warehouse_code="MRP-D-WH").first()
    if not dest_wh:
        dest_wh = WarehouseFactory.create(db_session, warehouse_code="MRP-D-WH", name="Destination Warehouse")
    
    # Seed Fiscal Year and Accounting Period for posting date checks
    today = datetime.utcnow()
    fy = db_session.query(models.FiscalYear).filter_by(status="ACTIVE").first()
    if not fy:
        fy = models.FiscalYear(
            name=f"FY-{today.year}",
            start_date=today - timedelta(days=180),
            end_date=today + timedelta(days=180),
            status="ACTIVE",
            tenant_id=user.tenant_id
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
            fiscal_year_id=fy.id,
            tenant_id=user.tenant_id
        )
        db_session.add(current_period)

    # Seed Accounts 1200 and 1250 for dispatch and receipt postings
    acc_1250 = db_session.query(models.Account).filter_by(code="1250").first()
    if not acc_1250:
        acc_1250 = models.Account(
            code="1250",
            name="Inventory In Transit Account",
            account_type="ASSET",
            tenant_id=user.tenant_id,
            is_active=True
        )
        db_session.add(acc_1250)
        db_session.flush()

    acc_1200 = db_session.query(models.Account).filter_by(code="1200").first()
    if not acc_1200:
        acc_1200 = models.Account(
            code="1200",
            name="Inventory Control Account",
            account_type="ASSET",
            tenant_id=user.tenant_id,
            is_active=True
        )
        db_session.add(acc_1200)
        db_session.flush()

    # Seed PostingConfigurations
    configs = [
        {"event_key": "INVENTORY_CONTROL", "account_id": acc_1200.id},
        {"event_key": "INVENTORY_IN_TRANSIT", "account_id": acc_1250.id},
    ]
    for cfg in configs:
        exists = db_session.query(models.PostingConfiguration).filter_by(event_key=cfg["event_key"]).first()
        if not exists:
            p_cfg = models.PostingConfiguration(
                event_key=cfg["event_key"],
                account_id=cfg["account_id"],
                tenant_id=user.tenant_id
            )
            db_session.add(p_cfg)

    db_session.commit()
    return user, item, source_wh, dest_wh

def seed_stock_and_policy(db_session, tenant_id, item_id, warehouse_id, qty_on_hand, safety_qty=50.0, user_id=None):
    """Helper to seed WarehouseStock, InventoryStock and SafetyStockPolicy."""
    # 1. Clear any existing records for this item/warehouse to prevent duplicates
    db_session.query(models.WarehouseStock).filter_by(
        item_id=item_id, warehouse_id=warehouse_id
    ).delete()
    db_session.query(models.InventoryStock).filter_by(
        item_id=item_id, warehouse_id=warehouse_id
    ).delete()
    db_session.query(models.InventoryCostLayer).filter_by(
        item_id=item_id, warehouse_id=warehouse_id
    ).delete()
    db_session.commit()

    if qty_on_hand > 0:
        # 2. Record receipt (creates WarehouseStock and InventoryCostLayer)
        inventory_engine.record_receipt(
            db=db_session,
            item_id=item_id,
            warehouse_id=warehouse_id,
            qty=int(qty_on_hand),
            unit_cost=Decimal("120.00"),
            reference_type="MANUAL",
            user_id=user_id
        )
        db_session.commit()

        # 3. Create/Update InventoryStock for MRP engine compatibility
        inv_stock = db_session.query(models.InventoryStock).filter_by(
            warehouse_id=warehouse_id,
            item_id=item_id
        ).first()
        if not inv_stock:
            inv_stock = models.InventoryStock(
                warehouse_id=warehouse_id,
                item_id=item_id,
                current_stock=Decimal(str(qty_on_hand)),
                reserved_stock=Decimal("0.0"),
                tenant_id=tenant_id
            )
            db_session.add(inv_stock)
        else:
            inv_stock.current_stock = Decimal(str(qty_on_hand))
        db_session.commit()
    else:
        wh_stock = models.WarehouseStock(
            warehouse_id=warehouse_id,
            item_id=item_id,
            quantity_on_hand=0.0,
            quantity_transit=0.0,
            tenant_id=tenant_id
        )
        db_session.add(wh_stock)
        db_session.commit()

    # Seed SafetyStockPolicy
    policy = db_session.query(models.SafetyStockPolicy).filter_by(
        item_id=item_id,
        warehouse_id=warehouse_id
    ).first()
    if not policy:
        policy = models.SafetyStockPolicy(
            item_id=item_id,
            warehouse_id=warehouse_id,
            safety_stock_qty=safety_qty,
            reorder_point_qty=60.0,
            reorder_qty=100.0,
            lead_time_days=4,
            tenant_id=tenant_id
        )
        db_session.add(policy)
    else:
        policy.safety_stock_qty = safety_qty
        policy.reorder_point_qty = 60.0
        policy.reorder_qty = 100.0
        
    db_session.commit()

@pytest.mark.api
def test_mrp_transfer_logic_execution(db_session):
    """Verify transfer logic stock movements (deduction at source, transit to dest, receipt to dest)."""
    user, item, source_wh, dest_wh = setup_integration_test_data(db_session)
    
    # Seed source warehouse with 100 stock
    seed_stock_and_policy(db_session, user.tenant_id, item.id, source_wh.id, qty_on_hand=100.0, user_id=user.id)
    # Seed destination warehouse with 0 stock
    seed_stock_and_policy(db_session, user.tenant_id, item.id, dest_wh.id, qty_on_hand=0.0, user_id=user.id)
    
    # Create the payload schemas
    payload = schemas.InventoryTransferCreate(
        source_warehouse_id=source_wh.id,
        destination_warehouse_id=dest_wh.id,
        remarks="Integration test transfer",
        line_items=[
            schemas.InventoryTransferLineCreate(
                item_id=item.id,
                qty_requested=40
            )
        ]
    )
    
    # 1. Create stock transfer (DRAFT)
    transfer = InventoryService.create_transfer(
        db=db_session,
        payload=payload,
        user_id=user.id,
        tenant_id=user.tenant_id
    )
    
    # Submit & Approve
    InventoryService.submit_transfer(db_session, transfer.id)
    InventoryService.approve_transfer(db_session, transfer.id, user.id)
    
    # Verify stock has not changed yet
    src_stock = db_session.query(models.WarehouseStock).filter_by(warehouse_id=source_wh.id, item_id=item.id).first()
    dest_stock = db_session.query(models.WarehouseStock).filter_by(warehouse_id=dest_wh.id, item_id=item.id).first()
    assert src_stock.quantity_on_hand == 100.0
    assert dest_stock.quantity_on_hand == 0.0
    
    # 2. Dispatch transfer
    InventoryService.dispatch_transfer(db_session, transfer.id, user.id)
    
    # Verify source stock is deducted, destination transit is updated
    db_session.refresh(src_stock)
    db_session.refresh(dest_stock)
    assert src_stock.quantity_on_hand == 60.0  # 100 - 40
    assert dest_stock.quantity_transit == 40.0
    assert dest_stock.quantity_on_hand == 0.0
    
    # 3. Receive transfer
    InventoryService.receive_transfer(db_session, transfer.id, {}, user.id)
    
    # Verify transit is cleared, destination stock is added
    db_session.refresh(dest_stock)
    assert dest_stock.quantity_transit == 0.0
    assert dest_stock.quantity_on_hand == 40.0

@pytest.mark.api
def test_mrp_expedite_logic(db_session):
    """Verify that delayed PO line generates EXPEDITE recommendation, and approval updates delivery_date and links documents."""
    user, item, source_wh, dest_wh = setup_integration_test_data(db_session)
    vendor = VendorFactory.create(db_session)
    
    # Seed shortage at destination (safety stock = 50, net available = 10, shortage = 40)
    seed_stock_and_policy(db_session, user.tenant_id, item.id, dest_wh.id, qty_on_hand=10.0, user_id=user.id)
    
    # Create PO with future delivery date (30 days from now)
    po = POFactory.create(db_session, vendor=vendor, warehouse=dest_wh, created_by=user)
    pol = models.POLineItem(
        po_id=po.id,
        item_id=item.id,
        quantity_ordered=100,
        unit_price=Decimal("120.00"),
        delivery_date=datetime.utcnow() + timedelta(days=30),
        tenant_id=user.tenant_id
    )
    db_session.add(pol)
    
    # Add a demand forecast to trigger a shortage recommendation
    forecast = models.DemandForecast(
        item_id=item.id,
        warehouse_id=dest_wh.id,
        forecast_qty=Decimal("150.0"),
        forecast_date=datetime.utcnow() + timedelta(days=1),
        forecast_method="MANUAL",
        is_active=True,
        tenant_id=user.tenant_id
    )
    db_session.add(forecast)
    db_session.commit()
    
    # Run MRP
    recs = run_mrp_engine(db_session, generated_by_id=user.id)
    assert len(recs) > 0
    
    # Retrieve generated EXPEDITE recommendation
    rec = db_session.query(models.MRPRecommendation).filter_by(
        item_id=item.id,
        recommendation_type="EXPEDITE"
    ).first()
    assert rec is not None
    assert rec.source_po_id == po.id
    
    # Approve recommendation
    approve_recommendation(db_session, rec.id)
    
    # Verify PO line delivery date is adjusted to recommendation's required date
    db_session.refresh(pol)
    assert pol.delivery_date.date() == rec.required_date.date()
    
    # Verify DocumentRelationship and DocumentLineRelationship are created
    doc_rel = db_session.query(models.DocumentRelationship).filter_by(
        source_id=rec.id,
        target_id=po.id
    ).first()
    assert doc_rel is not None
    assert doc_rel.relationship_type == "EXPEDITE"
    
    line_rel = db_session.query(models.DocumentLineRelationship).filter_by(
        document_relationship_id=doc_rel.id,
        source_line_id=rec.id,
        target_line_id=pol.id
    ).first()
    assert line_rel is not None

@pytest.mark.api
def test_mrp_conversion_and_relationship_mapping(db_session):
    """Verify conversion from PURCHASE recommendation to Purchase Requisition and relationship mapping."""
    user, item, source_wh, dest_wh = setup_integration_test_data(db_session)
    
    # Seed shortage, no PO (should generate PURCHASE)
    seed_stock_and_policy(db_session, user.tenant_id, item.id, dest_wh.id, qty_on_hand=10.0, user_id=user.id)
    
    recs = run_mrp_engine(db_session, generated_by_id=user.id)
    rec = db_session.query(models.MRPRecommendation).filter_by(
        item_id=item.id,
        recommendation_type="PURCHASE"
    ).first()
    assert rec is not None
    
    # Approve
    approve_recommendation(db_session, rec.id)
    assert rec.status == "CONVERTED"
    assert rec.purchase_requisition_id is not None
    
    # Verify relationships
    doc_rel = db_session.query(models.DocumentRelationship).filter_by(
        source_id=rec.id,
        target_id=rec.purchase_requisition_id
    ).first()
    assert doc_rel is not None
    
    line_rel = db_session.query(models.DocumentLineRelationship).filter_by(
        document_relationship_id=doc_rel.id,
        source_line_id=rec.id,
        target_line_id=rec.purchase_requisition_line_id
    ).first()
    assert line_rel is not None

@pytest.mark.api
def test_mrp_prevent_duplicate_recommendations(db_session):
    """Verify that running MRP repeatedly does not produce duplicate recommendations for the same Item + Warehouse + Plan."""
    user, item, source_wh, dest_wh = setup_integration_test_data(db_session)
    seed_stock_and_policy(db_session, user.tenant_id, item.id, dest_wh.id, qty_on_hand=10.0, user_id=user.id)
    
    # Run MRP first time
    recs_first = run_mrp_engine(db_session, generated_by_id=user.id)
    assert len(recs_first) == 1
    
    # Running it again should delete PENDING and regenerate exactly 1 recommendation (no duplicates)
    recs_second = run_mrp_engine(db_session, generated_by_id=user.id)
    assert len(recs_second) == 1

@pytest.mark.api
def test_mrp_deleted_pr_reference_recovery(db_session):
    """Verify recovery when target PR is deleted: recommendation resets reference and allows re-conversion."""
    user, item, source_wh, dest_wh = setup_integration_test_data(db_session)
    seed_stock_and_policy(db_session, user.tenant_id, item.id, dest_wh.id, qty_on_hand=10.0, user_id=user.id)
    
    recs = run_mrp_engine(db_session, generated_by_id=user.id)
    rec = db_session.query(models.MRPRecommendation).filter_by(
        item_id=item.id
    ).first()
    assert rec is not None
    
    # 1. Convert to PR
    approve_recommendation(db_session, rec.id)
    assert rec.status == "CONVERTED"
    pr_id = rec.purchase_requisition_id
    pr_line_id = rec.purchase_requisition_line_id
    
    # Clear references on recommendation and commit to allow deletion of PR without FK constraint failures
    rec.purchase_requisition_id = None
    rec.purchase_requisition_line_id = None
    db_session.commit()
    
    # Delete the PR from database (mimics deletion)
    pr = db_session.query(models.PurchaseRequisition).filter_by(id=pr_id).first()
    db_session.delete(pr)
    db_session.commit()
    
    # Restore references in Python memory to simulate the stale DB state for the recovery check
    rec.purchase_requisition_id = pr_id
    rec.purchase_requisition_line_id = pr_line_id
    rec.status = 'CONVERTED'
    
    # 2. Approve again (recovery path should detect deleted PR and perform new conversion)
    approve_recommendation(db_session, rec.id)
    db_session.refresh(rec)
    
    assert rec.status == "CONVERTED"
    assert rec.purchase_requisition_id is not None
    assert rec.purchase_requisition_id != pr_id  # A new PR was successfully created!

