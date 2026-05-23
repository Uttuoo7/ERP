from backend.celery_app import celery_app
import logging
import time

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def process_invoice_ocr(self, attachment_id: str):
    """
    Processes an uploaded invoice PDF/Image using an OCR engine.
    Extracts line items, totals, and vendor details.
    """
    logger.info(f"Starting OCR processing for attachment ID: {attachment_id}")
    try:
        # Simulated heavy OCR processing
        time.sleep(5)
        logger.info(f"OCR processing completed for {attachment_id}")
    except Exception as e:
        logger.error(f"OCR processing failed for {attachment_id}: {e}")
        raise self.retry(exc=e, countdown=10)
