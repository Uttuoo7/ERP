from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
import uuid
from typing import List
from datetime import datetime

def create_production_order(db: Session, po_data: schemas.ProductionOrderCreate) -> models.ProductionOrder:
    po = models.ProductionOrder(
        production_order_number=f"PO-{uuid.uuid4().hex[:6].upper()}",
        **po_data.model_dump()
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return po

def start_production(db: Session, po_id: uuid.UUID, warehouse_id: uuid.UUID, user_id: uuid.UUID) -> models.ProductionOrder:
    po = db.query(models.ProductionOrder).filter(models.ProductionOrder.id == po_id).first()
    if not po: raise ValueError("Production Order not found")
    if po.production_status != 'PLANNED': raise ValueError("Only PLANNED orders can be started")
    
    bom = db.query(models.BOM).filter(models.BOM.id == po.bom_id).first()
    if not bom: raise ValueError("BOM not found")
    
    # Issue Raw Materials (Consume)
    for li in bom.line_items:
        qty_needed = float(li.required_qty) * float(po.production_qty) * (1 + (float(li.wastage_percent) / 100))
        
        stock = db.query(models.InventoryStock).filter(
            models.InventoryStock.item_id == li.raw_material_item_id,
            models.InventoryStock.warehouse_id == warehouse_id
        ).first()
        
        if not stock or stock.current_stock < qty_needed:
            raise ValueError(f"Insufficient stock for raw material {li.raw_material_item_id}. Needed: {qty_needed}")
            
        stock.current_stock -= qty_needed
        stock.available_stock = stock.current_stock - stock.reserved_stock
        
        tx = models.InventoryTransaction(
            item_id=li.raw_material_item_id,
            warehouse_id=warehouse_id,
            transaction_type="PRODUCTION_CONSUMPTION",
            quantity=-qty_needed,
            reference_id=po.id,
            remarks=f"Consumed for PO {po.production_order_number}",
            created_by_id=user_id
        )
        db.add(tx)
        
    po.production_status = 'IN_PROGRESS'
    po.actual_start_date = datetime.utcnow()
    db.commit()
    db.refresh(po)
    return po

def complete_production(db: Session, po_id: uuid.UUID, completed_qty: float, warehouse_id: uuid.UUID, user_id: uuid.UUID) -> models.ProductionOrder:
    po = db.query(models.ProductionOrder).filter(models.ProductionOrder.id == po_id).first()
    if not po: raise ValueError("Production Order not found")
    if po.production_status not in ['IN_PROGRESS', 'QC_PENDING']: raise ValueError("Invalid state for completion")
    
    bom = db.query(models.BOM).filter(models.BOM.id == po.bom_id).first()
    if not bom: raise ValueError("BOM not found")
    
    # Receive Finished Goods
    stock = db.query(models.InventoryStock).filter(
        models.InventoryStock.item_id == bom.finished_good_item_id,
        models.InventoryStock.warehouse_id == warehouse_id
    ).first()
    
    if not stock:
        # Create stock entry if none exists
        stock = models.InventoryStock(
            item_id=bom.finished_good_item_id,
            warehouse_id=warehouse_id,
            current_stock=completed_qty,
            available_stock=completed_qty
        )
        db.add(stock)
    else:
        stock.current_stock += completed_qty
        stock.available_stock += completed_qty
        
    tx = models.InventoryTransaction(
        item_id=bom.finished_good_item_id,
        warehouse_id=warehouse_id,
        transaction_type="FINISHED_GOODS_RECEIPT",
        quantity=completed_qty,
        valuation_unit_cost=bom.total_cost,
        reference_id=po.id,
        remarks=f"Produced from PO {po.production_order_number}",
        created_by_id=user_id
    )
    db.add(tx)
    
    po.completed_qty += completed_qty
    po.pending_qty = float(po.production_qty) - float(po.completed_qty) - float(po.rejected_qty)
    
    if po.pending_qty <= 0:
        po.production_status = 'COMPLETED'
        po.actual_end_date = datetime.utcnow()
        
    db.commit()
    db.refresh(po)
    return po
