from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, database
import uuid
import random

router = APIRouter()

def generate_grn_number():
    return f"GRN-{random.randint(1000, 99999)}"

@router.post("/", response_model=schemas.GoodsReceiptNoteResponse)
def create_grn(grn: schemas.GoodsReceiptNoteCreate, db: Session = Depends(database.get_db)):
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == grn.po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="PO not found")
        
    db_grn = models.GoodsReceiptNote(
        grn_number=generate_grn_number(),
        po_id=grn.po_id
    )
    db.add(db_grn)
    db.flush()
    
    all_fulfilled = True
    
    for req_item in grn.received_items:
        # Find PO line item
        po_line = db.query(models.POLineItem).filter(
            models.POLineItem.po_id == grn.po_id,
            models.POLineItem.item_id == req_item.item_id
        ).first()
        
        if not po_line:
            continue
            
        # Update PO line quantity_received
        po_line.quantity_received += req_item.quantity_accepted
        
        # Create GRN line items for accepted
        if req_item.quantity_accepted > 0:
            db_grn_line = models.GRNLineItem(
                grn_id=db_grn.id,
                po_line_item_id=po_line.id,
                quantity_received=req_item.quantity_accepted,
                is_quality_approved=True
            )
            db.add(db_grn_line)
            
            # Update Inventory Ledger
            ledger = db.query(models.InventoryLedger).filter(models.InventoryLedger.item_id == req_item.item_id).first()
            if not ledger:
                ledger = models.InventoryLedger(item_id=req_item.item_id, quantity_on_hand=req_item.quantity_accepted)
                db.add(ledger)
            else:
                ledger.quantity_on_hand += req_item.quantity_accepted
                
            # Create Transaction
            tx = models.InventoryTransaction(
                item_id=req_item.item_id,
                transaction_type="RECEIPT",
                quantity=req_item.quantity_accepted,
                reference_id=db_grn.id
            )
            db.add(tx)
    
    # Check all lines to see if PO is fulfilled
    db.flush()
    all_lines = db.query(models.POLineItem).filter(models.POLineItem.po_id == grn.po_id).all()
    for line in all_lines:
        if line.quantity_received < line.quantity_ordered:
            all_fulfilled = False
            break
            
    # Update PO Status
    if all_fulfilled:
        db_po.status = models.POStatus.FULFILLED
    else:
        db_po.status = models.POStatus.PARTIAL_RECEIPT
        
    db.commit()
    db.refresh(db_grn)
    return db_grn
