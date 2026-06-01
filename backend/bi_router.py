from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any

from . import database, dependencies, models
from . import bi_kpi_services, bi_ml_services

router = APIRouter(
    prefix="/bi",
    tags=["Business Intelligence & Analytics"],
    responses={404: {"description": "Not found"}},
)

@router.get("/kpi/executive")
def get_executive_kpis(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    return bi_kpi_services.compute_executive_kpis(db)

@router.get("/kpi/finance")
def get_finance_kpis(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    return bi_kpi_services.compute_finance_kpis(db)

@router.get("/kpi/manufacturing")
def get_mfg_kpis(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    return bi_kpi_services.compute_mfg_kpis(db)

@router.get("/kpi/inventory")
def get_inventory_kpis(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    return bi_kpi_services.compute_inventory_kpis(db)

@router.post("/scan-anomalies")
def trigger_anomaly_scan(db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    return bi_ml_services.run_anomaly_scan(db)

@router.get("/insights")
def get_insights(module: str = None, skip: int = 0, limit: int = 50, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.get_current_user)):
    return bi_ml_services.get_insights(db, module, skip, limit)
