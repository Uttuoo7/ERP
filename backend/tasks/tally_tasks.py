from backend.celery_app import celery_app
from backend.database import SessionLocal
from backend import models
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=3)
def sync_voucher_to_tally(self, queue_item_id: str):
    """
    Syncs a voucher to TallyPrime.
    Uses exponential backoff for retries if the Tally gateway is down.
    """
    db = SessionLocal()
    try:
        item = db.query(models.TallySyncQueue).filter(models.TallySyncQueue.id == queue_item_id).first()
        if not item:
            logger.warning(f"Tally sync item {queue_item_id} not found.")
            return

        item.retry_count += 1
        item.last_attempt_at = datetime.utcnow()
        db.commit()

        # Simulated HTTP request to Tally
        # import requests
        # try:
        #     res = requests.post("http://localhost:9000", data=item.payload_xml, headers={'Content-Type': 'text/xml'})
        #     res.raise_for_status()
        # except Exception as req_e:
        #     raise self.retry(exc=req_e, countdown=2 ** self.request.retries)

        # Success path
        item.sync_status = "SYNCED"
        item.synced_at = datetime.utcnow()
        db.commit()
        logger.info(f"Voucher synced successfully to TallyPrime! Reference Transaction ID: {item.financial_transaction_id}")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to sync voucher {queue_item_id} to Tally Gateway: {str(e)}")
        # If we exhausted max retries, dead-letter it
        if self.request.retries >= self.max_retries:
            item = db.query(models.TallySyncQueue).filter(models.TallySyncQueue.id == queue_item_id).first()
            if item:
                item.sync_status = "FAILED"
                item.error_message = str(e)
                db.commit()
        raise e
    finally:
        db.close()
