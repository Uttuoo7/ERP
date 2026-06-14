import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from backend import models

def create_work_order(
    db: Session,
    item_id: uuid.UUID,
    quantity: Decimal,
    planned_start_date: datetime,
    planned_end_date: datetime,
    mrp_plan_id: Optional[uuid.UUID] = None,
    tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
) -> models.WorkOrder:
    """Creates a planned work order."""
    wo_number = f"WO-{uuid.uuid4().hex[:6].upper()}"
    
    wo = models.WorkOrder(
        id=uuid.uuid4(),
        wo_number=wo_number,
        work_order_number=wo_number, # compatibility
        item_id=item_id,
        quantity=quantity,
        planned_start_date=planned_start_date,
        planned_end_date=planned_end_date,
        status='PLANNED',
        mrp_plan_id=mrp_plan_id,
        tenant_id=tenant_id
    )
    db.add(wo)
    db.flush()
    
    # Log audit entry
    log = models.ManufacturingAuditLog(
        work_order_id=wo.id,
        action_type="WO_CHANGE",
        after_value=f"Status: PLANNED, Quantity: {quantity}",
        user_id=None
    )
    db.add(log)
    db.flush()
    return wo

def release_work_order(db: Session, work_order_id: uuid.UUID) -> models.WorkOrder:
    """Explodes active BOM, copies routing operations, and sets status to RELEASED."""
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id, models.WorkOrder.is_deleted == False).first()
    if not wo:
        raise ValueError("Work order not found")
    if wo.status != 'PLANNED':
        raise ValueError("Only PLANNED work orders can be released")
        
    # Get active BOM for item
    bom = db.query(models.BillOfMaterial).filter(
        models.BillOfMaterial.item_id == wo.item_id,
        models.BillOfMaterial.status == 'ACTIVE',
        models.BillOfMaterial.is_deleted == False
    ).first()
    if not bom:
        raise ValueError(f"No active Bill of Material found for finished good item {wo.item_id}")
        
    # Get active Routing for item
    routing = db.query(models.Routing).filter(
        models.Routing.item_id == wo.item_id,
        models.Routing.status == 'ACTIVE',
        models.Routing.is_deleted == False
    ).first()
    if not routing:
        raise ValueError(f"No active Routing found for item {wo.item_id}")
        
    # Explode BOM and write to WorkOrderMaterial snapshot
    for line in bom.line_items:
        required_qty = Decimal(str(line.quantity)) * Decimal(str(wo.quantity))
        wom = models.WorkOrderMaterial(
            id=uuid.uuid4(),
            work_order_id=wo.id,
            component_item_id=line.component_item_id,
            quantity_required=required_qty,
            quantity_issued=Decimal('0.0000'),
            scrap_factor=line.scrap_factor,
            uom=line.uom
        )
        db.add(wom)
        
    # Copy Routing Operations to WorkOrderOperation snapshot
    for op in routing.operations:
        woo = models.WorkOrderOperation(
            id=uuid.uuid4(),
            work_order_id=wo.id,
            sequence_no=op.sequence_no,
            work_center_id=op.work_center_id,
            operation_name=op.operation_name,
            setup_time_minutes=op.setup_time_minutes,
            run_time_minutes=op.run_time_minutes,
            actual_setup_time_minutes=0,
            actual_run_time_minutes=0,
            status='PENDING'
        )
        db.add(woo)
        
    wo.status = 'RELEASED'
    db.flush()
    
    # Log audit entry
    log = models.ManufacturingAuditLog(
        work_order_id=wo.id,
        action_type="WO_CHANGE",
        before_value="Status: PLANNED",
        after_value="Status: RELEASED (BOM Exploded & Routing Copied)",
        user_id=None
    )
    db.add(log)
    db.flush()
    return wo

def allocate_materials(db: Session, work_order_id: uuid.UUID, warehouse_id: uuid.UUID) -> models.WorkOrder:
    """Verifies stock availability, performs allocation reservations, and moves to MATERIAL_ALLOCATED."""
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id, models.WorkOrder.is_deleted == False).first()
    if not wo:
        raise ValueError("Work order not found")
    if wo.status != 'RELEASED':
        raise ValueError("Only RELEASED work orders can allocate materials")
        
    materials = db.query(models.WorkOrderMaterial).filter(models.WorkOrderMaterial.work_order_id == wo.id).all()
    for mat in materials:
        # Check stock in selected warehouse
        stock = db.query(models.InventoryStock).filter(
            models.InventoryStock.item_id == mat.component_item_id,
            models.InventoryStock.warehouse_id == warehouse_id
        ).first()
        
        required_qty = mat.quantity_required * (1 + mat.scrap_factor)
        available = float(stock.current_stock - stock.reserved_stock) if stock else 0.0
        
        if available < float(required_qty):
            raise ValueError(f"Insufficient stock for component {mat.component_item_id} in warehouse {warehouse_id}. Needed: {required_qty}, Available: {available}")
            
        # Allocate by increasing reserved_stock
        stock.reserved_stock = Decimal(str(stock.reserved_stock)) + required_qty
        
    wo.status = 'MATERIAL_ALLOCATED'
    db.flush()
    
    # Log audit entry
    log = models.ManufacturingAuditLog(
        work_order_id=wo.id,
        action_type="WO_CHANGE",
        before_value="Status: RELEASED",
        after_value=f"Status: MATERIAL_ALLOCATED (Reserved in WH: {warehouse_id})",
        user_id=None
    )
    db.add(log)
    db.flush()
    return wo

