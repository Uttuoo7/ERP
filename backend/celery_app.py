import os
from celery import Celery

# Set default Django or basic python path, here we just read the env
broker_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "p2p_erp",
    broker=broker_url,
    backend=broker_url,
    include=[
        "backend.tasks.tally_tasks",
        "backend.tasks.email_tasks",
        "backend.tasks.ocr_tasks",
        "backend.tasks.analytics_tasks"
    ]
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],  # Ignore other content to prevent Pickle RCE
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600, # 1 hour max
    worker_prefetch_multiplier=1, # Fair distribution
    task_acks_late=True, # Prevent data loss if worker crashes
    worker_cancel_long_running_tasks_on_connection_loss=True,
)

from celery.signals import task_prerun, task_postrun
import time
from backend.logging_config import logger, correlation_id

task_start_times = {}

@task_prerun.connect
def task_prerun_handler(task_id, task, *args, **kwargs):
    # If correlation_id was passed in headers, we could set it here
    # For now, we generate or use the task_id as correlation_id
    correlation_id.set(task_id)
    task_start_times[task_id] = time.perf_counter()
    logger.info(f"Task started", extra={"task_name": task.name, "worker_id": "celery"})

@task_postrun.connect
def task_postrun_handler(task_id, task, retval, state, *args, **kwargs):
    start_time = task_start_times.pop(task_id, time.perf_counter())
    duration_ms = (time.perf_counter() - start_time) * 1000
    
    if state == "FAILURE":
        logger.error(f"Task failed", extra={"task_name": task.name, "worker_id": "celery", "duration_ms": round(duration_ms, 2)})
    else:
        logger.info(f"Task completed", extra={"task_name": task.name, "worker_id": "celery", "duration_ms": round(duration_ms, 2), "status": state})

# Optional: Configure periodic tasks here later (Celery Beat)
