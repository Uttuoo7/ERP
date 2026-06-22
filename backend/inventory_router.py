from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid

from . import models, schemas, database, dependencies

router = APIRouter(
    tags=["Inventory Ledger & Balances"],
    responses={404: {"description": "Not found"}},
)

@router.get("/stock", response_model=List[schemas.InventoryStockResponse])
def get_inventory_stock(
    warehouse_id: uuid.UUID = None,
    item_id: uuid.UUID = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Get current inventory levels across warehouses."""
    query = db.query(models.InventoryStock)
    if warehouse_id:
        query = query.filter(models.InventoryStock.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(models.InventoryStock.item_id == item_id)
        
    return query.offset(skip).limit(limit).all()

@router.get("/ledger")
def get_ledger(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    item_id: Optional[uuid.UUID] = None,
    warehouse_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Unified endpoint returning detailed movement ledger report when start_date/end_date are provided, or fallback to StockLedger list."""
    if start_date or end_date:
        from backend.services.inventory_reporting_service import InventoryReportingService
        from datetime import datetime, timedelta
        s_date = datetime.fromisoformat(start_date) if start_date else datetime.utcnow() - timedelta(days=30)
        e_date = datetime.fromisoformat(end_date) if end_date else datetime.utcnow()
        return InventoryReportingService.get_ledger_report(db, s_date, e_date, item_id, warehouse_id)
        
    query = db.query(models.StockLedger)
    if warehouse_id:
        query = query.filter(models.StockLedger.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(models.StockLedger.item_id == item_id)
        
    return query.order_by(models.StockLedger.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/settings", response_model=schemas.InventorySettingsResponse)
def get_inventory_settings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Get inventory costing method and negative inventory settings."""
    tenant_id = database.get_current_tenant_id()
    query = db.query(models.TenantConfig)
    if tenant_id:
        query = query.filter(models.TenantConfig.tenant_uuid == tenant_id)
    config = query.first()
    if not config:
        return {"inventory_costing_method": "FIFO", "allow_negative_inventory": False}
    return {
        "inventory_costing_method": config.inventory_costing_method or "FIFO",
        "allow_negative_inventory": config.allow_negative_inventory or False
    }


@router.post("/settings", response_model=schemas.InventorySettingsResponse)
def update_inventory_settings(
    payload: schemas.InventorySettingsUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_inventory_admin_user)
):
    """Update inventory costing method and negative inventory settings."""
    tenant_id = database.get_current_tenant_id()
    query = db.query(models.TenantConfig)
    if tenant_id:
        query = query.filter(models.TenantConfig.tenant_uuid == tenant_id)
    config = query.first()
    if not config:
        if tenant_id:
            config = models.TenantConfig(
                tenant_uuid=tenant_id,
                inventory_costing_method=payload.inventory_costing_method,
                allow_negative_inventory=payload.allow_negative_inventory
            )
            db.add(config)
        else:
            config = db.query(models.TenantConfig).first()
            if not config:
                raise HTTPException(status_code=404, detail="TenantConfig not found.")
    
    config.inventory_costing_method = payload.inventory_costing_method
    config.allow_negative_inventory = payload.allow_negative_inventory
    db.commit()
    db.refresh(config)
    return {
        "inventory_costing_method": config.inventory_costing_method,
        "allow_negative_inventory": config.allow_negative_inventory
    }


@router.get("/valuation", response_model=schemas.InventoryValuationResponse)
def get_inventory_valuation(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Generates inventory valuation ledger report grouped by item and warehouse."""
    from decimal import Decimal
    tenant_id = database.get_current_tenant_id()
    
    # Query non-deleted cost layers with remaining stock
    query = db.query(models.InventoryCostLayer).filter(
        models.InventoryCostLayer.remaining_quantity != 0,
        models.InventoryCostLayer.is_deleted == False
    )
    if tenant_id:
        query = query.filter(models.InventoryCostLayer.tenant_id == tenant_id)
    layers = query.all()
    
    # Pre-fetch items and warehouses to optimize lookup and mapping
    items_map = {item.id: item for item in db.query(models.Item).all()}
    warehouses_map = {wh.id: wh for wh in db.query(models.Warehouse).all()}
    
    groups = {}
    for layer in layers:
        key = (layer.item_id, layer.warehouse_id)
        if key not in groups:
            item = items_map.get(layer.item_id)
            warehouse = warehouses_map.get(layer.warehouse_id) if layer.warehouse_id else None
            groups[key] = {
                "item_id": layer.item_id,
                "sku": item.sku if item else "",
                "name": item.name if item else "",
                "category_name": item.category if item else "Uncategorized",
                "warehouse_name": warehouse.name if warehouse else "Main Warehouse",
                "quantity_on_hand": Decimal("0.0"),
                "inventory_value": Decimal("0.0")
            }
        groups[key]["quantity_on_hand"] += layer.remaining_quantity
        groups[key]["inventory_value"] += layer.remaining_quantity * layer.unit_cost

    valuation_items = []
    warehouse_totals = {}
    category_totals = {}
    company_total_value = Decimal("0.0")

    for key, data in groups.items():
        qty = data["quantity_on_hand"]
        val = data["inventory_value"]
        
        # Calculate unit cost
        if qty != 0:
            avg_unit_cost = val / qty
        else:
            item = items_map.get(data["item_id"])
            avg_unit_cost = item.standard_rate if item else Decimal("0.0")
            
        wh_name = data["warehouse_name"]
        cat_name = data["category_name"]
        
        valuation_items.append({
            "item_id": data["item_id"],
            "sku": data["sku"],
            "name": data["name"],
            "quantity_on_hand": float(qty),
            "unit_cost": float(avg_unit_cost),
            "inventory_value": float(val),
            "warehouse_name": wh_name,
            "category_name": cat_name
        })
        
        warehouse_totals[wh_name] = warehouse_totals.get(wh_name, 0.0) + float(val)
        category_totals[cat_name] = category_totals.get(cat_name, 0.0) + float(val)
        company_total_value += val

    return {
        "items": valuation_items,
        "warehouse_totals": warehouse_totals,
        "category_totals": category_totals,
        "company_total_value": float(company_total_value)
    }

from backend.services.inventory_service import InventoryService

@router.get("/revaluations", response_model=List[schemas.InventoryRevaluationResponse])
def get_revaluations(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Get all inventory revaluations."""
    return InventoryService.get_revaluations(db)

@router.post("/revaluations", response_model=schemas.InventoryRevaluationResponse)
def propose_revaluation(
    payload: schemas.InventoryRevaluationCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_revaluation_user)
):
    """Propose standard costing rate change or manual asset revaluation (draft state)."""
    tenant_id = database.get_current_tenant_id() or models.SYSTEM_DEFAULT_TENANT_UUID
    return InventoryService.propose_revaluation(db, payload.item_id, float(payload.new_cost), payload.reason, tenant_id)

@router.post("/revaluations/{reval_id}/submit", response_model=schemas.InventoryRevaluationResponse)
def submit_revaluation(
    reval_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_revaluation_user)
):
    """Submit revaluation for approval."""
    return InventoryService.submit_revaluation(db, reval_id)

@router.post("/revaluations/{reval_id}/approve", response_model=schemas.InventoryRevaluationResponse)
def approve_revaluation(
    reval_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_inventory_admin_user)
):
    """Approve revaluation, re-calculate cost layers/stock, and post GL journal adjustment entries."""
    return InventoryService.approve_revaluation(db, reval_id, current_user.id)

@router.post("/revaluations/{reval_id}/reject", response_model=schemas.InventoryRevaluationResponse)
def reject_revaluation(
    reval_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_inventory_admin_user)
):
    """Reject revaluation."""
    return InventoryService.reject_revaluation(db, reval_id)

@router.get("/snapshots", response_model=List[schemas.InventorySnapshotResponse])
def get_snapshots(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Get list of inventory snapshots."""
    return InventoryService.get_snapshots(db)

@router.post("/snapshots", response_model=schemas.InventorySnapshotResponse)
def generate_snapshot(
    payload: schemas.InventorySnapshotCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_snapshot_user)
):
    """Create a new daily/month-end/period-close snapshot."""
    tenant_id = database.get_current_tenant_id() or models.SYSTEM_DEFAULT_TENANT_UUID
    return InventoryService.generate_snapshot(db, payload.snapshot_date, payload.warehouse_id, tenant_id)

@router.get("/snapshots/{snapshot_id}/details", response_model=schemas.InventorySnapshotDetailsResponse)
def get_snapshot_details(
    snapshot_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Browse item details at snapshot state."""
    snapshot = db.query(models.InventorySnapshot).filter_by(id=snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found.")
    details = InventoryService.get_snapshot_details(db, snapshot_id)
    return {
        "snapshot": snapshot,
        "details": details
    }

@router.post("/snapshots/{snapshot_id}/restore")
def restore_snapshot(
    snapshot_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN
    ]))
):
    """Restore stock subledger state to snapshot date."""
    success = InventoryService.restore_snapshot(db, snapshot_id)
    return {"status": "success" if success else "failed", "message": "Inventory subledger restored successfully."}

@router.get("/analytics", response_model=schemas.InventoryAnalyticsResponse)
def get_analytics(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Get advanced inventory dashboard analytics."""
    tenant_id = database.get_current_tenant_id() or models.SYSTEM_DEFAULT_TENANT_UUID
    return InventoryService.get_inventory_analytics(db, tenant_id)


# --- Standalone Adjustments Endpoints ---
@router.post("/adjustments", response_model=schemas.InventoryAdjustmentResponse)
def propose_adjustment(
    payload: schemas.InventoryAdjustmentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    tenant_id = database.get_current_tenant_id() or models.SYSTEM_DEFAULT_TENANT_UUID
    return InventoryService.propose_adjustment(db, payload, current_user.id, tenant_id)

@router.get("/adjustments", response_model=List[schemas.InventoryAdjustmentResponse])
def get_adjustments(
    status: str = None,
    warehouse_id: uuid.UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return InventoryService.get_adjustments(db, status, warehouse_id, skip, limit)

@router.post("/adjustments/{id}/submit", response_model=schemas.InventoryAdjustmentResponse)
def submit_adjustment(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    return InventoryService.submit_adjustment(db, id)

@router.post("/adjustments/{id}/approve", response_model=schemas.InventoryAdjustmentResponse)
def approve_adjustment(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    return InventoryService.approve_adjustment(db, id, current_user.id)

@router.post("/adjustments/{id}/reject", response_model=schemas.InventoryAdjustmentResponse)
def reject_adjustment(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    return InventoryService.reject_adjustment(db, id)


# --- Warehouse Transfers Endpoints ---
@router.post("/transfers", response_model=schemas.InventoryTransferResponse)
def create_transfer(
    payload: schemas.InventoryTransferCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    tenant_id = database.get_current_tenant_id() or models.SYSTEM_DEFAULT_TENANT_UUID
    return InventoryService.create_transfer(db, payload, current_user.id, tenant_id)

@router.get("/transfers", response_model=List[schemas.InventoryTransferResponse])
def get_transfers(
    status: str = None,
    source_warehouse_id: uuid.UUID = None,
    destination_warehouse_id: uuid.UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return InventoryService.get_transfers(db, status, source_warehouse_id, destination_warehouse_id, skip, limit)

@router.post("/transfers/{id}/submit", response_model=schemas.InventoryTransferResponse)
def submit_transfer(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return InventoryService.submit_transfer(db, id)

@router.post("/transfers/{id}/approve", response_model=schemas.InventoryTransferResponse)
def approve_transfer(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    return InventoryService.approve_transfer(db, id, current_user.id)

@router.post("/transfers/{id}/dispatch", response_model=schemas.InventoryTransferResponse)
def dispatch_transfer(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    return InventoryService.dispatch_transfer(db, id, current_user.id)

@router.post("/transfers/{id}/receive", response_model=schemas.InventoryTransferResponse)
def receive_transfer(
    id: uuid.UUID,
    payload: dict,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return InventoryService.receive_transfer(db, id, payload, current_user.id)

@router.post("/transfers/{id}/cancel", response_model=schemas.InventoryTransferResponse)
def cancel_transfer(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return InventoryService.cancel_transfer(db, id, current_user.id)


# --- Cycle Counting Endpoints ---
@router.post("/cycle-counts", response_model=schemas.CycleCountResponse)
def create_cycle_count(
    payload: schemas.CycleCountCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    tenant_id = database.get_current_tenant_id() or models.SYSTEM_DEFAULT_TENANT_UUID
    return InventoryService.create_cycle_count(db, payload.warehouse_id, payload.count_date, payload.remarks, current_user.id, tenant_id)

@router.get("/cycle-counts", response_model=List[schemas.CycleCountResponse])
def get_cycle_counts(
    status: str = None,
    warehouse_id: uuid.UUID = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return InventoryService.get_cycle_counts(db, status, warehouse_id, skip, limit)

@router.put("/cycle-counts/{id}/entry", response_model=schemas.CycleCountResponse)
def submit_cycle_count(
    id: uuid.UUID,
    payload: List[schemas.CycleCountLineEntry],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    lines_data = [l.model_dump() for l in payload]
    return InventoryService.submit_cycle_count(db, id, lines_data, current_user.id)

@router.post("/cycle-counts/{id}/approve", response_model=schemas.CycleCountResponse)
def approve_cycle_count(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    return InventoryService.approve_cycle_count(db, id, current_user.id, current_user.id)

@router.post("/cycle-counts/{id}/reject", response_model=schemas.CycleCountResponse)
def reject_cycle_count(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    return InventoryService.reject_cycle_count(db, id)


# --- Unified Movement Ledger Endpoint ---
@router.get("/movement-ledger", response_model=schemas.MovementLedgerResponse)
def get_movement_ledger(
    item_id: uuid.UUID = None,
    warehouse_id: uuid.UUID = None,
    start_date: datetime = None,
    end_date: datetime = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return InventoryService.get_movement_ledger(db, item_id, warehouse_id, start_date, end_date, skip, limit)


@router.get("/turnover")
def get_turnover(
    start_date: str,
    end_date: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend.services.inventory_reporting_service import InventoryReportingService
    from datetime import datetime, timedelta
    s_date = datetime.fromisoformat(start_date) if start_date else datetime.utcnow() - timedelta(days=30)
    e_date = datetime.fromisoformat(end_date) if end_date else datetime.utcnow()
    return InventoryReportingService.get_turnover_report(db, s_date, e_date)


@router.get("/exposure")
def get_exposure(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend.services.inventory_reporting_service import InventoryReportingService
    return InventoryReportingService.get_exposure_report(db)


@router.get("/consumption")
def get_consumption(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend.services.inventory_reporting_service import InventoryReportingService
    from datetime import datetime
    s_date = datetime.fromisoformat(start_date) if start_date else None
    e_date = datetime.fromisoformat(end_date) if end_date else None
    return InventoryReportingService.get_consumption_report(db, s_date, e_date)


@router.get("/closing-certificate")
def get_closing_certificate(
    period_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend.services.inventory_reporting_service import InventoryReportingService
    return InventoryReportingService.get_closing_certificate(db, period_id)


@router.post("/issues", response_model=schemas.InventoryIssueResponse)
def create_issue(
    payload: schemas.InventoryIssueCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from decimal import Decimal
    from datetime import datetime
    tenant_id = database.get_current_tenant_id() or models.SYSTEM_DEFAULT_TENANT_UUID
    
    issue_num = f"IS-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    issue = models.InventoryIssue(
        issue_number=issue_num,
        warehouse_id=payload.warehouse_id,
        department_id=payload.department_id,
        issue_date=payload.issue_date,
        status="DRAFT",
        issue_type=payload.issue_type,
        remarks=payload.remarks,
        tenant_id=tenant_id
    )
    db.add(issue)
    db.flush()
    
    for line_data in payload.line_items:
        line = models.InventoryIssueLine(
            issue_id=issue.id,
            item_id=line_data.item_id,
            quantity=line_data.quantity,
            unit_cost=Decimal("0.0"),
            total_cost=Decimal("0.0"),
            costing_method_used="FIFO",
            issue_cost_basis="FIFO"
        )
        db.add(line)
        
    db.commit()
    db.refresh(issue)
    return issue


@router.post("/issues/{id}/submit", response_model=schemas.InventoryIssueResponse)
def submit_issue(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    issue = db.query(models.InventoryIssue).filter_by(id=id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT issues can be submitted")
    issue.status = "SUBMITTED"
    db.commit()
    db.refresh(issue)
    return issue


@router.post("/issues/{id}/approve", response_model=schemas.InventoryIssueResponse)
def approve_issue(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from decimal import Decimal
    from datetime import datetime
    issue = db.query(models.InventoryIssue).filter_by(id=id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status != "SUBMITTED":
        raise HTTPException(status_code=400, detail="Only SUBMITTED issues can be approved")
        
    try:
        from backend.inventory_engine import record_material_issue, record_material_return
        for line in issue.lines:
            if issue.issue_type == "RETURN":
                unit_cost, total_cost, costing_method = record_material_return(
                    db=db,
                    item_id=line.item_id,
                    warehouse_id=issue.warehouse_id,
                    qty=line.quantity,
                    unit_cost=line.unit_cost or Decimal("0.0"),
                    reference_type="MATERIAL_RETURN",
                    reference_id=issue.id,
                    user_id=current_user.id,
                    remarks=issue.remarks
                )
                line.unit_cost = unit_cost
                line.total_cost = total_cost
                line.costing_method_used = costing_method
                line.issue_cost_basis = costing_method
            else:
                unit_cost, total_cost, consumed_layers_info, costing_method = record_material_issue(
                    db=db,
                    item_id=line.item_id,
                    warehouse_id=issue.warehouse_id,
                    qty=line.quantity,
                    reference_type="MATERIAL_ISSUE",
                    reference_id=issue.id,
                    user_id=current_user.id,
                    remarks=issue.remarks
                )
                line.unit_cost = unit_cost
                line.total_cost = total_cost
                line.costing_method_used = costing_method
                line.issue_cost_basis = costing_method
                line.cost_layer_reference = consumed_layers_info
                
        issue.status = "APPROVED"
        issue.approved_by_id = current_user.id
        issue.approved_at = datetime.utcnow()
        db.commit()
        db.refresh(issue)
        return issue
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/issues/{id}/post", response_model=schemas.InventoryIssueResponse)
def post_issue(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    issue = db.query(models.InventoryIssue).filter_by(id=id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Only APPROVED issues can be posted")
        
    try:
        from backend.services.posting_engine import PostingEngine
        if issue.issue_type == "SCRAP":
            PostingEngine.handle_inventory_scrap_posted({"issue_id": id}, db)
        elif issue.issue_type == "RETURN":
            PostingEngine.handle_inventory_return_posted({"issue_id": id}, db)
        else:
            PostingEngine.handle_inventory_issue_posted({"issue_id": id}, db)
            
        db.commit()
        db.refresh(issue)
        return issue
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/returns", response_model=schemas.InventoryIssueResponse)
def create_return(
    payload: schemas.InventoryIssueCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from decimal import Decimal
    from datetime import datetime
    tenant_id = database.get_current_tenant_id() or models.SYSTEM_DEFAULT_TENANT_UUID
    
    issue_num = f"RET-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    issue = models.InventoryIssue(
        issue_number=issue_num,
        warehouse_id=payload.warehouse_id,
        department_id=payload.department_id,
        issue_date=payload.issue_date,
        status="DRAFT",
        issue_type="RETURN",
        remarks=payload.remarks,
        tenant_id=tenant_id
    )
    db.add(issue)
    db.flush()
    
    for line_data in payload.line_items:
        item = db.query(models.Item).filter_by(id=line_data.item_id).first()
        unit_cost = item.standard_rate if item else Decimal("0.0")
        line = models.InventoryIssueLine(
            issue_id=issue.id,
            item_id=line_data.item_id,
            quantity=line_data.quantity,
            unit_cost=unit_cost,
            total_cost=line_data.quantity * unit_cost,
            costing_method_used="FIFO",
            issue_cost_basis="FIFO"
        )
        db.add(line)
        
    db.commit()
    db.refresh(issue)
    return issue


@router.post("/periods/close")
def close_period(
    period_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        period = InventoryService.close_inventory_period(db, period_id, current_user.id)
        return {"status": "success", "message": f"Period {period.period_name} closed successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
