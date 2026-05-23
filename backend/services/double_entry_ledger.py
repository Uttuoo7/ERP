import uuid
import logging
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend import models, event_dispatcher
from backend.core.exceptions import LedgerImbalanceError

logger = logging.getLogger(__name__)

class DoubleEntryLedgerEngine:
    """
    Enterprise double-entry ledger bookkeeping validator and transaction creator.
    Enforces strict mathematical balance constraints where Sum(Debits) == Sum(Credits).
    """

    @staticmethod
    def validate_ledger_balance(debit_sum: Decimal, credit_sum: Decimal) -> None:
        """
        Enforce bookkeeping balancing constraint.
        Raises LedgerImbalanceError if debits do not equal credits.
        """
        # Avoid floating point issues by scaling decimals properly
        diff = abs(debit_sum - credit_sum)
        if diff > Decimal("0.0001"):
            logger.error(f"Double-entry balancing violation. Total Debits: {debit_sum}, Total Credits: {credit_sum}, Imbalance Diff: {diff}")
            raise LedgerImbalanceError(
                f"Double-entry financial transaction failed to balance. Total Debits: {debit_sum:,.2f}, Total Credits: {credit_sum:,.2f}. Out of balance by: {diff:,.2f}"
            )

    @classmethod
    def create_balanced_voucher(
        cls,
        db: Session,
        tx_data: Dict[str, Any],
        entries_data: List[Dict[str, Any]],
        tax_entries_data: Optional[List[Dict[str, Any]]] = None
    ) -> models.FinancialTransaction:
        """
        Atomically creates a financial transaction along with its associated double-entry ledger entries.
        Performs balancing checks before committing to the database.
        """
        debit_sum = Decimal("0.0")
        credit_sum = Decimal("0.0")

        # 1. Create Financial Transaction Header
        tx = models.FinancialTransaction(**tx_data)
        db.add(tx)
        db.flush()

        # 2. Add Ledger Entries & calculate sums
        for entry in entries_data:
            debit = Decimal(str(entry.get("debit_amount", 0)))
            credit = Decimal(str(entry.get("credit_amount", 0)))

            debit_sum += debit
            credit_sum += credit

            db_entry = models.LedgerEntry(
                financial_transaction_id=tx.id,
                account_name=entry["account_name"],
                debit_amount=debit,
                credit_amount=credit,
                narration=entry.get("narration")
            )
            db.add(db_entry)

        # 3. Enforce debit-credit parity constraint
        cls.validate_ledger_balance(debit_sum, credit_sum)

        # 4. Add Tax Entries (if any)
        if tax_entries_data:
            for tax in tax_entries_data:
                db_tax = models.TaxEntry(
                    financial_transaction_id=tx.id,
                    tax_type=tax["tax_type"],
                    taxable_amount=Decimal(str(tax["taxable_amount"])),
                    tax_rate=Decimal(str(tax["tax_rate"])),
                    tax_amount=Decimal(str(tax["tax_amount"])),
                    tax_ledger_name=tax["tax_ledger_name"]
                )
                db.add(db_tax)

        db.flush()
        return tx
