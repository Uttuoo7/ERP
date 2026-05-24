import logging
import json
from sqlalchemy.orm import Session
from .. import models

logger = logging.getLogger(__name__)

def dispatch_outbound_event(db: Session, entity_type: str, entity_id: str, event_type: str):
    """
    Constructs an integration payload and queues it in the SyncEventLog.
    Called when workflows approve a PO or Invoice.
    """
    logger.info(f"Dispatching outbound integration event: {entity_type} {entity_id} - {event_type}")
    
    # Find all active integration configurations
    active_configs = db.query(models.IntegrationConfig).filter(models.IntegrationConfig.is_active == True).all()
    
    if not active_configs:
        logger.info("No active integrations found. Skipping dispatch.")
        return
        
    # Build Payload
    payload = build_payload(db, entity_type, entity_id, event_type)
    
    for config in active_configs:
        log_entry = models.SyncEventLog(
            integration_id=config.id,
            entity_type=entity_type,
            entity_id=entity_id,
            direction="OUTBOUND",
            status="PENDING",
            payload=json.dumps(payload)
        )
        db.add(log_entry)
        
    db.commit()
    
    # The background Celery task `process_pending_syncs` will pick this up
    logger.info(f"Queued outbound sync for {len(active_configs)} integrations.")

def build_payload(db: Session, entity_type: str, entity_id: str, event_type: str) -> dict:
    """
    Builds a generic JSON representation of the entity.
    """
    if entity_type == "INVOICE":
        invoice = db.query(models.Invoice).filter(models.Invoice.id == entity_id).first()
        if not invoice:
            return {}
            
        return {
            "event": event_type,
            "entity": "INVOICE",
            "data": {
                "id": str(invoice.id),
                "invoice_number": invoice.invoice_number,
                "vendor_id": str(invoice.vendor_id),
                "total_amount": float(invoice.total_amount),
                "status": invoice.status
            }
        }
    
    if entity_type == "VENDOR":
        vendor = db.query(models.Vendor).filter(models.Vendor.id == entity_id).first()
        return {
            "event": event_type,
            "entity": "VENDOR",
            "data": {
                "id": str(vendor.id),
                "name": vendor.name,
                "gstin": vendor.gstin
            }
        }
        
    return {"event": event_type, "entity": entity_type, "entity_id": entity_id}
