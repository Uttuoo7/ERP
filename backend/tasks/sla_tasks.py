import logging
from ..celery_app import celery_app
from ..database import SessionLocal
from ..services import sla_engine

logger = logging.getLogger(__name__)

@celery_app.task
def evaluate_slas_task():
    """Background task to evaluate SLAs and trigger escalations."""
    logger.info("Running scheduled SLA evaluation...")
    db = SessionLocal()
    try:
        sla_engine.evaluate_active_timers(db)
    except Exception as e:
        logger.error(f"Error evaluating SLAs: {e}")
    finally:
        db.close()
