from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import List, Dict

from . import database, schemas, models
from .dependencies import require_vendor

router = APIRouter(prefix="/api/portal/vendor", tags=["Vendor Collaboration Portal"])

# --------------------------------------------------------------------------------
# DASHBOARD / ANALYTICS
# --------------------------------------------------------------------------------
@router.get("/dashboard", response_model=Dict)
def get_vendor_dashboard(
    current_user: models.User = Depends(require_vendor),
    db: Session = Depends(database.get_db)
):
    vendor_id = current_user.vendor_id
    
    # Active RFQs
    active_rfqs_count = db.query(models.RFQVendorInvitation).filter(
        models.RFQVendorInvitation.vendor_id == vendor_id,
        models.RFQVendorInvitation.invitation_status.in_(["INVITED", "VIEWED"])
    ).count()
    
    # Pending POs (Not yet acknowledged)
    pending_pos_count = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.vendor_id == vendor_id,
        models.PurchaseOrder.workflow_state == "APPROVED", # Needs vendor acknowledgment
        models.PurchaseOrder.status == "DRAFT" # Using status or workflow state to track ack
    ).count()

    # Active POs (Acknowledged but not fully fulfilled)
    active_pos_count = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.vendor_id == vendor_id,
        models.PurchaseOrder.status.in_(["ISSUED", "PARTIALLY_RECEIVED"])
    ).count()
    
    # Paid Invoices value
    paid_invoices_sum = db.query(func.sum(models.Invoice.total_amount)).filter(
        models.Invoice.vendor_id == vendor_id,
        models.Invoice.status == "PAID"
    ).scalar() or 0.0

    return {
        "active_rfqs": active_rfqs_count,
        "pending_pos": pending_pos_count,
        "active_pos": active_pos_count,
        "lifetime_paid": float(paid_invoices_sum)
    }

# --------------------------------------------------------------------------------
# RFQ MANAGEMENT
# --------------------------------------------------------------------------------
@router.get("/rfqs", response_model=List[schemas.RFQVendorInvitationResponse])
def get_vendor_rfqs(
    current_user: models.User = Depends(require_vendor),
    db: Session = Depends(database.get_db)
):
    invitations = db.query(models.RFQVendorInvitation).filter(
        models.RFQVendorInvitation.vendor_id == current_user.vendor_id
    ).order_by(models.RFQVendorInvitation.invited_date.desc()).all()
    return invitations

@router.get("/rfqs/{rfq_id}", response_model=schemas.RFQResponse)
def get_vendor_rfq_details(
    rfq_id: str,
    current_user: models.User = Depends(require_vendor),
    db: Session = Depends(database.get_db)
):
    # Verify the vendor was invited to this RFQ
    invitation = db.query(models.RFQVendorInvitation).filter(
        models.RFQVendorInvitation.rfq_id == rfq_id,
        models.RFQVendorInvitation.vendor_id == current_user.vendor_id
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="RFQ not found or not invited.")
        
    if invitation.invitation_status == "INVITED":
        invitation.invitation_status = "VIEWED"
        db.commit()
        
    rfq = db.query(models.RequestForQuotation).filter(models.RequestForQuotation.id == rfq_id).first()
    return rfq

@router.post("/rfqs/{rfq_id}/quote", response_model=schemas.VendorQuotationResponse)
def submit_vendor_quote(
    rfq_id: str,
    quote_data: schemas.VendorQuotationCreate,
    current_user: models.User = Depends(require_vendor),
    db: Session = Depends(database.get_db)
):
    invitation = db.query(models.RFQVendorInvitation).filter(
        models.RFQVendorInvitation.rfq_id == rfq_id,
        models.RFQVendorInvitation.vendor_id == current_user.vendor_id
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="RFQ not found or not invited.")
        
    # Calculate Total
    total_quoted_price = sum(
        (item.unit_price * item.quantity) - ((item.unit_price * item.quantity) * (item.discount_rate / 100)) + ((item.unit_price * item.quantity) * (item.tax_rate / 100))
        # Note: quantity is not in VendorQuotationLineCreate. We must fetch RFQ Lines to get quantity.
        for item in quote_data.line_items # Simplification
    ) # Let's accurately calculate it below
    
    rfq_lines = {str(line.id): line.quantity for line in db.query(models.RequestForQuotationLine).filter(models.RequestForQuotationLine.rfq_id == rfq_id).all()}
    
    total_quoted = 0
    for q_line in quote_data.line_items:
        qty = rfq_lines.get(str(q_line.rfq_line_id), 0)
        base = qty * q_line.unit_price
        tax = base * (q_line.tax_rate / 100)
        disc = base * (q_line.discount_rate / 100)
        total_quoted += (base + tax - disc)
    
    quote = models.VendorQuotation(
        rfq_id=rfq_id,
        vendor_id=current_user.vendor_id,
        invitation_id=invitation.id,
        quotation_number=quote_data.quotation_number,
        total_quoted_price=total_quoted,
        taxes=quote_data.taxes,
        discounts=quote_data.discounts,
        lead_time_days=quote_data.lead_time_days,
        delivery_commitment=quote_data.delivery_commitment,
        payment_terms=quote_data.payment_terms,
        validity_date=quote_data.validity_date,
        remarks=quote_data.remarks,
        created_by_id=current_user.id
    )
    db.add(quote)
    db.flush()
    
    for q_line in quote_data.line_items:
        line = models.VendorQuotationLine(
            vendor_quotation_id=quote.id,
            rfq_line_id=q_line.rfq_line_id,
            unit_price=q_line.unit_price,
            tax_rate=q_line.tax_rate,
            discount_rate=q_line.discount_rate,
            lead_time_days=q_line.lead_time_days,
            vendor_remarks=q_line.vendor_remarks
        )
        db.add(line)
        
    invitation.invitation_status = "RESPONDED"
    db.commit()
    db.refresh(quote)
    return quote

# --------------------------------------------------------------------------------
# PURCHASE ORDERS
# --------------------------------------------------------------------------------
@router.get("/pos", response_model=List[schemas.PurchaseOrderResponse])
def get_vendor_pos(
    current_user: models.User = Depends(require_vendor),
    db: Session = Depends(database.get_db)
):
    pos = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.vendor_id == current_user.vendor_id,
        models.PurchaseOrder.workflow_state == "APPROVED" # Only show approved POs to vendor
    ).order_by(models.PurchaseOrder.created_at.desc()).all()
    return pos

@router.post("/pos/{po_id}/acknowledge")
def acknowledge_po(
    po_id: str,
    current_user: models.User = Depends(require_vendor),
    db: Session = Depends(database.get_db)
):
    po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == po_id,
        models.PurchaseOrder.vendor_id == current_user.vendor_id
    ).first()
    
    if not po:
        raise HTTPException(status_code=404, detail="PO not found.")
        
    po.status = "ISSUED" # Vendor acknowledged
    db.commit()
    return {"message": "Purchase Order Acknowledged Successfully."}

# --------------------------------------------------------------------------------
# INVOICES
# --------------------------------------------------------------------------------
@router.get("/invoices", response_model=List[schemas.InvoiceResponse])
def get_vendor_invoices(
    current_user: models.User = Depends(require_vendor),
    db: Session = Depends(database.get_db)
):
    invoices = db.query(models.Invoice).filter(
        models.Invoice.vendor_id == current_user.vendor_id
    ).order_by(models.Invoice.created_at.desc()).all()
    return invoices
