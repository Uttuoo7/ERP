from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, database, dependencies
import uuid
import random

router = APIRouter()

def generate_so_number():
    return f"SO-{random.randint(1000, 99999)}"

def generate_po_number():
    return f"PO-{random.randint(1000, 99999)}"

@router.post("/", response_model=schemas.InternalSalesOrderResponse)
def create_sales_order(so: schemas.InternalSalesOrderCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    db_so = models.InternalSalesOrder(
        so_number=so.so_number or generate_so_number(),
        requester_id=current_user.id,
        status="DRAFT",
        delivery_type=so.delivery_type,
        warehouse_id=so.warehouse_id,
        ship_to_contact_name=so.ship_to_contact_name,
        ship_to_company_name=so.ship_to_company_name,
        ship_to_address_line1=so.ship_to_address_line1,
        ship_to_address_line2=so.ship_to_address_line2,
        ship_to_landmark=so.ship_to_landmark,
        ship_to_city=so.ship_to_city,
        ship_to_state=so.ship_to_state,
        ship_to_phone=so.ship_to_phone,
        updated_by_id=current_user.id
    )
    db.add(db_so)
    db.flush()

    for item in so.line_items:
        db_line_item = models.SOLineItem(
            so_id=db_so.id,
            item_id=item.item_id,
            quantity=item.quantity,
            notes=item.notes
        )
        db.add(db_line_item)
        
    db.commit()
    db.refresh(db_so)
    return db_so

@router.get("/", response_model=List[schemas.InternalSalesOrderResponse])
def get_sales_orders(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return db.query(models.InternalSalesOrder).offset(skip).limit(limit).all()

@router.get("/{so_id}", response_model=schemas.InternalSalesOrderResponse)
def get_sales_order(so_id: uuid.UUID, db: Session = Depends(database.get_db)):
    db_so = db.query(models.InternalSalesOrder).filter(models.InternalSalesOrder.id == so_id).first()
    if not db_so:
        raise HTTPException(status_code=404, detail="Sales Order not found")
    return db_so

@router.put("/{so_id}", response_model=schemas.InternalSalesOrderResponse)
def update_sales_order(so_id: uuid.UUID, so: schemas.InternalSalesOrderUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    with db.begin():
        db_so = db.query(models.InternalSalesOrder).filter(models.InternalSalesOrder.id == so_id).first()
        if not db_so:
            raise HTTPException(status_code=404, detail="Sales Order not found")
        
        if db_so.status == "CONVERTED":
            raise HTTPException(status_code=400, detail="Cannot edit a converted Sales Order")
        
        if db_so.status == "APPROVED" and current_user.role not in [models.Role.ADMIN, models.Role.BUYER]:
            raise HTTPException(status_code=403, detail="Only ADMIN or BUYER can edit an APPROVED Sales Order")
        
        if db_so.status == "DRAFT" and db_so.requester_id != current_user.id and current_user.role not in [models.Role.ADMIN, models.Role.BUYER]:
            raise HTTPException(status_code=403, detail="You can only edit your own DRAFT Requisitions")
        
        so_data = so.model_dump(exclude={"line_items"})
        for key, value in so_data.items():
            setattr(db_so, key, value)
        
        # Replace line items
        db.query(models.SOLineItem).filter(models.SOLineItem.so_id == so_id).delete()
        for item in so.line_items:
            db_line_item = models.SOLineItem(
                so_id=db_so.id,
                item_id=item.item_id,
                quantity=item.quantity,
                notes=item.notes
            )
            db.add(db_line_item)
        
        db_so.updated_by_id = current_user.id
        db.refresh(db_so)
        return db_so

@router.patch("/{so_id}/approve", response_model=schemas.InternalSalesOrderResponse)
def approve_sales_order(so_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.BUYER]))):
    db_so = db.query(models.InternalSalesOrder).filter(models.InternalSalesOrder.id == so_id).first()
    if not db_so:
        raise HTTPException(status_code=404, detail="Sales Order not found")
    if db_so.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT SOs can be approved")
    
    db_so.status = "APPROVED"
    db.commit()
    db.refresh(db_so)
    return db_so

@router.post("/{so_id}/convert-to-po", response_model=schemas.PurchaseOrderResponse)
def convert_to_po(so_id: uuid.UUID, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.BUYER, models.Role.ADMIN]))):
    db_so = db.query(models.InternalSalesOrder).filter(models.InternalSalesOrder.id == so_id).first()
    if not db_so:
        raise HTTPException(status_code=404, detail="Sales Order not found")
    
    if db_so.status != "APPROVED":
        raise HTTPException(status_code=400, detail="Only APPROVED Sales Orders can be converted to Purchase Orders")

    db_po = models.PurchaseOrder(
        po_number=generate_po_number(),
        vendor_id=None,
        source_so_id=db_so.id,
        status=models.POStatus.DRAFT,
        delivery_type=db_so.delivery_type,
        warehouse_id=db_so.warehouse_id,
        ship_to_contact_name=db_so.ship_to_contact_name,
        ship_to_company_name=db_so.ship_to_company_name,
        ship_to_address_line1=db_so.ship_to_address_line1,
        ship_to_address_line2=db_so.ship_to_address_line2,
        ship_to_landmark=db_so.ship_to_landmark,
        ship_to_city=db_so.ship_to_city,
        ship_to_state=db_so.ship_to_state,
        ship_to_pin_code=db_so.ship_to_pin_code,
        ship_to_phone=db_so.ship_to_phone,
        total_amount=0 # Will calculate
    )
    db.add(db_po)
    db.flush()

    total_amount = 0
    for so_line in db_so.line_items:
        # Fetch the item to get the latest unit price
        db_item = db.query(models.Item).filter(models.Item.id == so_line.item_id).first()
        unit_price = db_item.unit_price if db_item else 0

        po_line = models.POLineItem(
            po_id=db_po.id,
            item_id=so_line.item_id,
            quantity_ordered=so_line.quantity,
            unit_price=unit_price,
            description=so_line.notes
        )
        total_amount += (so_line.quantity * unit_price)
        db.add(po_line)
    
    db_po.total_amount = total_amount
    db_so.status = "CONVERTED"
    
    db.commit()
    db.refresh(db_po)
    return db_po