def start_work_order(db: Session, work_order_id: uuid.UUID) -> models.WorkOrder:
    """Transitions status to IN_PROGRESS and logs actual start date."""
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id, models.WorkOrder.is_deleted == False).first()
    if not wo:
        raise ValueError("Work order not found")
    if wo.status != 'MATERIAL_ALLOCATED':
        raise ValueError("Work order must be MATERIAL_ALLOCATED before starting")
        
    wo.status = 'IN_PROGRESS'
    wo.actual_start_date = datetime.utcnow()
    db.flush()
    
    # Log audit entry
    log = models.ManufacturingAuditLog(
        work_order_id=wo.id,
        action_type="WO_CHANGE",
        before_value="Status: MATERIAL_ALLOCATED",
        after_value="Status: IN_PROGRESS",
        user_id=None
    )
    db.add(log)
    db.flush()
    return wo

def complete_operation(
    db: Session,
    work_order_id: uuid.UUID,
    operation_id: uuid.UUID,
    actual_setup_time_minutes: int,
    actual_run_time_minutes: int
) -> models.WorkOrderOperation:
    """Marks operation completed, logging actual setup/run hours."""
    woo = db.query(models.WorkOrderOperation).filter(
        models.WorkOrderOperation.id == operation_id,
        models.WorkOrderOperation.work_order_id == work_order_id
    ).first()
    if not woo:
        raise ValueError("Operation not found")
    if woo.status == 'COMPLETED':
        raise ValueError("Operation is already completed")
        
    woo.actual_setup_time_minutes = actual_setup_time_minutes
    woo.actual_run_time_minutes = actual_run_time_minutes
    woo.status = 'COMPLETED'
    db.flush()
    return woo

def request_qc_inspection(db: Session, work_order_id: uuid.UUID) -> models.WorkOrder:
    """Verifies all operations are complete and transitions to QC_PENDING."""
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id, models.WorkOrder.is_deleted == False).first()
    if not wo:
        raise ValueError("Work order not found")
    if wo.status != 'IN_PROGRESS':
        raise ValueError("Only IN_PROGRESS work orders can request QC")
        
    # Verify all operations complete
    open_ops = db.query(models.WorkOrderOperation).filter(
        models.WorkOrderOperation.work_order_id == wo.id,
        models.WorkOrderOperation.status != 'COMPLETED'
    ).count()
    if open_ops > 0:
        raise ValueError(f"Cannot request QC: {open_ops} operations are still not completed")
        
    wo.status = 'QC_PENDING'
    db.flush()
    
    # Log audit entry
    log = models.ManufacturingAuditLog(
        work_order_id=wo.id,
        action_type="WO_CHANGE",
        before_value="Status: IN_PROGRESS",
        after_value="Status: QC_PENDING",
        user_id=None
    )
    db.add(log)
    db.flush()
    return wo

def cancel_work_order(db: Session, work_order_id: uuid.UUID, warehouse_id: Optional[uuid.UUID] = None) -> models.WorkOrder:
    """Cancels a work order and releases allocated stocks."""
    wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == work_order_id, models.WorkOrder.is_deleted == False).first()
    if not wo:
        raise ValueError("Work order not found")
    if wo.status in ['CLOSED', 'CANCELLED']:
        raise ValueError("Work order is already finalized")
        
    # Release allocations if MATERIAL_ALLOCATED or IN_PROGRESS
    if wo.status in ['MATERIAL_ALLOCATED', 'IN_PROGRESS', 'QC_PENDING'] and warehouse_id:
        materials = db.query(models.WorkOrderMaterial).filter(models.WorkOrderMaterial.work_order_id == wo.id).all()
        for mat in materials:
            stock = db.query(models.InventoryStock).filter(
                models.InventoryStock.item_id == mat.component_item_id,
                models.InventoryStock.warehouse_id == warehouse_id
            ).first()
            if stock:
                required_qty = mat.quantity_required * (1 + mat.scrap_factor)
                stock.reserved_stock = max(Decimal('0.0000'), Decimal(str(stock.reserved_stock)) - required_qty)
                
    before = wo.status
    wo.status = 'CANCELLED'
    db.flush()
    
    # Log audit entry
    log = models.ManufacturingAuditLog(
        work_order_id=wo.id,
        action_type="WO_CHANGE",
        before_value=f"Status: {before}",
        after_value="Status: CANCELLED",
        user_id=None
    )
    db.add(log)
    db.flush()
    return wo
