import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from decimal import Decimal
from . import database, dependencies, models, schemas

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=schemas.BudgetMasterResponse, status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: schemas.BudgetMasterCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """
    Creates a new Budget Master along with initial hierarchical allocations.
    """
    # Verify Tenant isolation
    tenant_id = None
    if current_user.tenant_id:
        tenant_id = current_user.tenant_id

    budget = models.BudgetMaster(
        name=payload.name,
        fiscal_year=payload.fiscal_year,
        status=payload.status,
        total_budget=payload.total_budget,
        tenant_id=tenant_id
    )
    db.add(budget)
    db.flush()

    for alloc_data in payload.allocations:
        allocation = models.BudgetAllocation(
            budget_master_id=budget.id,
            department_id=alloc_data.department_id,
            project_id=alloc_data.project_id,
            cost_center_id=alloc_data.cost_center_id,
            category_id=alloc_data.category_id,
            branch_id=alloc_data.branch_id,
            allocated_amount=alloc_data.allocated_amount,
            soft_limit_percent=alloc_data.soft_limit_percent,
            hard_limit_percent=alloc_data.hard_limit_percent,
            escalate_to_role=alloc_data.escalate_to_role
        )
        db.add(allocation)
        db.flush()
        
        # Initialize consumption ledger
        consumption = models.BudgetConsumption(
            allocation_id=allocation.id,
            pending_approval_amount=Decimal("0.00"),
            committed_amount=Decimal("0.00"),
            consumed_amount=Decimal("0.00")
        )
        db.add(consumption)

    db.commit()
    db.refresh(budget)
    return budget

@router.get("/", response_model=List[schemas.BudgetMasterResponse])
def get_budgets(
    fiscal_year: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.BudgetMaster)
    
    if current_user.tenant_id:
        query = query.filter(models.BudgetMaster.tenant_id == current_user.tenant_id)
        
    if fiscal_year:
        query = query.filter(models.BudgetMaster.fiscal_year == fiscal_year)
    if status_filter:
        query = query.filter(models.BudgetMaster.status == status_filter)
        
    return query.all()

@router.get("/{id}", response_model=schemas.BudgetMasterResponse)
def get_budget_by_id(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    budget = db.query(models.BudgetMaster).filter(models.BudgetMaster.id == id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found.")
        
    if current_user.tenant_id and budget.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to tenant budget.")
        
    return budget

@router.post("/{id}/allocations/{allocation_id}/adjust", response_model=schemas.BudgetAdjustmentResponse)
def adjust_budget_allocation(
    id: uuid.UUID,
    allocation_id: uuid.UUID,
    payload: schemas.BudgetAdjustmentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """
    Permits CFO/Finance to dynamically adjust allocated funds (e.g. inject more budget into CAPEX).
    """
    allocation = db.query(models.BudgetAllocation).filter(
        models.BudgetAllocation.id == allocation_id,
        models.BudgetAllocation.budget_master_id == id
    ).first()
    
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found.")
        
    adjustment = models.BudgetAdjustment(
        allocation_id=allocation.id,
        adjustment_amount=payload.adjustment_amount,
        reason=payload.reason,
        adjusted_by_id=current_user.id
    )
    db.add(adjustment)
    
    allocation.allocated_amount += payload.adjustment_amount
    db.commit()
    db.refresh(adjustment)
    return adjustment

@router.get("/intelligence/executive-insights")
def get_executive_budget_insights(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """
    Returns AI-powered spend insights for the CFO dashboard.
    """
    from . import spend_intelligence
    return spend_intelligence.generate_executive_insights(db)

@router.get("/intelligence/commitment-exposure")
def get_commitment_exposure(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """
    Returns financial exposure analytics (Planned + Committed + Accrued).
    """
    from . import commitment_intelligence
    exposure_data = commitment_intelligence.calculate_financial_exposure(db)
    ai_forecasts = commitment_intelligence.generate_ai_forecasting(db)
    
    return {
        "exposure": exposure_data,
        "forecasts": ai_forecasts
    }
