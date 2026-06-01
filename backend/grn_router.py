from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid
import logging

from . import models, schemas, database, dependencies, workflow_engine, numbering_engine, inventory_services

logger = logging.getLogger(__name__)

router = APIRouter(
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.GoodsReceiptNoteResponse])
def get_grns(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.GoodsReceiptNote).offset(skip).limit(limit).all()

@router.get("/{grn_id}", response_model=schemas.GoodsReceiptNoteResponse)
def get_grn(
    grn_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    grn = db.query(models.GoodsReceiptNote).filter(models.GoodsReceiptNote.id == grn_id).first()
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    return grn

@router.post("/", response_model=schemas.GoodsReceiptNoteResponse)
def create_grn(
    grn_in: schemas.GoodsReceiptNoteCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == grn_in.po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
        
    grn_number = numbering_engine.generate_document_number(db, "GRN", models.GoodsReceiptNote, "grn_number")
    
    grn = models.GoodsReceiptNote(
        grn_number=grn_number,
        po_id=grn_in.po_id,
        vendor_id=po.vendor_id,
        warehouse_id=grn_in.warehouse_id,
        delivery_challan_number=grn_in.delivery_challan_number,
        vehicle_number=grn_in.vehicle_details,
        status="DRAFT",
        received_by_id=current_user.id
    )
    db.add(grn)
    db.flush()
    
    for pol in po.line_items:
        if pol.remaining_quantity <= 0:
            continue
            
        grn_line = models.GRNLineItem(
            grn_id=grn.id,
            po_line_item_id=pol.id,
            item_id=pol.item_id,
            quantity_ordered=pol.quantity_ordered,
            previously_received_qty=pol.quantity_received,
            unit_price=pol.unit_price,
            gst_percent=pol.item.gst_rate if pol.item and pol.item.gst_rate else 0.0
        )
        db.add(grn_line)
        
    db.commit()
    db.refresh(grn)
    return grn

@router.post("/{grn_id}/submit")
def submit_grn_for_approval(
    grn_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Submits GRN for workflow approval. Auto-approves if no steps."""
    grn = db.query(models.GoodsReceiptNote).filter(models.GoodsReceiptNote.id == grn_id).first()
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
        
    if grn.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT GRNs can be submitted")
        
    grn.status = "PENDING_APPROVAL"
    db.commit()
    
    workflow_engine.initialize_workflow("GOODS_RECEIPT_NOTE", grn.id, db, context={"total": float(grn.subtotal)})
    
    return {"message": "GRN submitted for approval"}

@router.post("/{grn_id}/accept")
def accept_and_process_grn(
    grn_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Processes the accepted quantities, triggers stock ledger updates, and updates PO."""
    grn = db.query(models.GoodsReceiptNote).filter(models.GoodsReceiptNote.id == grn_id).first()
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
        
    if grn.status not in ["APPROVED", "QC_PENDING", "PARTIAL"]:
        raise HTTPException(status_code=400, detail="GRN must be APPROVED before acceptance")
        
    try:
        inventory_services.process_grn_acceptance(db, grn, current_user.id)
    except Exception as e:
        logger.error(f"Error processing GRN acceptance: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
        
    return {"message": "GRN successfully accepted and inventory updated."}

@router.put("/{grn_id}/lines/{line_id}", response_model=schemas.GRNLineItemResponse)
def update_grn_line(
    grn_id: uuid.UUID,
    line_id: uuid.UUID,
    accepted_qty: int,
    rejected_qty: int = 0,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Updates the received/accepted/rejected quantities for a specific GRN line before acceptance."""
    line = db.query(models.GRNLineItem).filter(models.GRNLineItem.id == line_id, models.GRNLineItem.grn_id == grn_id).first()
    if not line:
        raise HTTPException(status_code=404, detail="GRN Line not found")
        
    line.accepted_qty = accepted_qty
    line.rejected_qty = rejected_qty
    line.quantity_received = accepted_qty + rejected_qty
    db.commit()
    db.refresh(line)
    return line
