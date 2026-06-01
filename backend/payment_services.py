from sqlalchemy.orm import Session
from decimal import Decimal
import uuid
import logging

from . import models, numbering_engine, workflow_engine
from .ap_services import recalculate_vendor_running_balance

logger = logging.getLogger(__name__)

def execute_vendor_payment(db: Session, vendor_id: uuid.UUID, payment_method: str, amount: Decimal, allocations: list, current_user_id: uuid.UUID, **kwargs):
    """
    Executes a payment to a vendor, allocating it across multiple AP Vouchers.
    """
    if amount <= Decimal("0.0"):
        raise ValueError("Payment amount must be greater than zero.")
        
    # 1. Generate Payment Document
    pay_num = numbering_engine.generate_document_number(db, "PAY", models.VendorPayment, "payment_number")
    
    payment = models.VendorPayment(
        payment_number=pay_num,
        vendor_id=vendor_id,
        payment_method=payment_method,
        bank_name=kwargs.get("bank_name"),
        account_reference=kwargs.get("account_reference"),
        utr_number=kwargs.get("utr_number"),
        payment_amount=amount,
        narration=kwargs.get("narration"),
        approval_status="PENDING_APPROVAL", # Requires workflow approval before release
        created_by_id=current_user_id
    )
    db.add(payment)
    db.flush()
    
    total_allocated = Decimal("0.0")
    
    # 2. Process Allocations
    for alloc in allocations:
        ap_id = alloc.get("ap_id")
        alloc_amount = Decimal(str(alloc.get("amount", 0)))
        
        if alloc_amount <= 0:
            continue
            
        ap_voucher = db.query(models.AccountsPayable).filter(models.AccountsPayable.id == ap_id, models.AccountsPayable.vendor_id == vendor_id).first()
        if not ap_voucher:
            raise ValueError(f"AP Voucher {ap_id} not found or doesn't belong to vendor.")
            
        if alloc_amount > ap_voucher.balance_amount:
            raise ValueError(f"Allocation amount exceeds balance for AP {ap_voucher.ap_number}")
            
        # Create Allocation Record
        allocation_record = models.PaymentAllocation(
            payment_id=payment.id,
            accounts_payable_id=ap_id,
            allocated_amount=alloc_amount
        )
        db.add(allocation_record)
        
        # We don't deduct from balance_amount yet until payment is RELEASED.
        total_allocated += alloc_amount
        
    if total_allocated > amount:
        raise ValueError("Total allocated amount exceeds payment amount.")
        
    # Initialize workflow
    db.commit()
    workflow_engine.initialize_workflow("PAYMENT_VOUCHER", payment.id, db, context={"amount": float(amount)})
    
    return payment

def finalize_payment_release(db: Session, payment_id: uuid.UUID):
    """
    Triggered when a payment is fully approved. Releases funds, updates AP balances, and hits vendor ledger.
    """
    payment = db.query(models.VendorPayment).filter(models.VendorPayment.id == payment_id).first()
    if not payment:
        raise ValueError("Payment not found")
        
    if payment.approval_status != "APPROVED":
        raise ValueError("Payment must be APPROVED to release funds.")
        
    # 1. Update AP Vouchers
    allocations = db.query(models.PaymentAllocation).filter(models.PaymentAllocation.payment_id == payment.id).all()
    for alloc in allocations:
        ap = alloc.accounts_payable
        ap.paid_amount += alloc.allocated_amount
        ap.balance_amount -= alloc.allocated_amount
        
        if ap.balance_amount <= 0:
            ap.payment_status = "PAID"
        elif ap.paid_amount > 0:
            ap.payment_status = "PARTIALLY_PAID"
            
    # 2. Post to Vendor Ledger (Debit reduces liability)
    ledger_entry = models.VendorLedger(
        vendor_id=payment.vendor_id,
        transaction_type="PAYMENT",
        reference_type="PAYMENT",
        reference_id=payment.id,
        debit_amount=payment.payment_amount,
        remarks=f"Payment via {payment.payment_method} - Ref: {payment.payment_number}"
    )
    db.add(ledger_entry)
    
    payment.approval_status = "RELEASED"
    
    # Recalculate running balance
    recalculate_vendor_running_balance(db, payment.vendor_id)
    
    db.commit()
    return payment
