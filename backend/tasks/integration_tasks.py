from backend.celery_app import celery_app
import logging
from datetime import datetime
import json
import time
from ..database import SessionLocal
from .. import models, event_dispatcher

logger = logging.getLogger(__name__)

@celery_app.task
def process_pending_syncs():
    """
    Cron worker that wakes up and processes any PENDING or failed (retriable) SyncEventLogs.
    """
    logger.info("Integration Engine: Waking up to process pending syncs...")
    db = SessionLocal()
    try:
        # Find all pending logs
        pending_logs = db.query(models.SyncEventLog).filter(
            models.SyncEventLog.status == "PENDING"
        ).all()
        
        for log in pending_logs:
            _execute_sync(db, log)
            
    except Exception as e:
        logger.error(f"Error in process_pending_syncs: {e}")
    finally:
        db.close()

def _execute_sync(db, log: models.SyncEventLog):
    """
    Mock execution of HTTP request to external accounting system.
    """
    try:
        config = log.integration
        
        # Simulate network latency
        time.sleep(1.5)
        
        # Mock logic based on provider
        if config.provider_name == "TALLY":
            if log.retry_count >= 3:
                log.status = "DEAD_LETTER"
                log.error_message = "Max retries exceeded for Tally sync."
            else:
                logger.info(f"Syncing {log.entity_type} {log.entity_id} to Tally...")
                log.status = "SUCCESS"
                log.response_body = json.dumps({"status": "Created", "voucher_id": "VCH-100293"})
                
                ext_ref = models.ExternalReference(
                    integration_id=config.id,
                    internal_entity_type=log.entity_type,
                    internal_entity_id=log.entity_id,
                    external_entity_id="VCH-100293",
                    sync_status="SYNCED"
                )
                db.add(ext_ref)
            
        elif config.provider_name == "WEBHOOK":
            if log.retry_count >= 3:
                log.status = "DEAD_LETTER"
                log.error_message = "Max retries exceeded for Webhook sync."
            else:
                logger.info(f"Posting Webhook payload to {config.endpoint_url}")
                log.status = "SUCCESS"
                log.response_body = json.dumps({"status": "HTTP 200 OK"})
            
        else:
            log.status = "FAILED"
            log.error_message = "Unsupported provider."
            
    except Exception as e:
        log.status = "FAILED"
        log.error_message = str(e)
        log.retry_count += 1
        
    log.last_attempt_at = datetime.utcnow()
    db.commit()
    
    # Notify Frontend if we are on a dashboard
    event_dispatcher.dispatch("integration_status_changed", {"log_id": str(log.id), "status": log.status}, db)
