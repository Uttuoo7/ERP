import logging
import uuid
from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from . import models
from .budget_engine import find_applicable_allocation, BudgetExceededException

logger = logging.getLogger(__name__)

def record_ledger_entry(db: Session, allocation_id: uuid.UUID, doc_type: str, doc_id: uuid.UUID, transition: str, amount: Decimal):
    entry = models.CommitmentLedgerEntry(
        allocation_id=allocation_id,
        document_type=doc_type,
        document_id=doc_id,
        transition_type=transition,
        amount=amount
    )
    db.add(entry)

def release_budget(db: Session, amount: float, context: Dict[str, Any], doc_type: str, doc_id: uuid.UUID):
    """Subtracts from pending approval amount (e.g. on PR rejection)"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    amt = Decimal(str(amount))
    allocation.consumption.pending_approval_amount -= amt
    if allocation.consumption.pending_approval_amount < 0:
        allocation.consumption.pending_approval_amount = Decimal("0.0")
    record_ledger_entry(db, allocation.id, doc_type, doc_id, "PLANNED_REVERSED", -amt)
    db.commit()

def transition_to_planned(db: Session, amount: float, context: Dict[str, Any], doc_type: str, doc_id: uuid.UUID):
    """PR Approved (Reserves budget) -> Planned"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    amt = Decimal(str(amount))
    allocation.consumption.pending_approval_amount += amt
    record_ledger_entry(db, allocation.id, doc_type, doc_id, "PLANNED", amt)
    db.commit()

def transition_planned_to_committed(db: Session, amount: float, context: Dict[str, Any], doc_type: str, doc_id: uuid.UUID):
    """PO Approved -> Committed (Moves from Planned)"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    amt = Decimal(str(amount))
    allocation.consumption.pending_approval_amount -= amt
    if allocation.consumption.pending_approval_amount < 0:
        allocation.consumption.pending_approval_amount = Decimal("0.0")
        
    allocation.consumption.committed_amount += amt
    record_ledger_entry(db, allocation.id, doc_type, doc_id, "PLANNED_TO_COMMITTED", amt)
    db.commit()

def transition_committed_to_accrued(db: Session, amount: float, context: Dict[str, Any], doc_type: str, doc_id: uuid.UUID):
    """GRN Created -> Accrued (Moves from Committed)"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    amt = Decimal(str(amount))
    allocation.consumption.committed_amount -= amt
    if allocation.consumption.committed_amount < 0:
        allocation.consumption.committed_amount = Decimal("0.0")
        
    allocation.consumption.accrued_amount += amt
    record_ledger_entry(db, allocation.id, doc_type, doc_id, "COMMITTED_TO_ACCRUED", amt)
    db.commit()

def transition_accrued_to_actual(db: Session, amount: float, context: Dict[str, Any], doc_type: str, doc_id: uuid.UUID):
    """Invoice Matched -> Actual (Moves from Accrued)"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    amt = Decimal(str(amount))
    allocation.consumption.accrued_amount -= amt
    if allocation.consumption.accrued_amount < 0:
        allocation.consumption.accrued_amount = Decimal("0.0")
        
    allocation.consumption.consumed_amount += amt
    record_ledger_entry(db, allocation.id, doc_type, doc_id, "ACCRUED_TO_ACTUAL", amt)
    db.commit()

def transition_actual_to_paid(db: Session, amount: float, context: Dict[str, Any], doc_type: str, doc_id: uuid.UUID):
    """Payment Allocation -> Paid (Moves from Actual)"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    amt = Decimal(str(amount))
    allocation.consumption.consumed_amount -= amt
    if allocation.consumption.consumed_amount < 0:
        allocation.consumption.consumed_amount = Decimal("0.0")
        
    allocation.consumption.paid_amount += amt
    record_ledger_entry(db, allocation.id, doc_type, doc_id, "ACTUAL_TO_PAID", amt)
    db.commit()
