import logging
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .. import models
from . import notification_engine
from .activity_engine import ActivityEngine

logger = logging.getLogger(__name__)

def evaluate_system_health(db: Session):
    """
    Evaluates system metrics for the last 15 minutes and fires alerts if thresholds are breached.
    """
    now = datetime.utcnow()
    fifteen_mins_ago = now - timedelta(minutes=15)
    
    # 1. API Error Rate
    total_requests = db.query(models.ApiRequestLog).filter(
        models.ApiRequestLog.created_at >= fifteen_mins_ago
    ).count()
    
    failed_requests = db.query(models.ApiRequestLog).filter(
        models.ApiRequestLog.created_at >= fifteen_mins_ago,
        models.ApiRequestLog.status_code >= 500
    ).count()

    if total_requests > 50:
        error_rate = (failed_requests / total_requests) * 100
        if error_rate > 5.0:
            fire_alert(db, "API_DEGRADATION", "CRITICAL", f"API Error Rate is {error_rate:.2f}% (Threshold: 5%)")
            
    # 2. API Latency
    slow_requests = db.query(models.ApiRequestLog).filter(
        models.ApiRequestLog.created_at >= fifteen_mins_ago,
        models.ApiRequestLog.response_time_ms > 2000
    ).count()
    
    if slow_requests > 10:
        fire_alert(db, "HIGH_LATENCY", "WARNING", f"{slow_requests} API requests took over 2 seconds in the last 15 minutes.")
        
    # 3. Queue Failures
    failed_tasks = db.query(models.QueueTaskLog).filter(
        models.QueueTaskLog.created_at >= fifteen_mins_ago,
        models.QueueTaskLog.status == "FAILURE"
    ).count()
    
    if failed_tasks > 5:
        fire_alert(db, "QUEUE_FAILURE_SPIKE", "CRITICAL", f"{failed_tasks} Celery tasks failed in the last 15 minutes.")

def fire_alert(db: Session, alert_type: str, severity: str, message: str):
    """Creates a SystemAlert and triggers notification if CRITICAL."""
    # Prevent alert spam (check if identical unresolved alert exists)
    existing = db.query(models.SystemAlert).filter(
        models.SystemAlert.alert_type == alert_type,
        models.SystemAlert.is_resolved == False
    ).first()
    
    if existing:
        # Just update the timestamp
        existing.created_at = datetime.utcnow()
        db.commit()
        return
        
    alert = models.SystemAlert(
        alert_type=alert_type,
        severity=severity,
        message=message
    )
    db.add(alert)
    db.commit()
    logger.warning(f"SYSTEM ALERT: [{severity}] {alert_type} - {message}")
    
    # Broadcast to Live Global Activity Feed
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            ActivityEngine.log_and_broadcast(
                db=db,
                entity_type="SYSTEM_ALERT",
                action=alert_type,
                description=message,
                severity=severity
            )
        )
    except RuntimeError:
        # If no running loop, run it synchronously if possible, or just skip broadcast
        pass
    
    # In a real app, notify DevOps via Slack or Email
    # notification_engine.send_email(to="devops@company.com", subject=f"ERP Alert: {alert_type}", body=message)
