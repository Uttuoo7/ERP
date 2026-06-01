from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from . import models, schemas, database, dependencies, mfg_mrp_services

router = APIRouter(
    prefix="/mfg/mrp",
    tags=["Manufacturing MRP"],
    responses={404: {"description": "Not found"}},
)

@router.post("/run", response_model=List[schemas.MRPRecommendationResponse])
def run_mrp(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return mfg_mrp_services.run_mrp_engine(db)

@router.get("/recommendations", response_model=List[schemas.MRPRecommendationResponse])
def get_recommendations(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return mfg_mrp_services.get_mrp_recommendations(db, skip, limit)
