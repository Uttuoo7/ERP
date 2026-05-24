import uuid
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from . import models, database, dependencies
from .tasks.integration_tasks import process_pending_syncs

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/configs")
def get_configs(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.SUPER_ADMIN]))
):
    """
    Get all active integrations.
    """
    return db.query(models.IntegrationConfig).all()

@router.post("/configs", status_code=status.HTTP_201_CREATED)
def create_config(
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.SUPER_ADMIN]))
):
    """
    Create a new integration configuration (Tally, Webhook).
    """
    config = models.IntegrationConfig(
        provider_name=payload.get("provider_name"),
        is_active=payload.get("is_active", True),
        endpoint_url=payload.get("endpoint_url"),
        auth_type=payload.get("auth_type", "BEARER")
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config

@router.get("/logs")
def get_sync_logs(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.SUPER_ADMIN, models.Role.FINANCE]))
):
    """
    Get recent sync events across all integrations.
    """
    return db.query(models.SyncEventLog).order_by(desc(models.SyncEventLog.last_attempt_at)).limit(100).all()

@router.post("/logs/{log_id}/retry")
def retry_sync_log(
    log_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """
    Manually retries a failed integration sync.
    """
    log = db.query(models.SyncEventLog).filter(models.SyncEventLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
        
    if log.status == "SUCCESS":
        raise HTTPException(status_code=400, detail="Cannot retry a successful sync")
        
    log.status = "PENDING"
    db.commit()
    
    # Trigger background worker instantly instead of waiting for cron
    process_pending_syncs.delay()
    
    return {"message": "Retry queued successfully. Watch the log dashboard."}
