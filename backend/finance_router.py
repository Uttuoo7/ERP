import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import database, dependencies, models, schemas, finance_engine, tally_sync

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/liabilities", response_model=List[schemas.VendorLiabilityResponse])
def get_vendor_liabilities(
    vendor_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.VendorLiability)
    if vendor_id:
        query = query.filter(models.VendorLiability.vendor_id == vendor_id)
    if status_filter:
        query = query.filter(models.VendorLiability.status == status_filter)
    return query.order_by(models.VendorLiability.due_date.asc()).all()

@router.get("/aging", response_model=List[schemas.LiabilityAgingSummary])
def get_payables_aging(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return finance_engine.calculate_payables_aging(db)

@router.get("/ledger", response_model=List[schemas.FinancialTransactionResponse])
def get_financial_ledger(
    transaction_type: Optional[str] = None,
    vendor_id: Optional[uuid.UUID] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.FinancialTransaction)
    if transaction_type:
        query = query.filter(models.FinancialTransaction.transaction_type == transaction_type)
    if vendor_id:
        query = query.filter(models.FinancialTransaction.vendor_id == vendor_id)
    return query.order_by(models.FinancialTransaction.transaction_date.desc()).all()

@router.get("/tally/queue", response_model=List[schemas.TallySyncQueueResponse])
def get_tally_sync_queue(
    sync_status: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.TallySyncQueue)
    if sync_status:
        query = query.filter(models.TallySyncQueue.sync_status == sync_status)
    return query.order_by(models.TallySyncQueue.id.desc()).all()

@router.post("/tally/sync-all")
def process_tally_synchronization(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    try:
        results = tally_sync.process_sync_queue(db)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/payments", response_model=schemas.FinancialTransactionResponse, status_code=status.HTTP_201_CREATED)
def record_payment_api(
    payload: schemas.VendorPaymentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    try:
        tx = finance_engine.record_vendor_payment(
            db=db,
            vendor_id=payload.vendor_id,
            amount=payload.amount,
            payment_method=payload.payment_method,
            ref_no=payload.reference_number,
            invoice_allocations=payload.invoice_allocations,
            user_id=current_user.id
        )
        return tx
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Record payment error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal operational database payment logging failure.")

@router.post("/invoices/{id}/post-voucher", response_model=schemas.FinancialTransactionResponse)
def approve_and_post_ap_invoice_voucher_api(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    """
    AP Post: Approves an operational invoice, runs 3-way matching checks,
    creates balanced bookkeeping journals, and enqueues sync tasks.
    """
    try:
        tx = finance_engine.create_ap_invoice_voucher(
            db=db,
            invoice_id=id,
            user_id=current_user.id
        )
        return tx
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"AP Invoice voucher posting error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal operational ledger posting failure.")
