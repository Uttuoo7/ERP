from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from datetime import datetime
from typing import List

def log_maintenance_request(db: Session, request_data: schemas.MaintenanceRequestCreate) -> models.MaintenanceRequest:
    maint_req = models.MaintenanceRequest(
        request_number=f"MNT-{uuid.uuid4().hex[:8].upper()}",
        **request_data.model_dump()
    )
    db.add(maint_req)
    db.commit()
    db.refresh(maint_req)
    
    # In full system, this triggers WorkflowEngine for MAINTENANCE_ESCALATION
    return maint_req

def get_maintenance_requests(db: Session, skip: int = 0, limit: int = 100) -> List[models.MaintenanceRequest]:
    return db.query(models.MaintenanceRequest).order_by(models.MaintenanceRequest.created_at.desc()).offset(skip).limit(limit).all()
