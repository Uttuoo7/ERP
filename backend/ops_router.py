from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies
from . import ops_asset_services, ops_maintenance_services

router = APIRouter(
    prefix="/ops",
    tags=["Internal Operations & Maintenance"],
    responses={404: {"description": "Not found"}},
)

@router.post("/assets", response_model=schemas.AssetBase) # Using Base for quick mock
def register_asset(
    data: schemas.AssetCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return ops_asset_services.register_asset(db, data)

@router.post("/maintenance", response_model=schemas.MaintenanceRequestResponse)
def log_maintenance_request(
    data: schemas.MaintenanceRequestCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return ops_maintenance_services.log_maintenance_request(db, data)

@router.get("/maintenance", response_model=List[schemas.MaintenanceRequestResponse])
def get_maintenance_requests(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return ops_maintenance_services.get_maintenance_requests(db, skip, limit)
