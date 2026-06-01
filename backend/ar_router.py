from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies, ar_services

router = APIRouter(
    prefix="/receivables",
    tags=["Accounts Receivable"],
    responses={404: {"description": "Not found"}},
)

@router.post("/invoices/from-so/{so_id}", response_model=schemas.AccountsReceivableResponse)
def generate_invoice_from_so(
    so_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return ar_services.generate_ar_from_so(db, so_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/payments")
def process_payment(
    payment: schemas.CustomerPaymentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    p = ar_services.process_customer_payment(db, payment)
    return {"id": p.id, "payment_number": p.payment_number, "status": p.status}

@router.get("/ledger/{customer_id}", response_model=List[schemas.CustomerLedgerResponse])
def get_customer_ledger(
    customer_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.CustomerLedger).filter(models.CustomerLedger.customer_id == customer_id)\
             .order_by(models.CustomerLedger.created_at.desc()).all()
