import uuid
import random
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas, event_dispatcher, tally_sync
from .services.double_entry_ledger import DoubleEntryLedgerEngine

logger = logging.getLogger(__name__)

def generate_financial_tx_number(prefix: str) -> str:
    return f"FT-{prefix}-{random.randint(10000, 99999)}"

def create_ap_invoice_voucher(db: Session, invoice_id: uuid.UUID, user_id: uuid.UUID) -> models.FinancialTransaction:
    """
    3-Way Match & Double-Entry Post:
    Compares Invoice quantity against PO ordered and GRN accepted balances.
    Creates balanced journal vouchers, tax ledgers, vendor liabilities, and sync tasks.
    """
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise ValueError("AP Invoice not located.")

    # Prevent duplicate posting
    existing = db.query(models.FinancialTransaction).filter(
        models.FinancialTransaction.reference_type == "INVOICE",
        models.FinancialTransaction.reference_id == invoice_id
    ).first()
    if existing:
        return existing

    po = invoice.purchase_order
    if not po:
        raise ValueError("Purchase Order reference not found on invoice.")

    # 1. 3-Way Matching Verification Checklist
    match_discrepancies = []
    for inv_line in invoice.line_items:
        # Find corresponding PO line
        po_line = inv_line.po_line_item
        if not po_line:
            continue
            
        ordered = po_line.quantity_ordered
        # Find accepted GRN quantities
        grn_accepted = 0
        for grn_line in po_line.grn_line_items:
            grn_accepted += grn_line.quantity_accepted

        billed = inv_line.quantity_billed

        # Verify quantities match
        if billed > ordered:
            match_discrepancies.append(
                f"Item SKU {po_line.item.sku}: Billed quantity ({billed}) exceeds ordered quantity ({ordered})."
            )
        if billed > grn_accepted:
            match_discrepancies.append(
                f"Item SKU {po_line.item.sku}: Billed quantity ({billed}) exceeds GRN accepted quantity ({grn_accepted})."
            )

    if match_discrepancies:
        logger.warning(f"3-Way Match warnings for Invoice {invoice.invoice_number}: {match_discrepancies}")

    # 2. Setup accounting dimension maps
    department_id = po.department_id
    project_id = po.project_id
    cost_center_id = po.cost_center_id
    vendor_id = invoice.vendor_id
    warehouse_id = po.warehouse_id

    # 3. Create Balanced Voucher
    tx_num = generate_financial_tx_number("JV")
    tx = models.FinancialTransaction(
        transaction_number=tx_num,
        transaction_type="AP_INVOICE",
        transaction_date=datetime.utcnow(),
        reference_type="INVOICE",
        reference_id=invoice_id,
        total_amount=invoice.total_amount,
        status="POSTED",
        department_id=department_id,
        project_id=project_id,
        cost_center_id=cost_center_id,
        vendor_id=vendor_id,
        warehouse_id=warehouse_id,
        created_by_id=user_id
    )
    db.add(tx)
    db.flush()

    # 4. Balanced Journal Bookkeeping Postings (Double-Entry)
    gst_val = Decimal(str(invoice.gst_amount or 0))
    tds_val = Decimal(str(invoice.tds_deducted or 0))
    net_liability = Decimal(str(invoice.total_amount or 0))
    taxable_base = net_liability - gst_val + tds_val

    debit_sum = Decimal("0.0")
    credit_sum = Decimal("0.0")

    # Entry 1: Debit Purchase/Expense Account
    db.add(models.LedgerEntry(
        financial_transaction_id=tx.id,
        account_name="Purchase Control Account",
        debit_amount=taxable_base,
        credit_amount=Decimal("0.0"),
        narration=f"Expense booked under {invoice.invoice_number} / PO {po.po_number}"
    ))
    debit_sum += taxable_base

    # Entry 2: Debit Tax Receivable account (if GST exists)
    if gst_val > 0:
        db.add(models.LedgerEntry(
            financial_transaction_id=tx.id,
            account_name="GST Input Receivable Account",
            debit_amount=gst_val,
            credit_amount=Decimal("0.0"),
            narration=f"Input GST claimed for invoice {invoice.invoice_number}"
        ))
        debit_sum += gst_val

    # Entry 3: Credit TDS Payable account (if TDS exists)
    if tds_val > 0:
        db.add(models.LedgerEntry(
            financial_transaction_id=tx.id,
            account_name="TDS Payable Control Account",
            debit_amount=Decimal("0.0"),
            credit_amount=tds_val,
            narration=f"TDS deducted at source for invoice {invoice.invoice_number}"
        ))
        credit_sum += tds_val

    # Entry 4: Credit Accounts Payable Control Account (Creditors Liability)
    db.add(models.LedgerEntry(
        financial_transaction_id=tx.id,
        account_name="Accounts Payable Control Account",
        debit_amount=Decimal("0.0"),
        credit_amount=net_liability,
        narration=f"Vendor liability logged for {invoice.vendor.name}"
    ))
    credit_sum += net_liability

    # Validate Ledger Balancing Integrity
    DoubleEntryLedgerEngine.validate_ledger_balance(debit_sum, credit_sum)

    # 5. Populate Tax Lines Breakdown
    if gst_val > 0:
        # Default GST distribution to CGST & SGST (9% each for standard 18% tax)
        half_gst = gst_val / 2
        db.add(models.TaxEntry(
            financial_transaction_id=tx.id,
            tax_type="CGST",
            taxable_amount=taxable_base,
            tax_rate=Decimal("9.0"),
            tax_amount=half_gst,
            tax_ledger_name="CGST Input Account"
        ))
        db.add(models.TaxEntry(
            financial_transaction_id=tx.id,
            tax_type="SGST",
            taxable_amount=taxable_base,
            tax_rate=Decimal("9.0"),
            tax_amount=half_gst,
            tax_ledger_name="SGST Input Account"
        ))

    if tds_val > 0:
        db.add(models.TaxEntry(
            financial_transaction_id=tx.id,
            tax_type="TDS",
            taxable_amount=taxable_base,
            tax_rate=Decimal("1.0"),
            tax_amount=tds_val,
            tax_ledger_name="TDS Payable Account"
        ))

    # 6. Post Vendor payables liability
    due_date = invoice.due_date or (datetime.utcnow() + timedelta(days=30))
    liability = models.VendorLiability(
        vendor_id=invoice.vendor_id,
        invoice_id=invoice.id,
        original_amount=net_liability,
        outstanding_amount=net_liability,
        due_date=due_date,
        status="UNPAID"
    )
    db.add(liability)
    db.flush()

    # 7. Update AP Invoice status
    invoice.status = models.InvoiceStatus.APPROVED
    db.flush()

    # 8. Synchronize to Tally synchronizer queue
    tally_sync.enqueue_transaction(db, tx.id)

    # 9. Dispatches Finance Audit Events
    event_dispatcher.dispatch(
        "invoice_approved",
        {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "liability_id": liability.id,
            "total_amount": float(net_liability),
            "match_discrepancies": match_discrepancies
        },
        db
    )

    db.commit()
    logger.info(f"Finance Ledger Engine: AP Invoice {invoice.invoice_number} successfully posted as balanced journal {tx.transaction_number}.")
    return tx

