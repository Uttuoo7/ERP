from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies, crm_services

router = APIRouter(
    prefix="/crm",
    tags=["CRM & Lead Management"],
    responses={404: {"description": "Not found"}},
)

@router.post("/leads", response_model=schemas.LeadResponse)
def create_lead(
    lead: schemas.LeadCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return crm_services.create_lead(db, lead)

@router.get("/leads", response_model=List[schemas.LeadResponse])
def get_leads(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return crm_services.get_leads(db, skip, limit)

@router.put("/leads/{lead_id}/stage")
def update_stage(
    lead_id: uuid.UUID,
    stage: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return crm_services.update_lead_stage(db, lead_id, stage, current_user.id)

@router.post("/follow-up", response_model=schemas.FollowUpActivityResponse)
def add_follow_up(
    activity: schemas.FollowUpActivityBase,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return crm_services.add_follow_up(db, activity, current_user.id)
