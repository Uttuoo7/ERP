import uuid
import logging
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from . import models, event_dispatcher, commitment_engine

logger = logging.getLogger(__name__)

# Configurable Tolerance Rules
PRICE_TOLERANCE_PCT = Decimal("0.02")  # 2% price discrepancy tolerance limit
QTY_TOLERANCE_PCT = Decimal("0.00")    # 0% quantity overbilling block limit

def run_three_way_match(db: Session, invoice_id: uuid.UUID) -> models.Invoice:
    """
    3-Way Match Algorithm:
    Automatically compares PO line items vs. GRN accepted counts vs. Vendor Invoice bill details.
    Flags overbillings, price variances, and computes discrepancies.
    """
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise ValueError("Invoice to match not located.")

    invoice.status = models.InvoiceStatus.PENDING_MATCHING
    db.flush()

    mismatch_found = False

    for inv_line in invoice.line_items:
        po_line = inv_line.po_line_item
        if not po_line:
            inv_line.match_status = "MISMATCH_DETECTED"
            inv_line.variance_amount = Decimal("0.0")
            mismatch_found = True
            continue

        # Get accepted received quantities from connected GRNs
        grn_accepted = 0
        if inv_line.grn_line_item_id:
            grn_line = db.query(models.GRNLineItem).filter(models.GRNLineItem.id == inv_line.grn_line_item_id).first()
            if grn_line:
                grn_accepted = getattr(grn_line, "accepted_qty", getattr(grn_line, "quantity_accepted", 0))
        else:
            # Fallback: sum all GRN accepted lines corresponding to this PO line
            grn_accepted = sum(getattr(g, "accepted_qty", getattr(g, "quantity_accepted", 0)) for g in po_line.grn_line_items)

        # 1. Price Verification
        price_diff = inv_line.unit_price - po_line.unit_price
        price_discrepancy = price_diff > 0 and (price_diff / po_line.unit_price) > PRICE_TOLERANCE_PCT

        # 2. Quantity Verification (Prevention of Overbilling or Short Receipts)
        qty_over_po = inv_line.quantity_billed > po_line.quantity_ordered
        qty_over_grn = inv_line.quantity_billed > grn_accepted

        # Calculate Variance Value
        inv_line.variance_amount = price_diff * inv_line.quantity_billed

        # Determine line match status
        if price_discrepancy or qty_over_po or qty_over_grn:
            inv_line.match_status = "MISMATCH_DETECTED"
            mismatch_found = True
        else:
            inv_line.match_status = "MATCHED"

    # Set overall invoice status
    if mismatch_found:
        invoice.status = models.InvoiceStatus.MISMATCH_DETECTED
        # Emit mismatch event
        event_dispatcher.dispatch(
            "mismatch_detected",
            {
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "vendor_id": invoice.vendor_id
            },
            db
        )
    else:
        invoice.status = models.InvoiceStatus.MATCHED
        
        # Transition Accrued to Actual
        po = invoice.purchase_order
        if po:
            budget_context = {
                "department_id": po.department_id,
                "category_id": po.category_id,
                "project_id": None,
                "cost_center_id": None
            }
            commitment_engine.transition_accrued_to_actual(db, float(invoice.total_amount), budget_context, "INV", invoice.id)

        # Emit matched event
        event_dispatcher.dispatch(
            "invoice_matched",
            {
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "vendor_id": invoice.vendor_id
            },
            db
        )

    db.commit()
    logger.info(f"3-Way Match Check for Invoice {invoice.invoice_number} completed: Status {invoice.status}")
    return invoice

def resolve_variance(
    db: Session,
    invoice_id: uuid.UUID,
    resolutions: Dict[uuid.UUID, str],
    user_id: uuid.UUID
) -> models.Invoice:
    """
    Variance Resolution:
    Allows authorized finance review teams to resolve mismatches and override discrepancies.
    Once resolved, marks invoice as PENDING_APPROVAL.
    """
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise ValueError("Invoice not located.")

    for line in invoice.line_items:
        if line.id in resolutions:
            action = resolutions[line.id] # APPROVED, ACCEPTED
            if action in ["APPROVED", "ACCEPTED"]:
                line.match_status = "MATCHED"
                
                # Log audit trail event
                db.add(models.AuditTrail(
                    user_id=user_id,
                    action="RESOLVE_VARIANCE",
                    details=f"Manually resolved discrepancy for line {line.id} (Action: {action})"
                ))

    # Re-evaluate invoice overall status
    still_mismatched = any(l.match_status == "MISMATCH_DETECTED" for l in invoice.line_items)
    if not still_mismatched:
        invoice.status = models.InvoiceStatus.PENDING_APPROVAL
        
        # Dispatch event
        event_dispatcher.dispatch(
            "invoice_matched",
            {
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "vendor_id": invoice.vendor_id
            },
            db
        )
    else:
        invoice.status = models.InvoiceStatus.MISMATCH_DETECTED

    db.commit()
    return invoice
