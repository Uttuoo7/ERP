import uuid
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import database, dependencies, models, schemas
from .services import PurchaseOrderService
from backend.core.exceptions import ErpException

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[schemas.PurchaseOrderResponse])
def get_purchase_orders(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return PurchaseOrderService.get_purchase_orders(db, search, status_filter)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.get("/{id}", response_model=schemas.PurchaseOrderResponse)
def get_purchase_order_details(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return PurchaseOrderService.get_purchase_order_details(db, id)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.post("/convert-rfq", response_model=schemas.PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def convert_rfq_to_po(
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    RFQ to PO Conversion Engine: Transforms won vendor quotations into POs.
    Performs quantity over-ordering checks, resolves totals, and establishes dynamic traceability.
    """
    try:
        return PurchaseOrderService.convert_rfq_to_po(
            db=db,
            payload=payload,
            user_id=current_user.id,
            username=current_user.username
        )
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.post("/{id}/submit", response_model=schemas.PurchaseOrderResponse)
def submit_purchase_order(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Submits PO to dynamic approvals workflow engine.
    """
    try:
        return PurchaseOrderService.submit_purchase_order(db, id, current_user.id)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.post("/{id}/amend", response_model=schemas.PurchaseOrderResponse)
def amend_purchase_order(
    id: uuid.UUID,
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    PO Revisions Console: Serializes current state, saves snapshot log, reverts status to DRAFT.
    """
    try:
        return PurchaseOrderService.amend_purchase_order(db, id, payload, current_user.id)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.get("/{id}/amendments", response_model=List[schemas.POAmendmentResponse])
def get_po_amendment_histories(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return PurchaseOrderService.get_po_amendment_histories(db, id)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.put("/{id}", response_model=schemas.PurchaseOrderResponse)
def update_purchase_order(
    id: uuid.UUID,
    payload: schemas.PurchaseOrderUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Saves inline changes to PO header and line items during DRAFT / Re-amended states.
    """
    try:
        return PurchaseOrderService.update_purchase_order(db, id, payload, current_user.id)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
