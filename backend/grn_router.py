import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import database, dependencies, models, schemas, grn_services

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[schemas.GoodsReceiptNoteResponse])
def get_goods_receipt_notes(
    po_id: Optional[uuid.UUID] = None,
    vendor_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.GoodsReceiptNote)
    if po_id:
        query = query.filter(models.GoodsReceiptNote.po_id == po_id)
    if vendor_id:
        query = query.filter(models.GoodsReceiptNote.vendor_id == vendor_id)
    if status_filter:
        query = query.filter(models.GoodsReceiptNote.status == status_filter)
        
    return query.order_by(models.GoodsReceiptNote.receipt_date.desc()).all()

@router.get("/{id}", response_model=schemas.GoodsReceiptNoteResponse)
def get_goods_receipt_note(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    grn = db.query(models.GoodsReceiptNote).filter(models.GoodsReceiptNote.id == id).first()
    if not grn:
        raise HTTPException(status_code=404, detail="Goods Receipt Note not located.")
    return grn

@router.post("/convert-po", response_model=schemas.GoodsReceiptNoteResponse, status_code=status.HTTP_201_CREATED)
def convert_po_to_grn_draft_api(
    payload: schemas.GoodsReceiptNoteCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.WAREHOUSE]))
):
    """
    Receiving Gate: Converts PO into a draft GRN unloading challan list.
    """
    try:
        grn = grn_services.convert_po_to_grn_draft(
            db=db,
            po_id=payload.po_id,
            warehouse_id=payload.warehouse_id,
            challan_no=payload.delivery_challan_number,
            vehicle_details=payload.vehicle_details,
            received_items=payload.received_items,
            user_id=current_user.id,
            remarks=payload.remarks
        )
        return grn
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"PO received draft error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal error generating receiving challan draft.")

@router.post("/{id}/qc-submit", response_model=schemas.GoodsReceiptNoteResponse)
def submit_grn_qc_inspection_api(
    id: uuid.UUID,
    payload: schemas.GRNQCInspect,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.WAREHOUSE]))
):
    """
    QC Gate: Reconciles counts, adjusts stock ledgers, and registers serial lot batches.
    """
    try:
        grn = grn_services.submit_qc_inspection(
            db=db,
            grn_id=id,
            qc_items=payload.qc_items,
            inspector_id=current_user.id,
            remarks=payload.remarks
        )
        return grn
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"QC inspect error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal error during Quality Control submission.")
