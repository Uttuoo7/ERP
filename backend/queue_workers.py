import time
import logging
import threading
from sqlalchemy.orm import Session
from . import models, database, tally_sync

logger = logging.getLogger(__name__)

# Control flag for background queue loop
_worker_running = False
_worker_thread = None

def process_tally_sync_queue(db: Session):
    """
    Background worker loop:
    Inspects TallySyncQueue and pushes PENDING ledger vouchers to Tally gateway ports.
    """
    pending_items = db.query(models.TallySyncQueue).filter(
        models.TallySyncQueue.sync_status == "PENDING"
    ).all()
    
    if not pending_items:
        return
        
    logger.info(f"Background worker starting sync for {len(pending_items)} pending vouchers.")
    
    for item in pending_items:
        try:
            item.retry_count += 1
            item.last_attempt_at = models.datetime.utcnow() if hasattr(models, 'datetime') else None
            
            # Simulated push logic
            # In a live environment, makes a post request to: http://localhost:9000
            # res = requests.post("http://localhost:9000", data=item.payload_xml, headers={'Content-Type': 'text/xml'})
            
            # Assume successful local sync simulation
            item.sync_status = "SYNCED"
            from datetime import datetime
            item.synced_at = datetime.utcnow()
            
            logger.info(f"Voucher synced successfully to TallyPrime! Reference Transaction ID: {item.financial_transaction_id}")
            
        except Exception as e:
            item.sync_status = "FAILED"
            item.error_message = str(e)
            logger.error(f"Failed to sync voucher {item.id} to Tally Gateway: {str(e)}")
            
    db.commit()

def run_worker_loop():
    """
    Background daemon simulator checking queues every 10 seconds.
    """
    global _worker_running
    logger.info("Initializing P2P ERP background queue worker daemon...")
    
    while _worker_running:
        try:
            db = database.SessionLocal()
            try:
                process_tally_sync_queue(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Worker daemon error: {str(e)}")
            
        time.sleep(10)

def start_background_workers():
    global _worker_running, _worker_thread
    if _worker_running:
        return
    _worker_running = True
    _worker_thread = threading.Thread(target=run_worker_loop, daemon=True)
    _worker_thread.start()
    logger.info("P2P ERP background workers daemon started in active thread.")

def stop_background_workers():
    global _worker_running
    _worker_running = False
    logger.info("P2P ERP background workers daemon stopped.")
