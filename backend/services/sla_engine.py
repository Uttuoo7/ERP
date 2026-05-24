import logging
from datetime import datetime, timedelta
import uuid
from typing import List
from sqlalchemy.orm import Session
from .. import models

logger = logging.getLogger(__name__)

def start_timer(db: Session, entity_type: str, entity_id: uuid.UUID):
    """Start an SLA timer for the given entity if a policy exists."""
    policy = db.query(models.SLAPolicy).filter(
        models.SLAPolicy.entity_type == entity_type,
        models.SLAPolicy.is_active == True
    ).first()

    if not policy:
        return None

    # Check if a timer already exists and is active
    existing = db.query(models.SLATimer).filter(
        models.SLATimer.entity_id == entity_id,
        models.SLATimer.policy_id == policy.id,
        models.SLATimer.status == "ACTIVE"
    ).first()

    if existing:
        return existing

    deadline = datetime.utcnow() + timedelta(hours=policy.max_hours)
    
    timer = models.SLATimer(
        policy_id=policy.id,
        entity_id=entity_id,
        status="ACTIVE",
        deadline=deadline
    )
    db.add(timer)
    db.commit()
    db.refresh(timer)
    logger.info(f"Started SLA Timer for {entity_type} {entity_id}. Deadline: {deadline}")
    return timer

def resolve_timer(db: Session, entity_type: str, entity_id: uuid.UUID):
    """Stop the SLA clock when a workflow step completes."""
    policy = db.query(models.SLAPolicy).filter(
        models.SLAPolicy.entity_type == entity_type,
        models.SLAPolicy.is_active == True
    ).first()

    if not policy:
        return

    timers = db.query(models.SLATimer).filter(
        models.SLATimer.entity_id == entity_id,
        models.SLATimer.policy_id == policy.id,
        models.SLATimer.status.in_(["ACTIVE", "BREACHED"])
    ).all()

    for timer in timers:
        timer.status = "RESOLVED"
        timer.resolved_at = datetime.utcnow()
        logger.info(f"Resolved SLA Timer for {entity_type} {entity_id}.")

    if timers:
        db.commit()

def evaluate_active_timers(db: Session):
    """Scans all ACTIVE timers. If deadline passed, breach and escalate."""
    now = datetime.utcnow()
    breached_timers = db.query(models.SLATimer).filter(
        models.SLATimer.status == "ACTIVE",
        models.SLATimer.deadline <= now
    ).all()

    for timer in breached_timers:
        timer.status = "BREACHED"
        timer.escalation_count += 1
        
        policy = db.query(models.SLAPolicy).filter(models.SLAPolicy.id == timer.policy_id).first()
        
        # Log the escalation
        action = f"ESCALATED_TO_{policy.escalation_level}"
        details = f"SLA breached for {policy.entity_type}. Deadline was {timer.deadline}."
        
        log = models.EscalationLog(
            timer_id=timer.id,
            escalation_action=action,
            escalation_details=details
        )
        db.add(log)
        
        # In a real system, you would call your notification/email service here
        logger.warning(f"SLA BREACH! Timer ID {timer.id}. Action: {action}")
        
    if breached_timers:
        db.commit()
