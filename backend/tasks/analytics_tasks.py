from backend.celery_app import celery_app
import logging
from ..database import SessionLocal
from .. import models, event_dispatcher
from ..services.analytics_engine import calculate_vendor_scorecard, aggregate_overall_kpis, forecast_spend_daily

logger = logging.getLogger(__name__)

@celery_app.task
def run_daily_analytics_aggregations():
    """
    Master cron job to compute daily intelligence metrics.
    Runs nightly.
    """
    logger.info("Starting Daily Procurement Intelligence Aggregations...")
    db = SessionLocal()
    try:
        # 1. Update Vendor Scorecards for active vendors
        vendors = db.query(models.Vendor).all()
        for vendor in vendors:
            calculate_vendor_scorecard(db, vendor.id)
            
        # 2. Compute Platform KPIs
        aggregate_overall_kpis(db)
        
        # 3. Daily Spend Forecasting
        forecast_spend_daily(db)
        
        # 4. Dispatch WebSocket event so active executive dashboards refresh
        event_dispatcher.dispatch("analytics_refreshed", {"status": "success"}, db)
        
        logger.info("Daily Procurement Intelligence Aggregations Completed.")
    except Exception as e:
        logger.error(f"Failed to run daily analytics: {e}")
        db.rollback()
    finally:
        db.close()

@celery_app.task
def generate_monthly_spend_report():
    """
    Legacy report generation.
    """
    logger.info("Generating monthly spend report...")
    pass