def record_vendor_payment(
    db: Session,
    vendor_id: uuid.UUID,
    amount: Decimal,
    payment_method: str,
    ref_no: str,
    invoice_allocations: List[schemas.InvoiceAllocationCreate],
    user_id: uuid.UUID
) -> models.FinancialTransaction:
    """
    Records Vendor Payment transaction, maps allocations against liabilities,
    posts double-entry offsets, and enqueues tally synchronizer tasks.
    """
    total_allocated = sum(Decimal(str(x.allocated_amount)) for x in invoice_allocations)
    if total_allocated != amount:
        raise ValueError(
            f"Payment Allocation Error: Amount paid ({amount}) must match the sum of allocations ({total_allocated})."
        )

    # 1. Create balanced PAYMENT voucher
    tx_num = generate_financial_tx_number("PY")
    tx = models.FinancialTransaction(
        transaction_number=tx_num,
        transaction_type="PAYMENT",
        transaction_date=datetime.utcnow(),
        reference_type="PAYMENT",
        reference_id=uuid.uuid4(), # standalone payment UUID
        total_amount=amount,
        status="POSTED",
        vendor_id=vendor_id,
        created_by_id=user_id
    )
    db.add(tx)
    db.flush()

    # 2. Balanced Bookkeeping Double-entry Posting
    # Debit: Accounts Payable Control Account
    db.add(models.LedgerEntry(
        financial_transaction_id=tx.id,
        account_name="Accounts Payable Control Account",
        debit_amount=amount,
        credit_amount=Decimal("0.0"),
        narration=f"Payment allocated against open liabilities. Ref {ref_no}"
    ))

    # Credit: Bank Account
    db.add(models.LedgerEntry(
        financial_transaction_id=tx.id,
        account_name="Bank Account",
        debit_amount=Decimal("0.0"),
        credit_amount=amount,
        narration=f"Cash/Bank outflow via {payment_method}. Ref {ref_no}"
    ))

    # Validate Ledger Balancing Integrity
    DoubleEntryLedgerEngine.validate_ledger_balance(amount, amount)

    # 3. Apply Allocations to Outstanding Liabilities
    for alloc in invoice_allocations:
        liability = db.query(models.VendorLiability).filter(
            models.VendorLiability.id == alloc.vendor_liability_id
        ).first()
        if not liability:
            raise ValueError(f"Vendor Liability record {alloc.vendor_liability_id} not found.")

        paid_qty = Decimal(str(alloc.allocated_amount))
        if paid_qty > liability.outstanding_amount:
            raise ValueError(
                f"Allocation overflow: Paid allocation ({paid_qty}) exceeds open outstanding balance ({liability.outstanding_amount})."
            )

        liability.outstanding_amount -= paid_qty
        liability.last_payment_date = datetime.utcnow()

        # Update liability status
        if liability.outstanding_amount == 0:
            liability.status = "PAID"
            # Update source invoice status to PAID if fully paid
            invoice = liability.invoice
            if invoice:
                invoice.status = models.InvoiceStatus.PAID
        else:
            liability.status = "PARTIALLY_PAID"

        # Record payment mapping
        mapping = models.PaymentAllocation(
            financial_transaction_id=tx.id,
            vendor_liability_id=liability.id,
            allocated_amount=paid_qty,
            allocation_date=datetime.utcnow()
        )
        db.add(mapping)

    db.flush()

    # 4. Enqueue PAYMENT transaction in tally queue
    tally_sync.enqueue_transaction(db, tx.id)

    # 5. Emit Events
    event_dispatcher.dispatch(
        "payment_allocated",
        {
            "payment_id": tx.id,
            "payment_ref": ref_no,
            "amount": float(amount),
            "vendor_id": vendor_id
        },
        db
    )

    db.commit()
    logger.info(f"Finance Ledger Engine: Payment {ref_no} recorded for {amount} INR.")
    return tx

