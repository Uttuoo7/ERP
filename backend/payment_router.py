from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import uuid
from decimal import Decimal
import logging

from . import models, schemas, database, dependencies, payment_services, workflow_engine, finance_engine

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="",
    tags=["Vendor Payments"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.VendorPaymentResponse])
def get_payments(
    vendor_id: uuid.UUID = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.VendorPayment)
    if vendor_id:
        query = query.filter(models.VendorPayment.vendor_id == vendor_id)
    return query.order_by(models.VendorPayment.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/execute", response_model=schemas.VendorPaymentResponse)
def execute_payment(
    payment_in: schemas.VendorPaymentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        payment = payment_services.execute_vendor_payment(
            db=db,
            vendor_id=payment_in.vendor_id,
            payment_method=payment_in.payment_method,
            amount=payment_in.payment_amount,
            allocations=payment_in.allocations,
            current_user_id=current_user.id,
            bank_name=payment_in.bank_name,
            account_reference=payment_in.account_reference,
            narration=payment_in.narration
        )
        return payment
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/", status_code=status.HTTP_201_CREATED)
def record_payment_custom_api(
    payload: dict,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    AP Payment Entry:
    Records a payment to a vendor, offsets outstanding vendor liabilities,
    posts balanced journal debits/credits to GL accounts, and syncs with Tally.
    """
    try:
        vendor_id = uuid.UUID(payload.get("vendor_id"))
        amount = Decimal(str(payload.get("amount") or payload.get("total_paid_amount") or 0))
        payment_method = payload.get("payment_method", "NEFT")
        ref_no = payload.get("reference_number") or payload.get("ref_no") or f"TXN-{uuid.uuid4().hex[:6].upper()}"
        
        raw_allocations = payload.get("allocations") or payload.get("invoice_allocations") or []
        
        invoice_allocations = []
        for alloc in raw_allocations:
            liability_id = alloc.get("vendor_liability_id")
            if liability_id:
                liability_id = uuid.UUID(str(liability_id))
            else:
                inv_id_str = alloc.get("invoice_id")
                if inv_id_str:
                    inv_id = uuid.UUID(str(inv_id_str))
                    # Query matching vendor liability
                    liab = db.query(models.VendorLiability).filter(
                        models.VendorLiability.invoice_id == inv_id
                    ).first()
                    if liab:
                        liability_id = liab.id
                    else:
                        # Fallback query: search by total amount or vendor
                        liab = db.query(models.VendorLiability).filter(
                            models.VendorLiability.vendor_id == vendor_id,
                            models.VendorLiability.status == "UNPAID"
                        ).first()
                        if liab:
                            liability_id = liab.id
            
            allocated_amount = Decimal(str(alloc.get("allocated_amount") or alloc.get("amount") or 0))
            if liability_id:
                invoice_allocations.append(
                    schemas.InvoiceAllocationCreate(
                        vendor_liability_id=liability_id,
                        allocated_amount=allocated_amount
                    )
                )

        tx = finance_engine.record_vendor_payment(
            db=db,
            vendor_id=vendor_id,
            amount=amount,
            payment_method=payment_method,
            ref_no=ref_no,
            invoice_allocations=invoice_allocations,
            user_id=current_user.id
        )
        return {"status": "success", "transaction_number": tx.transaction_number, "id": str(tx.id)}
    except ValueError as e:
        logger.error(f"Validation error recording payment: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        logger.error(f"Record payment error: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Database payment logging failure: {str(e)}")
