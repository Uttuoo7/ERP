import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from . import models

logger = logging.getLogger(__name__)

def calculate_financial_exposure(db: Session) -> Dict[str, Any]:
    """
    Calculates overall financial exposure across all active budgets.
    Exposure = Planned + Committed + Accrued.
    """
    active_budgets = db.query(models.BudgetMaster).filter(models.BudgetMaster.status == "ACTIVE").all()
    
    total_planned = 0.0
    total_committed = 0.0
    total_accrued = 0.0
    total_actual = 0.0
    total_paid = 0.0
    total_budget = 0.0
    
    department_exposure = {}

    for budget in active_budgets:
        total_budget += float(budget.total_budget)
        for allocation in budget.allocations:
            cons = allocation.consumption
            if not cons: continue
            
            planned = float(cons.pending_approval_amount)
            committed = float(cons.committed_amount)
            accrued = float(cons.accrued_amount)
            actual = float(cons.consumed_amount)
            paid = float(cons.paid_amount)
            
            total_planned += planned
            total_committed += committed
            total_accrued += accrued
            total_actual += actual
            total_paid += paid
            
            dept_id = str(allocation.department_id) if allocation.department_id else "Global"
            if dept_id not in department_exposure:
                department_exposure[dept_id] = 0.0
            department_exposure[dept_id] += (planned + committed + accrued + actual)

    total_exposure = total_planned + total_committed + total_accrued
    
    return {
        "total_budget": total_budget,
        "total_exposure": total_exposure,
        "breakdown": {
            "planned": total_planned,
            "committed": total_committed,
            "accrued": total_accrued,
            "actual": total_actual,
            "paid": total_paid
        },
        "department_exposure": department_exposure,
        "generated_at": datetime.utcnow().isoformat()
    }

def generate_ai_forecasting(db: Session) -> List[Dict[str, Any]]:
    """
    Simulates an AI forecasting engine analyzing commitment velocity.
    """
    forecasts = []
    active_budgets = db.query(models.BudgetMaster).filter(models.BudgetMaster.status == "ACTIVE").all()
    
    for budget in active_budgets:
        for allocation in budget.allocations:
            cons = allocation.consumption
            if not cons: continue
            
            # Exposure represents funds currently tied up
            exposure = float(cons.pending_approval_amount + cons.committed_amount + cons.accrued_amount + cons.consumed_amount)
            allocated = float(allocation.allocated_amount)
            
            if allocated == 0: continue
            
            utilization = exposure / allocated
            
            # Simple simulation: If utilization is growing rapidly
            if utilization > 0.8:
                # Predict days to exhaustion (mock logic)
                remaining = allocated - exposure
                velocity = exposure / 30.0 # assume 30 days active
                days_to_exhaustion = remaining / velocity if velocity > 0 else 999
                
                forecasts.append({
                    "allocation_id": str(allocation.id),
                    "department_id": str(allocation.department_id) if allocation.department_id else "Global",
                    "current_utilization_pct": round(utilization * 100, 2),
                    "predicted_days_to_exhaustion": round(days_to_exhaustion),
                    "confidence_score": 85 + (utilization * 10), # higher utilization = higher confidence of exhaustion
                    "recommendation": "Freeze non-essential PRs immediately." if days_to_exhaustion < 15 else "Monitor closely."
                })
                
    return forecasts
