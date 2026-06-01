from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List
from datetime import datetime

def recalculate_customer_running_balance(db: Session, customer_id: uuid.UUID):
    entries = db.query(models.CustomerLedger).filter(
        models.CustomerLedger.customer_id == customer_id
    ).order_by(models.CustomerLedger.created_at.asc()).all()
    
    balance = 0.0
    for e in entries:
        # AR is a debit balance (they owe us). So INVOICE (Debit) increases balance, PAYMENT (Credit) decreases balance.
        balance += float(e.debit_amount) - float(e.credit_amount)
        e.running_balance = balance
        
    db.commit()

def generate_ar_from_so(db: Session, so_id: uuid.UUID) -> models.AccountsReceivable:
    so = db.query(models.SalesOrder).filter(models.SalesOrder.id == so_id).first()
    if not so: raise ValueError("SO not found")
    
    ar = models.AccountsReceivable(
        ar_number=f"AR-{uuid.uuid4().hex[:6].upper()}",
        customer_id=so.customer_id,
        invoice_amount=so.total_amount,
        balance_amount=so.total_amount,
        due_date=so.delivery_date # For simplicity
    )
    db.add(ar)
    db.flush()
    
    # Ledger entry for Invoice (Debit)
    ledger = models.CustomerLedger(
        customer_id=so.customer_id,
        transaction_type="INVOICE",
        reference_type="SALES_ORDER",
        reference_id=so.id,
        debit_amount=so.total_amount,
        running_balance=0.0 # Will be recalculated
    )
    db.add(ledger)
    db.commit()
    
    recalculate_customer_running_balance(db, so.customer_id)
    return ar

def process_customer_payment(db: Session, payment_data: schemas.CustomerPaymentCreate) -> models.CustomerPayment:
    payment = models.CustomerPayment(
        payment_number=f"CPAY-{uuid.uuid4().hex[:6].upper()}",
        customer_id=payment_data.customer_id,
        payment_method=payment_data.payment_method,
        bank_reference=payment_data.bank_reference,
        amount=payment_data.amount
    )
    db.add(payment)
    db.flush()
    
    # Allocate against AR
    for alloc in payment_data.allocations:
        ar = db.query(models.AccountsReceivable).filter(models.AccountsReceivable.id == alloc['ar_id']).first()
        if ar:
            ar.received_amount += alloc['amount']
            ar.balance_amount -= alloc['amount']
            if ar.balance_amount <= 0:
                ar.payment_status = 'PAID'
            else:
                ar.payment_status = 'PARTIALLY_RECEIVED'
                
            db.add(models.CustomerPaymentAllocation(
                payment_id=payment.id,
                ar_id=ar.id,
                allocated_amount=alloc['amount']
            ))
            
    # Ledger entry for Payment (Credit)
    ledger = models.CustomerLedger(
        customer_id=payment_data.customer_id,
        transaction_type="PAYMENT",
        reference_type="CUSTOMER_PAYMENT",
        reference_id=payment.id,
        credit_amount=payment_data.amount,
        running_balance=0.0
    )
    db.add(ledger)
    db.commit()
    
    recalculate_customer_running_balance(db, payment_data.customer_id)
    return payment
