from backend.celery_app import celery_app
import logging
import time

logger = logging.getLogger(__name__)

@celery_app.task
def generate_monthly_spend_report():
    """
    Aggregates purchasing data and generates a PDF/Excel report.
    Typically run on a schedule using Celery Beat.
    """
    logger.info("Generating monthly spend report...")
    try:
        # Simulated heavy query and PDF generation
        time.sleep(3)
        logger.info("Monthly spend report generated successfully.")
    except Exception as e:
        logger.error(f"Failed to generate spend report: {e}")
