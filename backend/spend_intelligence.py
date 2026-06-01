import logging
from typing import List, Dict, Any
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from . import models

logger = logging.getLogger(__name__)

def analyze_spend_runaway_risk(db: Session) -> List[Dict[str, Any]]:
    """
    Evaluates active budget allocations to determine if consumption velocity
    indicates a risk of early budget exhaustion.
    """
    insights = []
    active_budgets = db.query(models.BudgetMaster).filter(models.BudgetMaster.status == "ACTIVE").all()
    
    for budget in active_budgets:
        for allocation in budget.allocations:
            cons = allocation.consumption
            if not cons: continue
            
            total_utilized = float(cons.consumed_amount + cons.committed_amount)
            total_allocated = float(allocation.allocated_amount)
            
            if total_allocated == 0: continue
            
            utilization_rate = total_utilized / total_allocated
            
            # Simple heuristic: if > 85% utilized, flag it.
            # In a real AI model, this would evaluate days elapsed vs utilization.
            if utilization_rate > 0.85:
                dimension_name = "General"
                if allocation.department_id: dimension_name = allocation.department_id
                elif allocation.category_id: dimension_name = allocation.category_id
                
                insights.append({
                    "insight_type": "RUNAWAY_SPEND_RISK",
                    "severity": "CRITICAL" if utilization_rate >= 0.95 else "HIGH",
                    "dimension": str(dimension_name),
                    "budget_name": budget.name,
                    "utilization_percent": round(utilization_rate * 100, 2),
                    "recommendation": f"Immediate freeze recommended. {round(utilization_rate * 100, 2)}% of budget utilized."
                })
                
    return insights

def generate_executive_insights(db: Session) -> Dict[str, Any]:
    """
    Compiles AI spend intelligence for the CFO Command Center.
    """
    runaway_risks = analyze_spend_runaway_risk(db)
    
    # Calculate global health
    active_budgets = db.query(models.BudgetMaster).filter(models.BudgetMaster.status == "ACTIVE").all()
    global_allocated = sum(float(b.total_budget) for b in active_budgets)
    
    global_consumed = 0.0
    for b in active_budgets:
        for a in b.allocations:
            if a.consumption:
                global_consumed += float(a.consumption.consumed_amount)
                
    health_score = 100
    if global_allocated > 0:
        overall_utilization = global_consumed / global_allocated
        if overall_utilization > 0.9: health_score -= 40
        elif overall_utilization > 0.7: health_score -= 20
        
    return {
        "global_health_score": health_score,
        "total_active_budgets": len(active_budgets),
        "total_allocated": global_allocated,
        "total_consumed": global_consumed,
        "anomalies_detected": len(runaway_risks),
        "insights": runaway_risks,
        "generated_at": datetime.utcnow().isoformat()
    }
