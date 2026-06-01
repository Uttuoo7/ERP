from sqlalchemy.orm import Session
from decimal import Decimal
import uuid
import logging
from datetime import datetime

from . import models, numbering_engine

logger = logging.getLogger(__name__)

def evaluate_3way_match(db: Session, invoice: models.Invoice, po: models.PurchaseOrder, grn: models.GoodsReceiptNote):
    """
    Compares PO vs GRN vs Invoice to ensure that the invoice doesn't bill more than what was received.
    """
    mismatches = []
    
    # 1. Total Quantity Match
    total_inv_qty = sum(item.quantity for item in invoice.line_items)
    total_grn_accepted = sum(item.accepted_qty for item in grn.line_items)
    
    if total_inv_qty > total_grn_accepted:
        mismatches.append({
            "type": "QUANTITY_MISMATCH",
            "expected": str(total_grn_accepted),
            "actual": str(total_inv_qty),
            "variance": total_inv_qty - total_grn_accepted,
            "severity": "CRITICAL"
        })
        
    # 2. Rate Mismatch (against PO)
    for inv_line in invoice.line_items:
        po_line = next((l for l in po.line_items if l.item_id == inv_line.item_id), None)
        if po_line and inv_line.unit_price > po_line.unit_price:
            variance = inv_line.unit_price - po_line.unit_price
            severity = "HIGH" if (variance / po_line.unit_price) > Decimal("0.05") else "LOW"
            mismatches.append({
                "type": "RATE_MISMATCH",
                "expected": str(po_line.unit_price),
                "actual": str(inv_line.unit_price),
                "variance": variance,
                "severity": severity
            })

    # Save mismatches
    for mm in mismatches:
        mismatch_record = models.InvoiceMismatch(
            invoice_id=invoice.id,
            mismatch_type=mm["type"],
            expected_value=mm["expected"],
            actual_value=mm["actual"],
            variance=mm["variance"],
            severity=mm["severity"],
            remarks="Auto-generated during 3-way match"
        )
        db.add(mismatch_record)
        
    return len([m for m in mismatches if m["severity"] in ["HIGH", "CRITICAL"]]) == 0

def generate_ap_voucher(db: Session, invoice_id: uuid.UUID):
    """
    Creates an Accounts Payable Voucher from an approved Invoice.
    Calculates TDS and posts the initial liability to the Vendor Ledger.
    """
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise ValueError("Invoice not found")
        
    if invoice.status != "APPROVED":
        raise ValueError("Invoice must be approved to generate AP Voucher")
        
    # 1. Check if AP already exists
    existing_ap = db.query(models.AccountsPayable).filter(models.AccountsPayable.invoice_id == invoice.id).first()
    if existing_ap:
        return existing_ap
        
    # 2. Match Invoice (3-way if GRN linked, else 2-way)
    po = invoice.purchase_order
    grn = invoice.goods_receipt_note
    
    if po and grn:
        is_clean = evaluate_3way_match(db, invoice, po, grn)
        if not is_clean:
            # Depending on business rules, we might pause here. For now, we proceed but log it.
            logger.warning(f"Invoice {invoice.invoice_number} has severe mismatches.")
            
    # 3. TDS Calculation
    # Fetch active TDS configuration based on vendor/invoice parameters (Simplified here)
    tds_config = db.query(models.TDSConfiguration).filter(models.TDSConfiguration.is_active == True).first()
    
    invoice_base_amount = sum(line.total for line in invoice.line_items) # exclusive of tax
    tds_deducted = Decimal("0.0")
    
    if tds_config and invoice_base_amount > tds_config.threshold_limit:
        tds_deducted = invoice_base_amount * (tds_config.percentage / Decimal("100.0"))
        
    payable_amount = invoice.total_amount - tds_deducted
    
    # 4. Create AP Voucher
    ap_num = numbering_engine.generate_document_number(db, "AP", models.AccountsPayable, "ap_number")
    
    ap_voucher = models.AccountsPayable(
        ap_number=ap_num,
        vendor_id=invoice.vendor_id,
        invoice_id=invoice.id,
        po_id=invoice.po_id,
        grn_id=invoice.grn_id,
        invoice_amount=invoice_base_amount,
        gst_amount=invoice.total_amount - invoice_base_amount, # simplified
        tds_amount=tds_deducted,
        payable_amount=payable_amount,
        paid_amount=Decimal("0.0"),
        balance_amount=payable_amount,
        due_date=invoice.due_date,
        payment_status="PENDING",
        approval_status="APPROVED" # Auto-approve AP if Invoice is approved
    )
    db.add(ap_voucher)
    db.flush()
    
    # 5. Post to Vendor Ledger
    ledger_entry = models.VendorLedger(
        vendor_id=invoice.vendor_id,
        transaction_type="INVOICE",
        reference_type="AP_VOUCHER",
        reference_id=ap_voucher.id,
        credit_amount=payable_amount, # Credit increases liability (we owe the vendor)
        remarks=f"AP Generation for Invoice {invoice.invoice_number}"
    )
    db.add(ledger_entry)
    
    # Recalculate running balance
    recalculate_vendor_running_balance(db, invoice.vendor_id)
    
    db.commit()
    return ap_voucher

def recalculate_vendor_running_balance(db: Session, vendor_id: uuid.UUID):
    """
    Re-aggregates all ledger entries sequentially to ensure running balance integrity.
    Positive balance = Company owes Vendor (Credit balance)
    Negative balance = Vendor owes Company (Debit balance / Advance)
    """
    entries = db.query(models.VendorLedger).filter(models.VendorLedger.vendor_id == vendor_id).order_by(models.VendorLedger.created_at.asc()).all()
    
    running_bal = Decimal("0.0")
    for entry in entries:
        running_bal += (entry.credit_amount - entry.debit_amount)
        entry.running_balance = running_bal
        
    db.flush()
