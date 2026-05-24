import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from . import models, database, dependencies
from .services.reconciliation_engine import perform_nightly_reconciliation

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/")
def get_reconciliation_reports(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """Get history of Tally reconciliations."""
    return db.query(models.TallyReconciliationReport).order_by(desc(models.TallyReconciliationReport.reconciliation_date)).limit(50).all()

@router.post("/trigger")
def trigger_reconciliation(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """Manually trigger a reconciliation run."""
    report = perform_nightly_reconciliation(db)
    return report
