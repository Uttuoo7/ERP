import uuid
from decimal import Decimal
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from backend.database import get_db
from backend.dependencies import get_current_user, require_role
from backend.models import User, Role, Account, AccountingPeriod, JournalEntry, JournalLine, VendorLiability, FiscalYear
from backend.services.accounting_service import AccountingService
from backend.services.ledger_service import LedgerService

router = APIRouter(prefix="/api/finance-core", tags=["Finance Core (General Ledger)"])

# --------------------------------------------------------------------------------
# SCHEMAS
# --------------------------------------------------------------------------------
class AccountCreateRequest(BaseModel):
    code: str
    name: str
    account_type: str
    parent_account_id: Optional[uuid.UUID] = None

class AccountResponse(BaseModel):
    id: str
    code: str
    name: str
    account_type: str
    is_active: bool
    parent_account_id: Optional[str] = None

    class Config:
        from_attributes = True

class JournalLineCreate(BaseModel):
    account_id: uuid.UUID
    debit_amount: float = 0.0
    credit_amount: float = 0.0
    narration: Optional[str] = None

class JournalCreateRequest(BaseModel):
    entry_date: datetime
    narration: str
    lines: List[JournalLineCreate]

class JournalResponse(BaseModel):
    entry_id: str
    entry_number: str
    entry_date: str
    reference_type: str
    narration: Optional[str]
    status: str
    lines: List[Dict[str, Any]]

class PeriodStatusUpdateRequest(BaseModel):
    status: str

class FiscalYearCreateRequest(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    status: str = "OPEN"

class FiscalYearStatusUpdateRequest(BaseModel):
    status: str

# --------------------------------------------------------------------------------
# CHART OF ACCOUNTS (COA)
# --------------------------------------------------------------------------------
@router.get("/accounts", response_model=List[AccountResponse])
def list_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    accounts = AccountingService.get_accounts(db)
    return accounts

@router.post("/accounts", response_model=AccountResponse)
def create_account(
    payload: AccountCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([Role.ADMIN, Role.FINANCE]))
):
    try:
        acc = AccountingService.create_account(
            db=db,
            code=payload.code,
            name=payload.name,
            account_type=payload.account_type,
            parent_account_id=payload.parent_account_id
        )
        return acc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --------------------------------------------------------------------------------
# JOURNAL ENTRIES
# --------------------------------------------------------------------------------
@router.get("/journals")
def list_journals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return LedgerService.get_general_ledger(db)

@router.post("/journals")
def post_manual_journal(
    payload: JournalCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([Role.ADMIN, Role.FINANCE]))
):
    try:
        lines_data = [l.dict() for l in payload.lines]
        entry = AccountingService.create_manual_journal_entry(
            db=db,
            entry_date=payload.entry_date,
            narration=payload.narration,
            lines=lines_data,
            user_id=current_user.id
        )
        return {"message": "Journal Entry posted successfully", "entry_number": entry.entry_number, "id": str(entry.id)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/journals/{id}/reverse")
def reverse_journal(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([Role.ADMIN, Role.FINANCE]))
):
    try:
        reversal = AccountingService.reverse_journal_entry(db, id, current_user.id)
        return {"message": f"Journal Entry reversed successfully under reversal reference {reversal.entry_number}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --------------------------------------------------------------------------------
# FISCAL YEARS
# --------------------------------------------------------------------------------
@router.get("/fiscal-years")
def list_fiscal_years(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(FiscalYear).filter(FiscalYear.is_deleted == False).order_by(FiscalYear.start_date.desc()).all()

@router.post("/fiscal-years")
def create_fiscal_year(
    payload: FiscalYearCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([Role.ADMIN, Role.FINANCE]))
):
    status_val = payload.status.upper()
    if status_val not in ["OPEN", "CLOSING", "CLOSED"]:
        raise HTTPException(status_code=400, detail="Status must be OPEN, CLOSING, or CLOSED.")
        
    fy = FiscalYear(
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=status_val
    )
    db.add(fy)
    db.commit()
    db.refresh(fy)
    return fy

@router.post("/fiscal-years/{id}/status")
def update_fiscal_year_status(
    id: uuid.UUID,
    payload: FiscalYearStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([Role.ADMIN, Role.FINANCE]))
):
    fy = db.query(FiscalYear).filter(FiscalYear.id == id).first()
    if not fy:
        raise HTTPException(status_code=404, detail="Fiscal year not found.")
        
    new_status = payload.status.upper()
    if new_status not in ["OPEN", "CLOSING", "CLOSED"]:
        raise HTTPException(status_code=400, detail="Status must be OPEN, CLOSING, or CLOSED.")
        
    fy.status = new_status
    db.commit()
    return {"message": f"Fiscal year status updated to {new_status}."}

