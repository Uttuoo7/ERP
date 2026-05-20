import json
import logging
from typing import Any, Dict
from sqlalchemy.orm import Session
from . import models

logger = logging.getLogger(__name__)

def archive_po_revision(db: Session, po_id: Any, change_reason: str, user_id: Any) -> models.PurchaseOrderAmendment:
    """
    Serializes a snapshot of the current PO header and line items, logs it in
    PurchaseOrderAmendment, increments the version count, and resets the status to DRAFT.
    """
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise ValueError("Purchase Order not located for archiving.")
        
    logger.info(f"PO Revision Engine: Archiving version {po.amendment_version} for PO {po.po_number} - Reason: {change_reason}")
    
    # 1. Compile snapshot dictionary
    snapshot = {
        "po_number": po.po_number,
        "vendor_id": str(po.vendor_id) if po.vendor_id else None,
        "vendor_name": po.vendor.name if po.vendor else None,
        "order_date": po.order_date.isoformat() if po.order_date else None,
        "expected_delivery_date": po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
        "payment_terms": po.payment_terms,
        "delivery_terms": po.delivery_terms,
        "tax_summary": po.tax_summary,
        "discount_summary": po.discount_summary,
        "total_amount": float(po.total_amount),
        "delivery_type": po.delivery_type,
        "ship_to_contact_name": po.ship_to_contact_name,
        "ship_to_company_name": po.ship_to_company_name,
        "ship_to_address_line1": po.ship_to_address_line1,
        "ship_to_address_line2": po.ship_to_address_line2,
        "ship_to_landmark": po.ship_to_landmark,
        "ship_to_city": po.ship_to_city,
        "ship_to_state": po.ship_to_state,
        "ship_to_pin_code": po.ship_to_pin_code,
        "ship_to_phone": po.ship_to_phone,
        "status": po.status.value if hasattr(po.status, "value") else str(po.status),
        "workflow_state": po.workflow_state,
        "line_items": [
            {
                "item_sku": line.item.sku,
                "item_name": line.item.name,
                "quantity_ordered": line.quantity_ordered,
                "unit_price": float(line.unit_price),
                "taxes": float(line.taxes),
                "discounts": float(line.discounts),
                "delivery_date": line.delivery_date.isoformat() if line.delivery_date else None,
                "description": line.description
            }
            for line in po.line_items
        ]
    }
    
    # 2. Add Amendment Row
    amendment = models.PurchaseOrderAmendment(
        po_id=po.id,
        amendment_number=po.amendment_version,
        change_reason=change_reason,
        snapshot_data=json.dumps(snapshot),
        created_by_id=user_id
    )
    db.add(amendment)
    
    # 3. Increment PO version and reset status to DRAFT
    po.amendment_version += 1
    po.status = models.POStatus.DRAFT
    po.workflow_state = "PENDING"
    
    db.commit()
    db.refresh(po)
    
    return amendment
