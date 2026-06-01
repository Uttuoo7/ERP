from celery import shared_task
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..services.document_engine import DocumentEngine
import logging

logger = logging.getLogger(__name__)

@shared_task
def async_generate_po_document(po_id: str, user_id: str = None):
    """
    Background worker task to generate the PO document after it gets approved.
    Prevents blocking the UI when compiling the PDF/HTML.
    """
    db: Session = SessionLocal()
    try:
        logger.info(f"Starting async document generation for PO: {po_id}")
        DocumentEngine.generate_purchase_order_document(db, po_id, generated_by_id=user_id)
        logger.info(f"Successfully generated document for PO: {po_id}")
    except Exception as e:
        logger.error(f"Failed to generate PO document: {e}")
        db.rollback()
    finally:
        db.close()

@shared_task
def scheduled_generate_executive_digest():
    """
    Cron-scheduled task to generate daily executive digest.
    """
    db: Session = SessionLocal()
    try:
        logger.info("Starting daily executive digest generation")
        DocumentEngine.generate_executive_digest(db)
        logger.info("Successfully generated executive digest")
    except Exception as e:
        logger.error(f"Failed to generate executive digest: {e}")
        db.rollback()
    finally:
        db.close()
