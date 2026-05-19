from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, database, dependencies
import uuid
import random

router = APIRouter()

def generate_po_number():
    return f"PO-{random.randint(1000, 99999)}"

@router.post("/", response_model=schemas.PurchaseOrderResponse)
def create_purchase_order(po: schemas.PurchaseOrderCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.BUYER]))):
    # Calculate total
    total_amount = sum(item.quantity_ordered * item.unit_price for item in po.line_items)
    
    po_data = po.model_dump(exclude={"line_items", "total_amount", "po_number"})
    
    db_po = models.PurchaseOrder(
        **po_data,
        po_number=po.po_number or generate_po_number(),
        total_amount=total_amount,
        status=models.POStatus.DRAFT
    )
    db.add(db_po)
    db.flush() # Get po.id
    
    for item in po.line_items:
        db_line_item = models.POLineItem(
            po_id=db_po.id,
            item_id=item.item_id,
            quantity_ordered=item.quantity_ordered,
            unit_price=item.unit_price
        )
        db.add(db_line_item)
        
    db.commit()
    db.refresh(db_po)
    return db_po

@router.get("/", response_model=List[schemas.PurchaseOrderResponse])
def get_purchase_orders(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return db.query(models.PurchaseOrder).offset(skip).limit(limit).all()

@router.get("/{po_id}", response_model=schemas.PurchaseOrderResponse)
def get_purchase_order(po_id: uuid.UUID, db: Session = Depends(database.get_db)):
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    return db_po

@router.patch("/{po_id}/issue", response_model=schemas.PurchaseOrderResponse)
def issue_purchase_order(po_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.BUYER]))):
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    if db_po.status != models.POStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only DRAFT POs can be issued")
        
    db_po.status = models.POStatus.ISSUED
    db.commit()
    db.refresh(db_po)
    return db_po

@router.put("/{po_id}", response_model=schemas.PurchaseOrderResponse)
def full_update_purchase_order(po_id: uuid.UUID, po: schemas.PurchaseOrderUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.BUYER, models.Role.ADMIN]))):
    with db.begin():
        db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
        if not db_po:
            raise HTTPException(status_code=404, detail="Purchase Order not found")
        
        if db_po.status != models.POStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Only DRAFT POs can be fully edited")
        
        po_data = po.model_dump(exclude={"line_items", "total_amount"})
        for key, value in po_data.items():
            setattr(db_po, key, value)
        
        # Replace line items
        db.query(models.POLineItem).filter(models.POLineItem.po_id == po_id).delete()
        
        total_amount = Decimal(0)
        for item in po.line_items:
            db_line_item = models.POLineItem(
                po_id=db_po.id,
                item_id=item.item_id,
                quantity_ordered=item.quantity_ordered,
                unit_price=item.unit_price,
                description=item.description
            )
            total_amount += (item.quantity_ordered * item.unit_price)
            db.add(db_line_item)
        
        db_po.total_amount = total_amount
        db.refresh(db_po)
        return db_po

@router.patch("/{po_id}", response_model=schemas.PurchaseOrderResponse)
def update_purchase_order(po_id: uuid.UUID, vendor_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.BUYER, models.Role.ADMIN]))):
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    if db_po.status != models.POStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only DRAFT POs can be edited")
        
    db_po.vendor_id = vendor_id
    db.commit()
    db.refresh(db_po)
    return db_po
