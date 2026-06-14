from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List

def create_delivery_challan(db: Session, dc_data: schemas.DeliveryChallanCreate, user_id: uuid.UUID) -> models.DeliveryChallan:
    dc = models.DeliveryChallan(
        dc_number=f"DC-{uuid.uuid4().hex[:6].upper()}",
        **dc_data.model_dump(exclude={'line_items'})
    )
    db.add(dc)
    db.flush()
    
    for li in dc_data.line_items:
        # 1. Update SO line item
        so_line = db.query(models.SalesOrderLineItem).filter(models.SalesOrderLineItem.id == li.sales_order_line_item_id).first()
        if not so_line: raise ValueError(f"SO Line {li.sales_order_line_item_id} not found")
        
        if li.dispatched_qty > so_line.pending_qty:
            raise ValueError(f"Dispatch quantity exceeds pending quantity for item {li.item_id}")
            
        so_line.dispatched_qty += li.dispatched_qty
        so_line.pending_qty -= li.dispatched_qty
        
        # 2. Reduce Stock
        stock = db.query(models.InventoryStock).filter(
            models.InventoryStock.item_id == li.item_id,
            models.InventoryStock.warehouse_id == dc.warehouse_id
        ).first()
        
        if not stock: raise ValueError(f"No stock found for item {li.item_id}")
        if stock.current_stock < li.dispatched_qty:
            raise ValueError(f"Insufficient actual stock for item {li.item_id}")
            
        stock.current_stock -= li.dispatched_qty
        # Release the reservation that was created when SO was approved
        if stock.reserved_stock >= li.dispatched_qty:
            stock.reserved_stock -= li.dispatched_qty
        else:
            stock.reserved_stock = 0
            
        stock.available_stock = stock.current_stock - stock.reserved_stock
        
        # 3. Create Stock Ledger Transaction
        from backend.inventory_engine import log_inventory_movement
        from decimal import Decimal
        log_inventory_movement(
            db=db,
            item_id=li.item_id,
            warehouse_id=dc.warehouse_id,
            transaction_type="SALES_DISPATCH",
            qty=-li.dispatched_qty, # Negative for dispatch
            unit_cost=Decimal("0.0"),
            reference_type="DELIVERY_CHALLAN",
            reference_id=dc.id,
            user_id=user_id,
            remarks=f"Dispatched under DC {dc.dc_number}"
        )
        
        # 4. Create DC Line Item
        line = models.DeliveryChallanLineItem(
            dc_id=dc.id,
            **li.model_dump(exclude={'total'}),
            total=li.dispatched_qty * li.unit_price
        )
        db.add(line)
        
    # Update SO Status
    so = db.query(models.SalesOrder).filter(models.SalesOrder.id == dc_data.sales_order_id).first()
    pending = sum([l.pending_qty for l in so.line_items])
    if pending == 0:
        so.dispatch_status = 'DISPATCHED'
    else:
        so.dispatch_status = 'PARTIALLY_DISPATCHED'
        
    db.commit()
    db.refresh(dc)
    return dc
