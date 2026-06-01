from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies, ap_services, workflow_engine

router = APIRouter(
    prefix="/ap",
    tags=["Accounts Payable"],
    responses={404: {"description": "Not found"}},
)

@router.get("/vouchers", response_model=List[schemas.AccountsPayableResponse])
def get_ap_vouchers(
    vendor_id: uuid.UUID = None,
    status: str = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.AccountsPayable)
    if vendor_id:
        query = query.filter(models.AccountsPayable.vendor_id == vendor_id)
    if status:
        query = query.filter(models.AccountsPayable.payment_status == status)
    return query.order_by(models.AccountsPayable.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/generate/{invoice_id}", response_model=schemas.AccountsPayableResponse)
def generate_ap_from_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Triggers AP Voucher generation for an approved invoice.
    Normally this might be hooked directly into workflow_engine's finalize_invoice.
    """
    try:
        ap_voucher = ap_services.generate_ap_voucher(db, invoice_id)
        # Initialize AP workflow if necessary, but we auto-approved in the service
        return ap_voucher
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/mismatches", response_model=List[schemas.InvoiceMismatchResponse])
def get_mismatches(
    invoice_id: uuid.UUID = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.InvoiceMismatch)
    if invoice_id:
        query = query.filter(models.InvoiceMismatch.invoice_id == invoice_id)
    return query.all()
