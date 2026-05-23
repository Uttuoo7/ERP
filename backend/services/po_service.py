import uuid
import logging
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from backend import models, schemas, event_dispatcher, document_traceability, workflow_engine, po_amendment
from backend.core.exceptions import EntityNotFoundException, WorkflowValidationException

logger = logging.getLogger(__name__)

class PurchaseOrderService:
    """
    Decoupled Service Layer for Purchase Order processing logic.
    Handles RFQ conversion, submit approvals, revisions, and status lifecycle operations.
    """

    @staticmethod
    def get_purchase_orders(
        db: Session,
        search: Optional[str] = None,
        status_filter: Optional[str] = None
    ) -> List[models.PurchaseOrder]:
        """Fetch all purchase orders filtered by query parameter criteria."""
        query = db.query(models.PurchaseOrder)
        if search:
            query = query.filter(models.PurchaseOrder.po_number.ilike(f"%{search}%"))
        if status_filter:
            query = query.filter(models.PurchaseOrder.status == status_filter)
        return query.order_by(models.PurchaseOrder.order_date.desc()).all()

    @staticmethod
    def get_purchase_order_details(db: Session, po_id: uuid.UUID) -> models.PurchaseOrder:
        """Fetch detail specifications of a specific purchase order."""
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
        if not po:
            raise EntityNotFoundException(f"Purchase Order with ID {po_id} not located.")
        return po

    @staticmethod
    def convert_rfq_to_po(
        db: Session,
        payload: Dict[str, Any],
        user_id: uuid.UUID,
        username: str
    ) -> models.PurchaseOrder:
        """
        RFQ to PO Conversion Engine: Transforms won vendor quotations into POs.
        Performs quantity over-ordering checks, resolves totals, and establishes dynamic traceability.
        """
        try:
            rfq_id = uuid.UUID(str(payload["rfq_id"]))
            vendor_id = uuid.UUID(str(payload["vendor_id"]))
            lines_payload = payload["lines"] # List[dict] mapping rfq_line_id -> quantity_ordered
            
            # 1. Fetch won quote
            quote = db.query(models.VendorQuotation).filter(
                models.VendorQuotation.rfq_id == rfq_id,
                models.VendorQuotation.vendor_id == vendor_id
            ).first()
            if not quote:
                raise EntityNotFoundException("Selected supplier quotation not located.")
                
            # 2. Sequence PO number
            year = datetime.utcnow().year
            count = db.query(models.PurchaseOrder).count()
            po_number = f"PO-{year}-{count + 1:04d}"
            
            # 3. Create PO Header
            po = models.PurchaseOrder(
                po_number=po_number,
                vendor_id=vendor_id,
                linked_rfq_id=rfq_id,
                department_id=quote.rfq.department_id,
                payment_terms=quote.payment_terms or "Standard Net 30",
                delivery_terms=quote.rfq.delivery_terms,
                expected_delivery_date=datetime.utcnow(),
                delivery_type="Warehouse",
                ship_to_contact_name=username,
                ship_to_company_name="Unified ERP Corp",
                ship_to_address_line1="Procurement Central Hub",
                ship_to_address_line2="Phase 2 Sector 4",
                ship_to_landmark="Near Logistics Gate",
                ship_to_city="Bengaluru",
                ship_to_state="Karnataka",
                ship_to_pin_code="560001",
                ship_to_phone="080-4554332",
                created_by_id=user_id,
                updated_by_id=user_id
            )
            db.add(po)
            db.flush()
            
            # 4. Convert Lines and execute remaining balances validations
            total_amount = Decimal(0.0)
            line_links = []
            
            for line_item in lines_payload:
                rfq_line_id = uuid.UUID(str(line_item["rfq_line_id"]))
                qty_ordered = int(line_item["quantity_ordered"])
                
                # Retrieve RFQ Line for quantity remaining tracking
                rfq_line = db.query(models.RequestForQuotationLine).filter(models.RequestForQuotationLine.id == rfq_line_id).first()
                if not rfq_line:
                    raise EntityNotFoundException("Matching Request For Quotation Line not found.")
                    
                # Quantity checks: ensure no over-ordering
                # Retrieve already ordered quantity for this RFQ line
                already_ordered = db.query(models.POLineItem).filter(models.POLineItem.rfq_line_id == rfq_line_id).all()
                sum_ordered = sum(x.quantity_ordered for x in already_ordered)
                
                remaining = rfq_line.quantity - sum_ordered
                if qty_ordered > remaining:
                    raise WorkflowValidationException(
                        f"Over-order prevented for SKU {rfq_line.item.sku}. Remaining: {remaining}, Requested: {qty_ordered}"
                    )
                    
                # Locate price details in vendor quotation
                quote_line = next((ql for ql in quote.line_items if ql.rfq_line_id == rfq_line_id), None)
                unit_price = Decimal(quote_line.unit_price if quote_line else 0.0)
                
                taxes = unit_price * qty_ordered * Decimal(0.18) # default 18% tax
                discounts = unit_price * qty_ordered * Decimal(0.05) # default 5% discount
                
                line_ext = (unit_price * qty_ordered) + taxes - discounts
                total_amount += line_ext
                
                po_line = models.POLineItem(
                    po_id=po.id,
                    rfq_line_id=rfq_line_id,
                    item_id=rfq_line.item_id,
                    quantity_ordered=qty_ordered,
                    unit_price=unit_price,
                    taxes=taxes,
                    discounts=discounts,
                    remaining_quantity=qty_ordered,
                    description=rfq_line.technical_specifications
                )
                db.add(po_line)
                db.flush()
                
                # Map line relationship details
                line_links.append({
                    "source_line_id": str(rfq_line_id),
                    "target_line_id": str(po_line.id),
                    "quantity_converted": float(qty_ordered),
                    "conversion_status": "COMPLETED" if qty_ordered == remaining else "PARTIAL"
                })
                
            po.total_amount = total_amount
            db.commit()
            db.refresh(po)
            
            # 5. Map Traceability link
            document_traceability.create_relationship(
                db=db,
                source_type="RFQ",
                source_id=rfq_id,
                target_type="PURCHASE_ORDER",
                target_id=po.id,
                relationship_type="CONVERSION",
                line_links=line_links,
                user_id=user_id
            )
            
            # Dispatch event
            event_dispatcher.dispatch(
                "po_created",
                {
                    "po_id": po.id,
                    "po_number": po.po_number,
                    "user_id": user_id,
                    "action": "CONVERTED",
                    "details": f"Generated Purchase Order {po.po_number} from RFQ quotation."
                },
                db
            )
            
            return po
        except KeyError as e:
            raise WorkflowValidationException(f"Missing key in conversion payload: {str(e)}")
        except ValueError as e:
            raise WorkflowValidationException(f"Invalid format parsed: {str(e)}")

    @staticmethod
    def submit_purchase_order(db: Session, po_id: uuid.UUID, user_id: uuid.UUID) -> models.PurchaseOrder:
        """
        Submits PO to dynamic approvals workflow engine.
        """
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
        if not po:
            raise EntityNotFoundException(f"PO with ID {po_id} not located.")
            
        if po.status != models.POStatus.DRAFT:
            raise WorkflowValidationException("Only DRAFT Purchase Orders can be submitted for approval.")
            
        po.workflow_state = "PENDING_APPROVAL"
        db.commit()
        
        # Trigger Dynamic approvals engine
        context = {
            "amount": float(po.total_amount),
            "department": po.department.name if po.department else "Purchasing",
            "version": po.amendment_version
        }
        
        workflow_engine.initialize_workflow("PURCHASE_ORDER", po.id, context, db)
        
        # Reload
        db.refresh(po)
        
        event_dispatcher.dispatch(
            "po_submitted",
            {
                "po_id": po.id,
                "po_number": po.po_number,
                "user_id": user_id,
                "action": "SUBMITTED",
                "details": f"Submitted PO {po.po_number} totaling ₹{po.total_amount:,.2f} for approval."
            },
            db
        )
        
        return po

    @staticmethod
    def amend_purchase_order(
        db: Session,
        po_id: uuid.UUID,
        payload: Dict[str, Any],
        user_id: uuid.UUID
    ) -> models.PurchaseOrder:
        """
        PO Revisions Console: Serializes current state, saves snapshot log, reverts status to DRAFT.
        """
        change_reason = payload.get("change_reason")
        if not change_reason or not change_reason.strip():
            raise WorkflowValidationException("Change reason for PO amendment is required.")
            
        try:
            po_amendment.archive_po_revision(
                db=db,
                po_id=po_id,
                change_reason=change_reason,
                user_id=user_id
            )
            
            # Fetch updated PO details
            po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
            if not po:
                raise EntityNotFoundException(f"PO with ID {po_id} not located.")
            
            event_dispatcher.dispatch(
                "po_amended",
                {
                    "po_id": po.id,
                    "po_number": po.po_number,
                    "user_id": user_id,
                    "action": "AMENDED",
                    "details": f"PO {po.po_number} amended to version {po.amendment_version}. Reason: {change_reason}"
                },
                db
            )
            
            return po
        except ValueError as e:
            raise EntityNotFoundException(str(e))

    @staticmethod
    def get_po_amendment_histories(db: Session, po_id: uuid.UUID) -> List[models.PurchaseOrderAmendment]:
        """Fetch history log of amendments made on a specific purchase order."""
        return db.query(models.PurchaseOrderAmendment).filter(
            models.PurchaseOrderAmendment.po_id == po_id
        ).order_by(models.PurchaseOrderAmendment.created_at.desc()).all()

    @staticmethod
    def update_purchase_order(
        db: Session,
        po_id: uuid.UUID,
        payload: schemas.PurchaseOrderUpdate,
        user_id: uuid.UUID
    ) -> models.PurchaseOrder:
        """
        Saves inline changes to PO header and line items during DRAFT / Re-amended states.
        """
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
        if not po:
            raise EntityNotFoundException(f"PO with ID {po_id} not found.")
            
        if po.status != models.POStatus.DRAFT:
            raise WorkflowValidationException("Only DRAFT Purchase Orders can be modified.")
            
        # Update properties
        po.department_id = payload.department_id
        po.project_id = payload.project_id
        po.cost_center_id = payload.cost_center_id
        po.payment_terms = payload.payment_terms
        po.delivery_terms = payload.delivery_terms
        po.expected_delivery_date = payload.expected_delivery_date
        po.ship_to_contact_name = payload.ship_to_contact_name
        po.ship_to_address_line1 = payload.ship_to_address_line1
        po.ship_to_city = payload.ship_to_city
        po.ship_to_state = payload.ship_to_state
        po.ship_to_pin_code = payload.ship_to_pin_code
        po.ship_to_phone = payload.ship_to_phone
        
        # Replace lines
        db.query(models.POLineItem).filter(models.POLineItem.po_id == po_id).delete()
        
        total_amount = Decimal(0.0)
        for line in payload.line_items:
            taxes = line.unit_price * line.quantity_ordered * Decimal(0.18)
            discounts = line.unit_price * line.quantity_ordered * Decimal(0.05)
            total_amount += (line.unit_price * line.quantity_ordered) + taxes - discounts
            
            po_line = models.POLineItem(
                po_id=po_id,
                rfq_line_id=line.rfq_line_id,
                item_id=line.item_id,
                quantity_ordered=line.quantity_ordered,
                unit_price=line.unit_price,
                taxes=taxes,
                discounts=discounts,
                remaining_quantity=line.quantity_ordered,
                description=line.description
            )
            db.add(po_line)
            
        po.total_amount = total_amount
        db.commit()
        db.refresh(po)
        
        return po
