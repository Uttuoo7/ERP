import uuid
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import Account, JournalEntry, JournalLine

class LedgerService:
    """
    Service for calculating general ledger reports: Trial Balance, General Ledger, and Account Ledger.
    """

    @staticmethod
    def get_trial_balance(db: Session) -> Dict[str, Any]:
        """
        Generates Trial Balance.
        Ensures Sum(Debits) == Sum(Credits) across all GL accounts.
        """
        accounts = db.query(Account).filter(Account.is_deleted == False).order_by(Account.code).all()
        
        trial_lines = []
        total_debit = Decimal("0.0")
        total_credit = Decimal("0.0")

        for acc in accounts:
            # Aggregate debits and credits for this account
            debit_sum = db.query(func.sum(JournalLine.debit_amount)).join(JournalEntry).filter(
                JournalLine.account_id == acc.id,
                JournalEntry.status != "DRAFT",
                JournalLine.is_deleted == False
            ).scalar() or Decimal("0.0")

            credit_sum = db.query(func.sum(JournalLine.credit_amount)).join(JournalEntry).filter(
                JournalLine.account_id == acc.id,
                JournalEntry.status != "DRAFT",
                JournalLine.is_deleted == False
            ).scalar() or Decimal("0.0")

            # Determine net balance based on account type
            # Debit Accounts: Asset, Expense
            # Credit Accounts: Liability, Equity, Revenue
            is_debit_type = acc.account_type.upper() in ["ASSET", "EXPENSE"]
            
            if is_debit_type:
                net_balance = debit_sum - credit_sum
            else:
                net_balance = credit_sum - debit_sum

            total_debit += debit_sum
            total_credit += credit_sum

            trial_lines.append({
                "account_id": str(acc.id),
                "account_code": acc.code,
                "account_name": acc.name,
                "account_type": acc.account_type,
                "debit": float(debit_sum),
                "credit": float(credit_sum),
                "net_balance": float(net_balance),
                "balance_type": "DEBIT" if is_debit_type else "CREDIT"
            })

        is_balanced = abs(total_debit - total_credit) < Decimal("0.0001")

        return {
            "lines": trial_lines,
            "total_debit": float(total_debit),
            "total_credit": float(total_credit),
            "is_balanced": is_balanced
        }

    @staticmethod
    def get_general_ledger(db: Session) -> List[Dict[str, Any]]:
        """
        Lists chronological transactions across the entire GL with line breakdowns.
        """
        entries = db.query(JournalEntry).filter(
            JournalEntry.status != "DRAFT",
            JournalEntry.is_deleted == False
        ).order_by(JournalEntry.entry_date.desc()).all()

        gl_report = []
        for entry in entries:
            lines_data = []
            for line in entry.journal_lines:
                if line.is_deleted:
                    continue
                lines_data.append({
                    "line_id": str(line.id),
                    "account_code": line.account.code,
                    "account_name": line.account.name,
                    "debit": float(line.debit_amount),
                    "credit": float(line.credit_amount),
                    "narration": line.narration
                })

            gl_report.append({
                "entry_id": str(entry.id),
                "entry_number": entry.entry_number,
                "entry_date": entry.entry_date.isoformat(),
                "reference_type": entry.reference_type,
                "reference_id": str(entry.reference_id) if entry.reference_id else None,
                "source_module": entry.source_module,
                "source_event": entry.source_event,
                "narration": entry.narration,
                "status": entry.status,
                "lines": lines_data
            })

        return gl_report

    @staticmethod
    def get_account_ledger(db: Session, account_id: uuid.UUID) -> Dict[str, Any]:
        """
        Chronological ledger for a single account showing a running balance.
        """
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise ValueError("GL Account not found.")

        # Query all lines for this account chronologically
        lines = db.query(JournalLine).join(JournalEntry).filter(
            JournalLine.account_id == account_id,
            JournalEntry.status != "DRAFT",
            JournalLine.is_deleted == False
        ).order_by(JournalEntry.entry_date.asc(), JournalEntry.created_at.asc()).all()

        ledger_lines = []
        running_balance = Decimal("0.0")
        is_debit_type = account.account_type.upper() in ["ASSET", "EXPENSE"]

        for line in lines:
            debit = line.debit_amount
            credit = line.credit_amount

            if is_debit_type:
                running_balance += (debit - credit)
            else:
                running_balance += (credit - debit)

            ledger_lines.append({
                "line_id": str(line.id),
                "entry_number": line.journal_entry.entry_number,
                "entry_date": line.journal_entry.entry_date.isoformat(),
                "narration": line.narration or line.journal_entry.narration,
                "debit": float(debit),
                "credit": float(credit),
                "running_balance": float(running_balance)
            })

        return {
            "account_code": account.code,
            "account_name": account.name,
            "account_type": account.account_type,
            "balance_type": "DEBIT" if is_debit_type else "CREDIT",
            "lines": ledger_lines[::-1]  # Return reverse-chronological for display ease
        }
