import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import database, dependencies, models, schemas, event_dispatcher, document_traceability, rfq_comparison

router = APIRouter()

@router.get("/", response_model=List[schemas.RFQResponse])
def get_rfqs(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.RequestForQuotation).filter(models.RequestForQuotation.is_active == True)
    if search:
        query = query.filter(models.RequestForQuotation.rfq_number.ilike(f"%{search}%"))
    if status_filter:
        query = query.filter(models.RequestForQuotation.status == status_filter)
    return query.order_by(models.RequestForQuotation.created_at.desc()).all()

@router.post("/from-pr", response_model=schemas.RFQResponse, status_code=status.HTTP_201_CREATED)
def create_rfq_from_pr(
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Polymorphic RFQ Generator: Converts approved PR lines into a formal multi-vendor request.
    Automatically establishes document traceability linkages.
    """
    try:
        due_date_str = payload["due_date"]
        due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
        
        pr_line_ids = [uuid.UUID(lid) for lid in payload["pr_line_ids"]]
        
        # 1. Fetch pr lines
        pr_lines = db.query(models.PurchaseRequisitionLine).filter(models.PurchaseRequisitionLine.id.in_(pr_line_ids)).all()
        if not pr_lines:
            raise HTTPException(status_code=404, detail="No matching approved Requisition lines located.")
            
        pr_id = pr_lines[0].pr_id
        
        # 2. Sequence RFQ number
        prefix = ""
        category_id = pr_lines[0].requisition.category_id
        if category_id:
            cat = db.query(models.ProcurementCategory).filter(models.ProcurementCategory.id == category_id).first()
            if cat and cat.prefix:
                prefix = f"{cat.prefix}-"

        year = datetime.utcnow().year
        count = db.query(models.RequestForQuotation).count()
        rfq_number = f"{prefix}RFQ-{year}-{count + 1:04d}"
        
        # 3. Create RFQ Header
        rfq = models.RequestForQuotation(
            rfq_number=rfq_number,
            buyer_id=current_user.id,
            department_id=pr_lines[0].requisition.department_id,
            category_id=category_id,
            due_date=due_date,
            currency=payload.get("currency", "INR"),
            payment_terms=payload.get("payment_terms"),
            delivery_terms=payload.get("delivery_terms"),
            remarks=payload.get("remarks"),
            created_by_id=current_user.id
        )
        db.add(rfq)
        db.flush()
        
        # 4. Create RFQ Lines and track traceability mapping
        line_links = []
        for line in pr_lines:
            rfq_line = models.RequestForQuotationLine(
                rfq_id=rfq.id,
                pr_line_id=line.id,
                item_id=line.item_id,
                quantity=line.quantity,
                uom=line.uom,
                required_date=line.required_date,
                estimated_budget=line.estimated_price * line.quantity,
                technical_specifications=line.remarks
            )
            db.add(rfq_line)
            db.flush()
            
            # Map line link details
            line_links.append({
                "source_line_id": line.id,
                "target_line_id": rfq_line.id,
                "quantity_converted": float(line.quantity),
                "conversion_status": "COMPLETED"
            })
            
        db.commit()
        db.refresh(rfq)
        
        # 5. Dynamic Traceability link mapping
        document_traceability.create_relationship(
            db=db,
            source_type="PURCHASE_REQUISITION",
            source_id=pr_id,
            target_type="RFQ",
            target_id=rfq.id,
            relationship_type="CONVERSION",
            line_links=line_links,
            user_id=current_user.id
        )
        
        # Dispatch event
        event_dispatcher.dispatch(
            "rfq_created",
            {
                "rfq_id": rfq.id,
                "rfq_number": rfq.rfq_number,
                "user_id": current_user.id,
                "action": "GENERATED",
                "details": f"Generated RFQ {rfq.rfq_number} from Requisition lines."
            },
            db
        )
        
        return rfq
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing key in payload: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Data type parse error: {str(e)}")

@router.get("/{id}", response_model=schemas.RFQResponse)
def get_rfq_details(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    rfq = db.query(models.RequestForQuotation).filter(models.RequestForQuotation.id == id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="Request for Quotation not found.")
    return rfq

@router.post("/{id}/invite", response_model=schemas.RFQResponse)
def invite_vendors(
    id: uuid.UUID,
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Multi-Vendor Invitation console: dispatches invitation records to suppliers.
    """
    rfq = db.query(models.RequestForQuotation).filter(models.RequestForQuotation.id == id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found.")
        
    vendor_ids = [uuid.UUID(vid) for vid in payload.get("vendor_ids", [])]
    
    for vid in vendor_ids:
        # Avoid duplicate invites
        existing = db.query(models.RFQVendorInvitation).filter(
            models.RFQVendorInvitation.rfq_id == id,
            models.RFQVendorInvitation.vendor_id == vid
        ).first()
        if not existing:
            invite = models.RFQVendorInvitation(
                rfq_id=id,
                vendor_id=vid,
                invitation_status="INVITED"
            )
            db.add(invite)
            
    rfq.status = "SENT"
    db.commit()
    db.refresh(rfq)
    
    # Event dispatch
    event_dispatcher.dispatch(
        "rfq_vendors_invited",
        {
            "rfq_id": rfq.id,
            "rfq_number": rfq.rfq_number,
            "user_id": current_user.id,
            "action": "INVITED",
            "details": f"Invited {len(vendor_ids)} vendors to quote."
        },
        db
    )
    
    return rfq

@router.post("/{id}/quotations", response_model=schemas.VendorQuotationResponse)
def submit_quotation(
    id: uuid.UUID,
    vendor_id: uuid.UUID,
    payload: schemas.VendorQuotationCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Vendor Quotations Portal: Adds quotation bids.
    """
    rfq = db.query(models.RequestForQuotation).filter(models.RequestForQuotation.id == id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found.")
        
    # 1. Resolve invitation link
    invitation = db.query(models.RFQVendorInvitation).filter(
        models.RFQVendorInvitation.rfq_id == id,
        models.RFQVendorInvitation.vendor_id == vendor_id
    ).first()
    
    # Calculate totals
    taxes = float(payload.taxes)
    discounts = float(payload.discounts)
    
    # 2. Add Quotation Header
    quotation = models.VendorQuotation(
        rfq_id=id,
        vendor_id=vendor_id,
        invitation_id=invitation.id if invitation else None,
        quotation_number=payload.quotation_number,
        taxes=taxes,
        discounts=discounts,
        lead_time_days=payload.lead_time_days,
        delivery_commitment=payload.delivery_commitment,
        payment_terms=payload.payment_terms,
        validity_date=payload.validity_date,
        remarks=payload.remarks,
        created_by_id=current_user.id
    )
    db.add(quotation)
    db.flush()
    
    # 3. Add quotation lines
    total_val = 0.0
    for line in payload.line_items:
        # Locate matching rfq line to grab quantity
        rfq_l = db.query(models.RequestForQuotationLine).filter(models.RequestForQuotationLine.id == line.rfq_line_id).first()
        if rfq_l:
            qty = float(rfq_l.quantity)
            price = float(line.unit_price)
            line_ext = qty * price
            
            # Apply discounts and taxes
            line_ext -= line_ext * (float(line.discount_rate) / 100.0)
            line_ext += line_ext * (float(line.tax_rate) / 100.0)
            total_val += line_ext
            
        q_line = models.VendorQuotationLine(
            vendor_quotation_id=quotation.id,
            rfq_line_id=line.rfq_line_id,
            unit_price=line.unit_price,
            tax_rate=line.tax_rate,
            discount_rate=line.discount_rate,
            lead_time_days=line.lead_time_days,
            vendor_remarks=line.vendor_remarks
        )
        db.add(q_line)
        
    quotation.total_quoted_price = total_val + taxes - discounts
    
    # Update invitation status
    if invitation:
        invitation.invitation_status = "RESPONDED"
        
    # Update RFQ header status
    responded_count = db.query(models.RFQVendorInvitation).filter(
        models.RFQVendorInvitation.rfq_id == id,
        models.RFQVendorInvitation.invitation_status == "RESPONDED"
    ).count()
    
    if responded_count == len(rfq.invitations):
        rfq.status = "FULLY_RESPONDED"
    else:
        rfq.status = "PARTIALLY_RESPONDED"
        
    db.commit()
    db.refresh(quotation)
    
    event_dispatcher.dispatch(
        "quotation_submitted",
        {
            "rfq_id": id,
            "vendor_id": vendor_id,
            "quotation_id": quotation.id,
            "user_id": current_user.id,
            "action": "SUBMITTED",
            "details": f"Vendor '{quotation.vendor.name}' submitted quote QT-{quotation.quotation_number} with total value ₹{quotation.total_quoted_price:,.2f}"
        },
        db
    )
    
    return quotation

@router.get("/{id}/compare", response_model=schemas.RFQComparisonMatrixResponse)
def get_quote_comparison(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Weighted scoring comparison matrix: contraste multiple vendors side-by-side.
    """
    rfq = db.query(models.RequestForQuotation).filter(models.RequestForQuotation.id == id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found.")
    return rfq_comparison.generate_comparison_matrix(rfq)

@router.post("/{id}/select-vendor", response_model=schemas.RFQResponse)
def select_vendor(
    id: uuid.UUID,
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Decisions Portal: selects selected vendor, approves RFQ, dispatches PO generation triggers.
    """
    rfq = db.query(models.RequestForQuotation).filter(models.RequestForQuotation.id == id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found.")
        
    vendor_id = uuid.UUID(payload["vendor_id"])
    
    # 1. Unselect all quotes
    for q in rfq.quotations:
        q.is_selected = (q.vendor_id == vendor_id)
        
    rfq.status = "APPROVED"
    rfq.workflow_state = "COMPLETED"
    db.commit()
    db.refresh(rfq)
    
    event_dispatcher.dispatch(
        "rfq_vendor_selected",
        {
            "rfq_id": id,
            "vendor_id": vendor_id,
            "user_id": current_user.id,
            "action": "SELECTED",
            "details": f"RFQ approved. Optimal Vendor selected."
        },
        db
    )
    
    return rfq
