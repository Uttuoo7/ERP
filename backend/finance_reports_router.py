from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import User
from backend.services.finance_report_service import FinanceReportService

router = APIRouter(prefix="/api/finance", tags=["Finance Reporting"])

@router.get("/balance-sheet")
def get_balance_sheet(
    as_of_date: Optional[str] = Query(None, description="ISO Date (YYYY-MM-DD)"),
    comparison_date: Optional[str] = Query(None, description="ISO Date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return FinanceReportService.get_balance_sheet(
            db=db,
            as_of_date_str=as_of_date,
            comparison_date_str=comparison_date
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/profit-loss")
def get_profit_and_loss(
    start_date: Optional[str] = Query(None, description="ISO Date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="ISO Date (YYYY-MM-DD)"),
    comparison_start: Optional[str] = Query(None, description="ISO Date (YYYY-MM-DD)"),
    comparison_end: Optional[str] = Query(None, description="ISO Date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return FinanceReportService.get_profit_and_loss(
            db=db,
            start_date_str=start_date,
            end_date_str=end_date,
            comparison_start_str=comparison_start,
            comparison_end_str=comparison_end
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/cash-flow")
def get_cash_flow(
    start_date: Optional[str] = Query(None, description="ISO Date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="ISO Date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return FinanceReportService.get_cash_flow(
            db=db,
            start_date_str=start_date,
            end_date_str=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/ap-reconciliation")
def get_ap_reconciliation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return FinanceReportService.get_ap_reconciliation(db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/grni-reconciliation")
def get_grni_reconciliation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return FinanceReportService.get_grni_reconciliation(db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/health")
def get_finance_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return FinanceReportService.get_finance_health(db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
