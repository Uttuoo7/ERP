import logging
from ..celery_app import celery_app
from ..database import SessionLocal
from . import alerting_engine

logger = logging.getLogger(__name__)

@celery_app.task
def system_health_monitor_task():
    """Background task to evaluate system health thresholds."""
    logger.info("Running System Health Monitor...")
    db = SessionLocal()
    try:
        alerting_engine.evaluate_system_health(db)
    except Exception as e:
        logger.error(f"Error in health monitor: {e}")
    finally:
        db.close()
