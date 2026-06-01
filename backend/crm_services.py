from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List

def create_lead(db: Session, lead_data: schemas.LeadCreate) -> models.Lead:
    new_lead = models.Lead(
        lead_number=f"LD-{uuid.uuid4().hex[:6].upper()}",
        **lead_data.model_dump()
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return new_lead

def get_leads(db: Session, skip: int = 0, limit: int = 100) -> List[models.Lead]:
    return db.query(models.Lead).order_by(models.Lead.created_at.desc()).offset(skip).limit(limit).all()

def update_lead_stage(db: Session, lead_id: uuid.UUID, new_stage: str, user_id: uuid.UUID) -> models.Lead:
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise ValueError("Lead not found")
        
    old_stage = lead.stage
    lead.stage = new_stage
    
    # Log activity
    activity = models.FollowUpActivity(
        lead_id=lead_id,
        activity_type="STAGE_CHANGE",
        notes=f"Stage updated from {old_stage} to {new_stage}",
        created_by=user_id
    )
    db.add(activity)
    
    db.commit()
    db.refresh(lead)
    return lead

def add_follow_up(db: Session, activity_data: schemas.FollowUpActivityBase, user_id: uuid.UUID) -> models.FollowUpActivity:
    activity = models.FollowUpActivity(
        **activity_data.model_dump(),
        created_by=user_id
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity
