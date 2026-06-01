import logging
import uuid
from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from . import models
from .core.exceptions import ErpException

logger = logging.getLogger(__name__)

class BudgetExceededException(ErpException):
    def __init__(self, message: str, limit_type: str, allocation_id: uuid.UUID):
        super().__init__(message=message, status_code=400)
        self.limit_type = limit_type
        self.allocation_id = allocation_id

def find_applicable_allocation(db: Session, context: Dict[str, Any]) -> Optional[models.BudgetAllocation]:
    """
    Resolves the most specific budget allocation matching the given context.
    Context can contain: department_id, category_id, project_id, cost_center_id, branch_id
    """
    query = db.query(models.BudgetAllocation).join(models.BudgetMaster).filter(
        models.BudgetMaster.status == "ACTIVE"
    )
    
    # Simple strict matching for now: find exact match for provided dimensions
    dept_id = context.get("department_id")
    cat_id = context.get("category_id")
    proj_id = context.get("project_id")
    
    # We prioritize finding an allocation that matches the most specific dimension provided
    if proj_id:
        alloc = query.filter(models.BudgetAllocation.project_id == proj_id).first()
        if alloc: return alloc
        
    if cat_id:
        alloc = query.filter(models.BudgetAllocation.category_id == cat_id).first()
        if alloc: return alloc
        
    if dept_id:
        alloc = query.filter(models.BudgetAllocation.department_id == dept_id).first()
        if alloc: return alloc
        
    return None

def evaluate_transaction(db: Session, amount: float, context: Dict[str, Any]):
    """
    Checks if a requested amount breaches any budget limits.
    Raises BudgetExceededException if hard limit is breached.
    Returns {"status": "WARNING", "message": "..."} if soft limit breached.
    Returns {"status": "OK"} otherwise.
    """
    allocation = find_applicable_allocation(db, context)
    if not allocation:
        return {"status": "OK", "message": "No active budget restrictions."}
        
    consumption = allocation.consumption
    total_utilized = consumption.pending_approval_amount + consumption.committed_amount + consumption.consumed_amount
    proposed_total = total_utilized + Decimal(str(amount))
    
    utilization_percent = (proposed_total / allocation.allocated_amount) * 100
    
    if utilization_percent > allocation.hard_limit_percent:
        msg = f"Transaction amount exceeds hard limit for Budget Allocation. Limit: {allocation.hard_limit_percent}%, Proposed: {utilization_percent:.1f}%"
        logger.warning(msg)
        raise BudgetExceededException(msg, "HARD", allocation.id)
        
    if utilization_percent > allocation.soft_limit_percent:
        msg = f"Warning: Transaction amount exceeds soft limit. Limit: {allocation.soft_limit_percent}%, Proposed: {utilization_percent:.1f}%"
        logger.info(msg)
        return {"status": "WARNING", "message": msg, "allocation_id": allocation.id}
        
    return {"status": "OK", "allocation_id": allocation.id}

def reserve_budget(db: Session, amount: float, context: Dict[str, Any]):
    """Adds to pending approval amount"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    allocation.consumption.pending_approval_amount += Decimal(str(amount))
    db.commit()

def release_budget(db: Session, amount: float, context: Dict[str, Any]):
    """Subtracts from pending approval amount (e.g. on PR rejection)"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    allocation.consumption.pending_approval_amount -= Decimal(str(amount))
    if allocation.consumption.pending_approval_amount < 0:
        allocation.consumption.pending_approval_amount = Decimal("0.0")
    db.commit()

def commit_spend(db: Session, amount: float, context: Dict[str, Any]):
    """Moves amount from pending to committed (e.g. on PO approval)"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    amt = Decimal(str(amount))
    allocation.consumption.pending_approval_amount -= amt
    if allocation.consumption.pending_approval_amount < 0:
        allocation.consumption.pending_approval_amount = Decimal("0.0")
        
    allocation.consumption.committed_amount += amt
    db.commit()

def consume_spend(db: Session, amount: float, context: Dict[str, Any]):
    """Moves amount from committed to consumed (e.g. on Invoice approval)"""
    allocation = find_applicable_allocation(db, context)
    if not allocation: return
    
    amt = Decimal(str(amount))
    allocation.consumption.committed_amount -= amt
    if allocation.consumption.committed_amount < 0:
        allocation.consumption.committed_amount = Decimal("0.0")
        
    allocation.consumption.consumed_amount += amt
    db.commit()
