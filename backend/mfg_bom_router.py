from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies, mfg_bom_services

router = APIRouter(
    prefix="/mfg/bom",
    tags=["Manufacturing BOM"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.BOMResponse)
def create_bom(
    bom: schemas.BOMCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return mfg_bom_services.create_bom(db, bom, current_user.id)

@router.get("/", response_model=List[schemas.BOMResponse])
def get_boms(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return mfg_bom_services.get_boms(db, skip, limit)