# --------------------------------------------------------------------------------
# ACCOUNTING PERIODS
# --------------------------------------------------------------------------------
@router.get("/periods")
def list_periods(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy.orm import joinedload
    periods = db.query(AccountingPeriod).options(joinedload(AccountingPeriod.fiscal_year)).filter(
        AccountingPeriod.is_deleted == False
    ).order_by(AccountingPeriod.period_name.desc()).all()
    
    result = []
    for p in periods:
        result.append({
            "id": str(p.id),
            "period_name": p.period_name,
            "start_date": p.start_date.isoformat(),
            "end_date": p.end_date.isoformat(),
            "status": p.status,
            "fiscal_year_id": str(p.fiscal_year_id) if p.fiscal_year_id else None,
            "fiscal_year_name": p.fiscal_year.name if p.fiscal_year else None
        })
    return result

@router.post("/periods/{id}/status")
def update_period_status(
    id: uuid.UUID,
    payload: PeriodStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([Role.ADMIN, Role.FINANCE]))
):
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Accounting period not found.")
    
    new_status = payload.status.upper()
    if new_status not in ["OPEN", "CLOSED", "LOCKED"]:
        raise HTTPException(status_code=400, detail="Status must be OPEN, CLOSED, or LOCKED.")

    period.status = new_status
    db.commit()
    return {"message": f"Accounting period status updated to {new_status}."}

# --------------------------------------------------------------------------------
# REPORTS
# --------------------------------------------------------------------------------
@router.get("/reports/trial-balance")
def get_trial_balance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return LedgerService.get_trial_balance(db)

@router.get("/reports/account-ledger/{account_id}")
def get_account_ledger(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return LedgerService.get_account_ledger(db, account_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# --------------------------------------------------------------------------------
# FINANCE DASHBOARD SUMMARY
# --------------------------------------------------------------------------------
@router.get("/dashboard-summary")
def get_finance_dashboard_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Cash (1000)
    bank_acc = db.query(Account).filter(Account.code == "1000").first()
    cash_position = 0.0
    if bank_acc:
        debit = db.query(func.sum(JournalLine.debit_amount)).join(JournalEntry).filter(
            JournalLine.account_id == bank_acc.id,
            JournalEntry.status != "DRAFT",
            JournalLine.is_deleted == False
        ).scalar() or Decimal("0.0")
        credit = db.query(func.sum(JournalLine.credit_amount)).join(JournalEntry).filter(
            JournalLine.account_id == bank_acc.id,
            JournalEntry.status != "DRAFT",
            JournalLine.is_deleted == False
        ).scalar() or Decimal("0.0")
        cash_position = float(debit - credit)
        
    # GRNI (2100)
    grni_acc = db.query(Account).filter(Account.code == "2100").first()
    grni_balance = 0.0
    if grni_acc:
        debit = db.query(func.sum(JournalLine.debit_amount)).join(JournalEntry).filter(
            JournalLine.account_id == grni_acc.id,
            JournalEntry.status != "DRAFT",
            JournalLine.is_deleted == False
        ).scalar() or Decimal("0.0")
        credit = db.query(func.sum(JournalLine.credit_amount)).join(JournalEntry).filter(
            JournalLine.account_id == grni_acc.id,
            JournalEntry.status != "DRAFT",
            JournalLine.is_deleted == False
        ).scalar() or Decimal("0.0")
        grni_balance = float(credit - debit)
        
    # AP Balance (2000)
    ap_acc = db.query(Account).filter(Account.code == "2000").first()
    ap_balance = 0.0
    if ap_acc:
        debit = db.query(func.sum(JournalLine.debit_amount)).join(JournalEntry).filter(
            JournalLine.account_id == ap_acc.id,
            JournalEntry.status != "DRAFT",
            JournalLine.is_deleted == False
        ).scalar() or Decimal("0.0")
        credit = db.query(func.sum(JournalLine.credit_amount)).join(JournalEntry).filter(
            JournalLine.account_id == ap_acc.id,
            JournalEntry.status != "DRAFT",
            JournalLine.is_deleted == False
        ).scalar() or Decimal("0.0")
        ap_balance = float(credit - debit)
        
    # Outstanding Liabilities (from VendorLiability)
    outstanding_liab = db.query(func.sum(VendorLiability.outstanding_amount)).scalar() or Decimal("0.0")
    
    return {
        "cash_position": cash_position,
        "grni_balance": grni_balance,
        "ap_balance": ap_balance,
        "outstanding_liabilities": float(outstanding_liab)
    }
