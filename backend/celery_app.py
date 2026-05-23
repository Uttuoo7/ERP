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
    accept_content=['json'],  # Ignore other content
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600, # 1 hour max
    worker_prefetch_multiplier=1, # Fair distribution
)

# Optional: Configure periodic tasks here later (Celery Beat)
