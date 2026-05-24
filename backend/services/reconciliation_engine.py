import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
from datetime import datetime
from . import models
import random

logger = logging.getLogger(__name__)

def perform_nightly_reconciliation(db: Session) -> models.TallyReconciliationReport:
    """
    Simulates polling TallyPrime gateway for current closing balances and vouchers
    and comparing it with the ERP's FinancialTransaction ledger.
    """
    logger.info("Starting Tally Reconciliation Engine...")
    
    # 1. Aggregate ERP Totals
    erp_voucher_count = db.query(models.FinancialTransaction).count()
    erp_total_debit = db.query(func.sum(models.FinancialTransaction.total_amount)).scalar() or Decimal(0)
    
    # 2. Simulate Polling Tally Totals
    # In a real environment, this would send an XML request to Tally and parse the response
    tally_voucher_count = erp_voucher_count # Simulate perfect sync for most cases
    tally_total_debit = erp_total_debit
    
    # Add artificial discrepancy for demonstration if random threshold is met
    if random.random() > 0.8:
        tally_voucher_count -= 1
        tally_total_debit -= Decimal("1500.00")
        
    mismatch_count = abs(erp_voucher_count - tally_voucher_count)
    status = "MATCHED" if mismatch_count == 0 and erp_total_debit == tally_total_debit else "MISMATCH"
    
    mismatch_details = None
    if status == "MISMATCH":
        mismatch_details = f"Tally is missing {mismatch_count} vouchers. ERP Debit: {erp_total_debit}, Tally: {tally_total_debit}"
        
    report = models.TallyReconciliationReport(
        total_erp_vouchers=erp_voucher_count,
        total_tally_vouchers=tally_voucher_count,
        erp_total_debit=erp_total_debit,
        tally_total_debit=tally_total_debit,
        mismatch_count=mismatch_count,
        status=status,
        mismatch_details=mismatch_details
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    logger.info(f"Reconciliation completed. Status: {status}")
    return report
