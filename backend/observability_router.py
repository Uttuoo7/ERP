import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uuid

from . import models, database, dependencies

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/metrics/api")
def get_api_metrics(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    """Get aggregated API performance metrics."""
    # Simplified aggregate for dashboard
    logs = db.query(models.ApiRequestLog).order_by(desc(models.ApiRequestLog.created_at)).limit(100).all()
    return logs

@router.get("/metrics/queue")
def get_queue_metrics(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    """Get recent queue task logs."""
    logs = db.query(models.QueueTaskLog).order_by(desc(models.QueueTaskLog.created_at)).limit(100).all()
    return logs

@router.get("/alerts")
def get_system_alerts(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.MANAGER]))
):
    """Get active system alerts."""
    alerts = db.query(models.SystemAlert).order_by(desc(models.SystemAlert.created_at)).limit(50).all()
    return alerts
