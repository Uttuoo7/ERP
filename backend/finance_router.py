import uuid
import logging
from datetime import datetime, timedelta
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


@router.get('/vendor-ledger/{vendor_id}', response_model=List[schemas.VendorLedgerResponse])
def get_vendor_ledger(
    vendor_id: uuid.UUID,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    '''Returns the immutable vendor ledger entries for statement generation.'''
    return db.query(models.VendorLedger).filter(models.VendorLedger.vendor_id == vendor_id)\
             .order_by(models.VendorLedger.created_at.desc()).offset(skip).limit(limit).all()

@router.get('/aging-report')
def get_aging_report(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    '''
    Returns payable amounts bucketed by aging:
    0-30 days, 31-60 days, 61-90 days, 90+ days.
    '''
    now = datetime.utcnow()
    vouchers = db.query(models.AccountsPayable).filter(
        models.AccountsPayable.payment_status.in_(['PENDING', 'PARTIALLY_PAID', 'OVERDUE'])
    ).all()
    
    buckets = {
        '0-30': 0.0,
        '31-60': 0.0,
        '61-90': 0.0,
        '90+': 0.0
    }
    
    vendor_exposure = {}
    
    for v in vouchers:
        balance = float(v.balance_amount)
        if balance <= 0: continue
            
        due_date = v.due_date if v.due_date else v.created_at + timedelta(days=30)
        days_overdue = (now - due_date).days
        
        if days_overdue <= 30:
            buckets['0-30'] += balance
        elif days_overdue <= 60:
            buckets['31-60'] += balance
        elif days_overdue <= 90:
            buckets['61-90'] += balance
        else:
            buckets['90+'] += balance
            
        # Aggregate by vendor
        v_id = str(v.vendor_id)
        if v_id not in vendor_exposure:
            vendor_exposure[v_id] = {'name': v.vendor.name if v.vendor else 'Unknown', 'total_due': 0.0}
        vendor_exposure[v_id]['total_due'] += balance

    return {
        'buckets': buckets,
        'total_liability': sum(buckets.values()),
        'top_vendors': sorted(vendor_exposure.values(), key=lambda x: x['total_due'], reverse=True)[:5]
    }

