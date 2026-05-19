from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, database
import uuid

router = APIRouter()

@router.post("/", response_model=schemas.InvoiceResponse)
def create_invoice(invoice_req: schemas.InvoiceCreateRequest, db: Session = Depends(database.get_db)):
    db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == invoice_req.po_id).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="PO not found")
        
    total_amount = sum(item.quantity_billed * item.unit_price for item in invoice_req.billed_items)
    
    db_invoice = models.Invoice(
        invoice_number=invoice_req.invoice_number,
        po_id=db_po.id,
        vendor_id=db_po.vendor_id,
        total_amount=total_amount,
        gst_amount=invoice_req.gst_amount,
        tds_deducted=invoice_req.tds_deducted,
        status=models.InvoiceStatus.PENDING
    )
    db.add(db_invoice)
    db.flush()
    
    has_discrepancy = False
    
    for billed in invoice_req.billed_items:
        po_line = db.query(models.POLineItem).filter(
            models.POLineItem.po_id == db_po.id,
            models.POLineItem.item_id == billed.item_id
        ).first()
        
        if not po_line:
            has_discrepancy = True
            continue
            
        # Match Algorithm
        # Check 1: quantity_billed <= quantity_received (accepted from GRN)
        if billed.quantity_billed > po_line.quantity_received:
            has_discrepancy = True
            
        # Check 2: unit_price <= PO unit_price
        if billed.unit_price > po_line.unit_price:
            has_discrepancy = True
            
        po_line.quantity_billed += billed.quantity_billed
            
        db_inv_line = models.InvoiceLineItem(
            invoice_id=db_invoice.id,
            po_line_item_id=po_line.id,
            quantity_billed=billed.quantity_billed,
            unit_price=billed.unit_price
        )
        db.add(db_inv_line)
        
    if has_discrepancy:
        db_invoice.status = models.InvoiceStatus.DISCREPANCY
    else:
        db_invoice.status = models.InvoiceStatus.MATCHED
        
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

@router.get("/", response_model=List[schemas.InvoiceResponse])
def get_invoices(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return db.query(models.Invoice).offset(skip).limit(limit).all()
