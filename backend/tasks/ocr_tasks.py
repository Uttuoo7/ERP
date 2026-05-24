from backend.celery_app import celery_app
import logging
import time
import json
from ..database import SessionLocal
from .. import models, event_dispatcher
from ..services.intelligence_engine import generate_mock_extraction, calculate_confidence_score, detect_anomalies
from ..workflow_engine import initialize_workflow

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def process_invoice_ocr(self, queue_id: str):
    """
    Intelligent OCR Processing Pipeline
    """
    logger.info(f"Starting Intelligent OCR pipeline for queue_id: {queue_id}")
    db = SessionLocal()
    
    try:
        # 1. Fetch Queue Item
        queue_item = db.query(models.OCRProcessingQueue).filter(models.OCRProcessingQueue.id == queue_id).first()
        if not queue_item:
            logger.error("OCR Queue item not found.")
            return

        # Update Status to EXTRACTING
        queue_item.status = "EXTRACTING"
        db.commit()
        
        # Dispatch WS Event for frontend progress bar
        event_dispatcher.dispatch("ocr_progress", {"queue_id": str(queue_id), "status": "EXTRACTING"}, db)

        # 2. Simulate OCR & AI Parsing
        # In production: extract text using Tesseract/AWS Textract, then pass to LLM
        time.sleep(3) # Simulate heavy GPU work
        raw_text = f"Mock invoice content for {queue_item.file_name}. Total: $500. PO-9981"
        queue_item.raw_text = raw_text
        
        extracted_data = generate_mock_extraction(raw_text)
        queue_item.extracted_data_json = json.dumps(extracted_data)
        
        # 3. PO Matching
        queue_item.status = "MATCHING"
        db.commit()
        event_dispatcher.dispatch("ocr_progress", {"queue_id": str(queue_id), "status": "MATCHING"}, db)
        
        po_number = extracted_data.get("po_number")
        # For simulation, we assume PO is found or we just mock a matched PO
        # matched_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.po_number == po_number).first()
        # if not matched_po: ...
        
        # 4. Intelligence Scoring & Anomaly Detection
        # Mocking vendor ID for testing
        vendor_id = str(queue_item.uploaded_by_id) # Just using a UUID
        anomalies = detect_anomalies(db, extracted_data, vendor_id)
        
        # Mock PO for confidence calculation
        mock_po = models.PurchaseOrder()
        confidence, recommendation = calculate_confidence_score(extracted_data, mock_po)
        
        # 5. Entity Generation
        invoice = models.Invoice(
            vendor_id=vendor_id, # Mock
            po_id=vendor_id, # Mock
            invoice_number=extracted_data["invoice_number"],
            total_amount=extracted_data["total_amount"],
            confidence_score=confidence,
            anomaly_flags=json.dumps(anomalies),
            ai_recommendation=recommendation
        )
        db.add(invoice)
        db.flush() # get ID
        
        queue_item.invoice_id = invoice.id
        queue_item.status = "COMPLETE"
        db.commit()
        
        # 6. Workflow Triggering
        if recommendation == "AUTO_APPROVE" and not anomalies:
            initialize_workflow("INVOICE", invoice.id, {"amount": invoice.total_amount, "confidence": confidence}, db)
            
        event_dispatcher.dispatch("ocr_progress", {
            "queue_id": str(queue_id), 
            "status": "COMPLETE",
            "invoice_id": str(invoice.id),
            "confidence": float(confidence),
            "recommendation": recommendation
        }, db)

        logger.info(f"OCR pipeline completed successfully for {queue_id}")

    except Exception as e:
        logger.error(f"OCR pipeline failed: {e}")
        db.rollback()
        if 'queue_item' in locals() and queue_item:
            queue_item.status = "FAILED"
            queue_item.error_log = str(e)
            db.commit()
            event_dispatcher.dispatch("ocr_progress", {"queue_id": str(queue_id), "status": "FAILED"}, db)
        raise self.retry(exc=e, countdown=10)
    finally:
        db.close()
