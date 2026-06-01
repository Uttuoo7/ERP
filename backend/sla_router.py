import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uuid

from . import models, database, dependencies

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/policies")
def get_sla_policies(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.PROCUREMENT_MANAGER,
        models.Role.FINANCE_MANAGER,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    """List all SLA Automation Policies."""
    return db.query(models.SLAPolicy).all()

@router.post("/policies")
def create_sla_policy(
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    """Create or update an SLA Policy."""
    policy = models.SLAPolicy(
        name=payload.get("name"),
        entity_type=payload.get("entity_type"),
        max_hours=payload.get("max_hours", 24),
        escalation_level=payload.get("escalation_level", "MANAGER")
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy

@router.delete("/policies/{policy_id}")
def delete_sla_policy(
    policy_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    policy = db.query(models.SLAPolicy).filter(models.SLAPolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(policy)
    db.commit()
    return {"message": "Policy deleted"}

@router.get("/timers")
def get_active_timers(
    status: str = "ACTIVE",
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Get active or breached SLA timers."""
    timers = db.query(models.SLATimer, models.SLAPolicy).join(
        models.SLAPolicy, models.SLATimer.policy_id == models.SLAPolicy.id
    ).filter(
        models.SLATimer.status == status
    ).order_by(models.SLATimer.deadline).all()
    
    result = []
    for timer, policy in timers:
        result.append({
            "timer_id": timer.id,
            "entity_id": timer.entity_id,
            "status": timer.status,
            "deadline": timer.deadline,
            "escalation_count": timer.escalation_count,
            "policy_name": policy.name,
            "entity_type": policy.entity_type,
            "escalation_level": policy.escalation_level
        })
    return result

@router.get("/escalations")
def get_escalation_logs(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.PROCUREMENT_MANAGER,
        models.Role.FINANCE_MANAGER,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    """Get history of SLA escalations."""
    logs = db.query(models.EscalationLog, models.SLATimer, models.SLAPolicy).join(
        models.SLATimer, models.EscalationLog.timer_id == models.SLATimer.id
    ).join(
        models.SLAPolicy, models.SLATimer.policy_id == models.SLAPolicy.id
    ).order_by(desc(models.EscalationLog.created_at)).limit(100).all()
    
    result = []
    for log, timer, policy in logs:
        result.append({
            "log_id": log.id,
            "entity_id": timer.entity_id,
            "entity_type": policy.entity_type,
            "escalation_action": log.escalation_action,
            "details": log.escalation_details,
            "created_at": log.created_at
        })
    return result
