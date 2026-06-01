import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
import redis
import psutil

from . import models, database, dependencies, schemas
from .config.settings import settings
from .websocket_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Metrics Endpoints ---

@router.get("/metrics/api")
def get_api_metrics(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.SUPER_ADMIN]))
):
    """Get aggregated API performance metrics."""
    logs = db.query(models.ApiRequestLog).order_by(desc(models.ApiRequestLog.created_at)).limit(100).all()
    return logs

@router.get("/metrics/queue")
def get_queue_metrics(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.SUPER_ADMIN]))
):
    """Get recent queue task logs."""
    logs = db.query(models.QueueTaskLog).order_by(desc(models.QueueTaskLog.created_at)).limit(100).all()
    return logs

@router.get("/metrics/health-history", response_model=List[schemas.SystemHealthMetricResponse])
def get_health_metrics_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.SUPER_ADMIN]))
):
    """Retrieve historical system health records for dashboard graph rendering."""
    metrics = db.query(models.SystemHealthMetric).order_by(desc(models.SystemHealthMetric.created_at)).limit(50).all()
    # Reverse to chronological order for charts
    metrics.reverse()
    return metrics

@router.get("/alerts")
def get_system_alerts(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([
        models.Role.ADMIN,
        models.Role.SUPER_ADMIN,
        models.Role.PROCUREMENT_MANAGER,
        models.Role.FINANCE_MANAGER,
        models.Role.WAREHOUSE_MANAGER
    ]))
):
    """Get active system alerts."""
    alerts = db.query(models.SystemAlert).order_by(desc(models.SystemAlert.created_at)).limit(50).all()
    return alerts

# --- Instantaneous Health Check Checkers ---

@router.get("/health")
def get_overall_health(db: Session = Depends(database.get_db)):
    """General health check verifying DB, Redis, and local resources."""
    db_status = "UP"
    db_latency = 0.0
    import time
    
    # 1. DB Check
    try:
        t0 = time.perf_counter()
        db.execute(text("SELECT 1"))
        db_latency = (time.perf_counter() - t0) * 1000
    except Exception as e:
        db_status = "DOWN"
        logger.error(f"Instant DB healthcheck failed: {e}")

    # 2. Redis Check
    redis_status = "UP"
    try:
        r = redis.Redis.from_url(settings.redis.url, socket_timeout=1.0)
        r.ping()
    except Exception as e:
        redis_status = "DOWN"
        logger.error(f"Instant Redis healthcheck failed: {e}")

    # Standard status response
    healthy = (db_status == "UP") and (redis_status == "UP")
    status_code = status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if healthy else "unhealthy",
        "timestamp": time.time(),
        "services": {
            "database": {"status": db_status, "latency_ms": round(db_latency, 2)},
            "redis": {"status": redis_status}
        }
    }

@router.get("/health/db")
def get_db_health(db: Session = Depends(database.get_db)):
    """Verify DB connection status and latency."""
    import time
    try:
        t0 = time.perf_counter()
        db.execute(text("SELECT 1"))
        latency = (time.perf_counter() - t0) * 1000
        return {"status": "UP", "latency_ms": round(latency, 2)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection offline: {e}"
        )

@router.get("/health/redis")
def get_redis_health():
    """Verify Redis broker/cache layer connection."""
    try:
        r = redis.Redis.from_url(settings.redis.url, socket_timeout=1.0)
        r.ping()
        return {"status": "UP"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Redis connection offline: {e}"
        )

@router.get("/health/celery")
def get_celery_health():
    """Verify Celery task queue capacity."""
    try:
        r = redis.Redis.from_url(settings.redis.url, socket_timeout=1.0)
        queue_len = r.llen("celery")
        return {"status": "UP", "queue_depth": queue_len}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Celery queue backend unreachable: {e}"
        )

@router.get("/health/websocket")
def get_websocket_health():
    """Verify active real-time WebSocket pool."""
    active_count = sum(len(conn_list) for conn_list in manager.active_connections.values())
    return {
        "status": "UP",
        "active_connections": active_count
    }
