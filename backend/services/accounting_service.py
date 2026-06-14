import uuid
import random
import logging
from decimal import Decimal
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import Account, AccountingPeriod, JournalEntry, JournalLine, FiscalYear, JournalSequence
from backend import models

logger = logging.getLogger(__name__)

class AccountingService:
    """
    General Ledger Accounting Service.
    Enforces double-entry logic, accounting period checks, and journal reversal rules.
    """

    @staticmethod
    def get_accounts(db: Session) -> List[Account]:
        return db.query(Account).filter(Account.is_deleted == False).order_by(Account.code).all()

    @staticmethod
    def create_account(db: Session, code: str, name: str, account_type: str, parent_account_id: Optional[uuid.UUID] = None) -> Account:
        # Check unique code
        existing = db.query(Account).filter(Account.code == code, Account.is_deleted == False).first()
        if existing:
            raise ValueError(f"Account with code '{code}' already exists.")
        
        if account_type.upper() not in ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]:
            raise ValueError(f"Invalid account type '{account_type}'. Must be Asset, Liability, Equity, Revenue, or Expense.")

        if parent_account_id:
            parent = db.query(Account).filter(Account.id == parent_account_id, Account.is_deleted == False).first()
            if not parent:
                raise ValueError("Selected parent account does not exist.")

        account = Account(
            code=code,
            name=name,
            account_type=account_type.upper(),
            is_active=True,
            parent_account_id=parent_account_id
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def validate_period_for_posting(db: Session, posting_date: datetime, user_role: Optional[str] = None) -> AccountingPeriod:
        """
        Verify if the posting date falls within an OPEN accounting period.
        """
        # Find period
        period = db.query(AccountingPeriod).filter(
            AccountingPeriod.start_date <= posting_date,
            AccountingPeriod.end_date >= posting_date,
            AccountingPeriod.is_deleted == False
        ).first()

        if not period:
            # Fallback check by period name
            period_name = posting_date.strftime("%Y-%m")
            period = db.query(AccountingPeriod).filter(
                AccountingPeriod.period_name == period_name,
                AccountingPeriod.is_deleted == False
            ).first()

        if not period:
            raise ValueError(f"No accounting period defined for date {posting_date.date()}.")

        if period.status.upper() in ["CLOSED", "LOCKED"]:
            raise ValueError(f"Cannot post to accounting period '{period.period_name}' because its status is {period.status}.")

        # Enforce parent Fiscal Year status locks
        if period.fiscal_year:
            fy = period.fiscal_year
            if fy.status.upper() == "CLOSED":
                raise ValueError(f"Cannot post because the fiscal year '{fy.name}' is CLOSED.")
            elif fy.status.upper() == "CLOSING":
                # Only allow Role.ADMIN, Role.FINANCE, Role.FINANCE_MANAGER, Role.SUPER_ADMIN
                allowed_roles = ["ADMIN", "FINANCE", "FINANCE_MANAGER", "SUPER_ADMIN"]
                if not user_role or user_role.upper() not in allowed_roles:
                    raise ValueError(f"Cannot post because the fiscal year '{fy.name}' is in CLOSING status and requires finance/admin privileges.")

        return period

    @staticmethod
    def generate_journal_number(db: Session, entry_date: datetime) -> str:
        """
        Generate sequential journal entry numbers in format JV-YYYY-000001
        using the JournalSequence model to guarantee uniqueness under concurrency.
        """
        year = entry_date.year
        
        # Find if there's a FiscalYear matching this date
        fy = db.query(FiscalYear).filter(
            FiscalYear.start_date <= entry_date,
            FiscalYear.end_date >= entry_date,
            FiscalYear.is_deleted == False
        ).first()
        
        if not fy:
            # Fallback by year name if no exact date match
            fy = db.query(FiscalYear).filter(
                FiscalYear.name.like(f"%{year}%"),
                FiscalYear.is_deleted == False
            ).first()
            
        if not fy:
            # Create a default Fiscal Year for this year to prevent crash
            fy = FiscalYear(
                name=f"FY {year}",
                start_date=datetime(year, 1, 1),
                end_date=datetime(year, 12, 31, 23, 59, 59),
                status="OPEN"
            )
            db.add(fy)
            db.flush()
            
        # Lock sequence row for this Fiscal Year to handle concurrency
        seq = db.query(JournalSequence).filter(
            JournalSequence.fiscal_year_id == fy.id
        ).with_for_update().first()
        
        if not seq:
            seq = JournalSequence(
                fiscal_year_id=fy.id,
                current_number=0
            )
            db.add(seq)
            db.flush()
            
        seq.current_number += 1
        db.flush() # Flush to ensure db has the updated sequence
        
        return f"JV-{year}-{seq.current_number:06d}"

    @staticmethod
    def validate_trial_balance(db: Session) -> bool:
        """
        Certifies that the Trial Balance is perfectly balanced (Total Debits == Total Credits).
        If not, raises a ValueError to trigger a rollback.
        """
        # Sum all debits and credits from JournalLine
        result = db.query(
            func.sum(JournalLine.debit_amount),
            func.sum(JournalLine.credit_amount)
        ).filter(JournalLine.is_deleted == False).first()
        
        total_debits = result[0] or Decimal("0.0")
        total_credits = result[1] or Decimal("0.0")
        
        diff = abs(total_debits - total_credits)
        # Check within rounding tolerance
        if diff > Decimal("0.001"):
            err_msg = f"[TRIAL BALANCE UNBALANCED]: Total Debits: {total_debits:,.2f}, Total Credits: {total_credits:,.2f}. Imbalance: {diff:,.2f}."
            logger.critical(err_msg)
            raise ValueError(err_msg)
            
        return True

    @classmethod
    def create_manual_journal_entry(
        cls,
        db: Session,
        entry_date: datetime,
        narration: str,
        lines: List[Dict[str, Any]],
        user_id: Optional[uuid.UUID] = None
    ) -> JournalEntry:
        """
        Create a manual double-entry journal entry.
        Verifies balance constraints: Sum(Debits) == Sum(Credits)
        Verifies active accounting period.
        """
        # Fetch user role
        user_role = None
        if user_id:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if user:
                user_role = user.role.value if hasattr(user.role, 'value') else str(user.role)

        # 1. Period verification
        cls.validate_period_for_posting(db, entry_date, user_role=user_role)

        # 2. Parity check
        debit_sum = Decimal("0.0")
        credit_sum = Decimal("0.0")
        
        if not lines or len(lines) < 2:
            raise ValueError("A journal entry must contain at least 2 lines.")

        for line in lines:
            debit = Decimal(str(line.get("debit_amount") or 0.0))
            credit = Decimal(str(line.get("credit_amount") or 0.0))
            if debit > 0 and credit > 0:
                raise ValueError("A single journal line cannot contain both debit and credit amounts.")
            if debit < 0 or credit < 0:
                raise ValueError("Debit and credit amounts cannot be negative.")
            debit_sum += debit
            credit_sum += credit

        diff = abs(debit_sum - credit_sum)
        if diff > Decimal("0.0001"):
            raise ValueError(f"Journal entry is out of balance. Total Debits: {debit_sum:,.2f}, Total Credits: {credit_sum:,.2f}. Imbalance: {diff:,.2f}")

        # 3. Create Header (using sequential JV sequence)
        entry_num = cls.generate_journal_number(db, entry_date)
        
        journal = JournalEntry(
            entry_number=entry_num,
            entry_date=entry_date,
            reference_type="MANUAL",
            source_module="MANUAL",
            source_event="manual_posting",
            narration=narration,
            status="POSTED",
            created_by_id=user_id
        )
        db.add(journal)
        db.flush()

        # 4. Create Lines
        for line in lines:
            acc_id = line["account_id"]
            account = db.query(Account).filter(Account.id == acc_id, Account.is_active == True, Account.is_deleted == False).first()
            if not account:
                raise ValueError(f"Active GL Account with ID '{acc_id}' not found.")

            j_line = JournalLine(
                journal_entry_id=journal.id,
                account_id=acc_id,
                debit_amount=Decimal(str(line.get("debit_amount") or 0.0)),
                credit_amount=Decimal(str(line.get("credit_amount") or 0.0)),
                narration=line.get("narration")
            )
            db.add(j_line)

        # 5. Certify Trial Balance before committing
        cls.validate_trial_balance(db)

        db.commit()
        db.refresh(journal)
        return journal

    @classmethod
    def reverse_journal_entry(cls, db: Session, entry_id: uuid.UUID, user_id: Optional[uuid.UUID] = None) -> JournalEntry:
        """
        Immutable reversal of a posted journal entry. Swaps debits/credits and links back.
        """
        original = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
        if not original:
            raise ValueError("Journal entry not found.")
        
        if original.status != "POSTED":
            raise ValueError(f"Only POSTED journals can be reversed. Current status: {original.status}")

        # Fetch user role
        user_role = None
        if user_id:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if user:
                user_role = user.role.value if hasattr(user.role, 'value') else str(user.role)

        # Period verification for today's date (posting date of reversal)
        now = datetime.utcnow()
        cls.validate_period_for_posting(db, now, user_role=user_role)

        # Create reversal entry (using sequential JV sequence)
        entry_num = cls.generate_journal_number(db, now)
        reversal = JournalEntry(
            entry_number=entry_num,
            entry_date=now,
            reference_type=original.reference_type,
            reference_id=original.reference_id,
            source_module=original.source_module,
            source_event="reversal",
            narration=f"Reversal of journal entry {original.entry_number}",
            status="POSTED",
            reversal_of_journal_entry_id=original.id,
            created_by_id=user_id
        )
        db.add(reversal)
        db.flush()

        # Swap debits and credits
        for line in original.journal_lines:
            rev_line = JournalLine(
                journal_entry_id=reversal.id,
                account_id=line.account_id,
                debit_amount=line.credit_amount,
                credit_amount=line.debit_amount,
                narration=f"Reversal: {line.narration or ''}"
            )
            db.add(rev_line)

        # Mark original as reversed
        original.status = "REVERSED"
        
        # Certify Trial Balance before committing
        cls.validate_trial_balance(db)
        
        db.commit()
        db.refresh(reversal)
        return reversal