def calculate_payables_aging(db: Session) -> List[schemas.LiabilityAgingSummary]:
    """
    Payables Aging calculation bucketed into 0-30, 31-60, 61-90, 91+ day bands.
    """
    now = datetime.utcnow()
    
    # Query all active liabilities that are unpaid or partially paid
    liabilities = db.query(models.VendorLiability).filter(
        models.VendorLiability.outstanding_amount > 0
    ).all()

    aging_map = {}

    for liab in liabilities:
        v_id = liab.vendor_id
        v_name = liab.vendor.name if liab.vendor else "Unknown Vendor"
        outstanding = liab.outstanding_amount
        due = liab.due_date

        days_overdue = (now - due).days

        # Initialize map
        if v_id not in aging_map:
            aging_map[v_id] = {
                "vendor_id": v_id,
                "vendor_name": v_name,
                "total_outstanding": Decimal("0.0"),
                "current_bucket": Decimal("0.0"),
                "bucket_30_60": Decimal("0.0"),
                "bucket_60_90": Decimal("0.0"),
                "bucket_over_90": Decimal("0.0")
            }

        aging_map[v_id]["total_outstanding"] += outstanding

        # Bucket sorting
        if days_overdue <= 0:
            # Not overdue yet or within current cycle
            aging_map[v_id]["current_bucket"] += outstanding
        elif days_overdue <= 30:
            aging_map[v_id]["current_bucket"] += outstanding
        elif days_overdue <= 60:
            aging_map[v_id]["bucket_30_60"] += outstanding
        elif days_overdue <= 90:
            aging_map[v_id]["bucket_60_90"] += outstanding
        else:
            aging_map[v_id]["bucket_over_90"] += outstanding

    # Convert map back to list format
    return [schemas.LiabilityAgingSummary(**v) for v in aging_map.values()]
