import logging
import psutil
import redis
from sqlalchemy import text
from ..celery_app import celery_app
from ..database import SessionLocal
from ..models import SystemHealthMetric
from ..websocket_manager import manager
from ..config.settings import settings

logger = logging.getLogger(__name__)

@celery_app.task(name="backend.tasks.observability_tasks.system_health_monitor_task")
def system_health_monitor_task():
    """Background task to collect system health metrics and persist to database."""
    logger.info("Running System Health Monitor Collection Task...")
    
    db = SessionLocal()
    try:
        # 1. Collect CPU & RAM Metrics
        cpu_usage = psutil.cpu_percent(interval=0.5)
        memory_usage = psutil.virtual_memory().percent

        # 2. Check Database Status & Latency
        db_status = "DOWN"
        try:
            db.execute(text("SELECT 1"))
            db_status = "UP"
        except Exception as e:
            logger.error(f"Database health check failed: {e}")

        # 3. Check Redis Status & Celery Queue Depth
        redis_status = "DOWN"
        celery_queue_depth = 0
        try:
            # Connect to Redis using configured settings
            r = redis.Redis.from_url(settings.redis.url, socket_timeout=2.0)
            if r.ping():
                redis_status = "UP"
                # Queue size
                celery_queue_depth = r.llen("celery")
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")

        # 4. Check Websocket Pool Count
        websocket_pool_count = sum(len(conn_list) for conn_list in manager.active_connections.values())

        # 5. Save Health Metric
        metric = SystemHealthMetric(
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            db_status=db_status,
            redis_status=redis_status,
            celery_queue_depth=celery_queue_depth,
            websocket_pool_count=websocket_pool_count
        )
        db.add(metric)
        db.commit()

        # Log results
        logger.info(
            "System health metrics persisted successfully.",
            extra={
                "cpu": cpu_usage,
                "ram": memory_usage,
                "db": db_status,
                "redis": redis_status,
                "celery_queue": celery_queue_depth,
                "websockets": websocket_pool_count
            }
        )

        # 6. Evaluate system alerts / thresholds
        evaluate_alert_thresholds(db, cpu_usage, memory_usage, db_status, redis_status)

    except Exception as e:
        logger.error(f"Failed to collect system health metrics: {e}")
    finally:
        db.close()

def evaluate_alert_thresholds(db, cpu, memory, db_status, redis_status):
    """Raise SystemAlert records if critical metrics cross standard thresholds."""
    from ..models import SystemAlert
    
    thresholds = [
        (cpu > 90.0, "CRITICAL", f"High CPU utilization detected: {cpu}%"),
        (memory > 90.0, "CRITICAL", f"High Memory utilization detected: {memory}%"),
        (db_status == "DOWN", "CRITICAL", "Database connection is DOWN!"),
        (redis_status == "DOWN", "WARNING", "Redis cache/broker connection is DOWN!")
    ]

    for condition, severity, message in thresholds:
        if condition:
            # Avoid creating duplicates of identical active alerts in the last 10 minutes
            logger.warning(f"SYSTEM ALERT RAISED: [{severity}] {message}")
            try:
                # Add alert record
                alert = SystemAlert(
                    alert_type="SYSTEM",
                    title=f"Observability Alert: {severity}",
                    message=message,
                    severity=severity,
                    is_resolved=False
                )
                db.add(alert)
                db.commit()
            except Exception as e:
                logger.error(f"Failed to raise system alert: {e}")
