from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from . import models, schemas, database, dependencies, mfg_mrp_services

router = APIRouter(
    prefix="/mfg/mrp",
    tags=["Manufacturing MRP"],
    responses={404: {"description": "Not found"}},
)

@router.post("/run", response_model=List[schemas.MRPRecommendationResponse])
def run_mrp(
    request: Optional[schemas.MRPRunRequest] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    warehouse_id = request.warehouse_id if request else None
    planning_horizon_days = request.planning_horizon_days if (request and request.planning_horizon_days) else 30
    return mfg_mrp_services.run_mrp_engine(
        db,
        warehouse_id=warehouse_id,
        planning_horizon_days=planning_horizon_days,
        generated_by_id=current_user.id
    )

@router.get("/recommendations", response_model=List[schemas.MRPRecommendationResponse])
def get_recommendations(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return mfg_mrp_services.get_mrp_recommendations(db, skip, limit)

@router.get("/plans", response_model=List[schemas.MRPPlanResponse])
def get_plans(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return mfg_mrp_services.get_mrp_plans(db, skip, limit)

@router.get("/plans/{plan_id}", response_model=schemas.MRPPlanResponse)
def get_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    plan = mfg_mrp_services.get_mrp_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="MRP plan not found")
    return plan

@router.post("/plans/{plan_id}/confirm", response_model=schemas.MRPPlanResponse)
def confirm_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    plan = mfg_mrp_services.confirm_mrp_plan(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="MRP plan not found")
    return plan

@router.post("/recommendations/{rec_id}/approve", response_model=schemas.MRPRecommendationResponse)
def approve_rec(
    rec_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    rec = mfg_mrp_services.approve_recommendation(db, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rec

@router.post("/recommendations/{rec_id}/reject", response_model=schemas.MRPRecommendationResponse)
def reject_rec(
    rec_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    rec = mfg_mrp_services.reject_recommendation(db, rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rec

@router.get("/forecasts", response_model=List[schemas.DemandForecastResponse])
def get_forecasts(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return mfg_mrp_services.get_demand_forecasts(db, skip, limit)

@router.post("/forecasts", response_model=schemas.DemandForecastResponse)
def create_forecast(
    forecast_in: schemas.DemandForecastCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    tenant_id = current_user.tenant_id or uuid.UUID("00000000-0000-0000-0000-000000000000")
    return mfg_mrp_services.create_demand_forecast(db, forecast_in, tenant_id)

@router.post("/forecasts/generate", response_model=schemas.DemandForecastResponse)
def generate_forecast(
    request: schemas.DemandForecastGenerateRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    tenant_id = current_user.tenant_id or uuid.UUID("00000000-0000-0000-0000-000000000000")
    return mfg_mrp_services.generate_moving_average_forecast(db, request, tenant_id)

@router.get("/safety-stock", response_model=List[schemas.SafetyStockPolicyResponse])
def get_safety_stock(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return mfg_mrp_services.get_safety_stock_policies(db, skip, limit)

@router.post("/safety-stock", response_model=schemas.SafetyStockPolicyResponse)
def create_safety_stock(
    policy_in: schemas.SafetyStockPolicyCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    tenant_id = current_user.tenant_id or uuid.UUID("00000000-0000-0000-0000-000000000000")
    return mfg_mrp_services.create_safety_stock_policy(db, policy_in, tenant_id)
