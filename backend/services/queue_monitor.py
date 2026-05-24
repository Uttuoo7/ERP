import logging
import time
from celery.signals import task_prerun, task_postrun, task_failure
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import QueueTaskLog

logger = logging.getLogger(__name__)

task_start_times = {}

@task_prerun.connect
def on_task_prerun(task_id, task, *args, **kwargs):
    task_start_times[task_id] = time.time()

@task_postrun.connect
def on_task_postrun(task_id, task, retval, state, *args, **kwargs):
    start_time = task_start_times.pop(task_id, time.time())
    execution_time_ms = (time.time() - start_time) * 1000
    
    # Exclude the observability tasks themselves to avoid recursive bloat
    if "observability" in task.name or "queue_monitor" in task.name:
        return

    db = SessionLocal()
    try:
        log = QueueTaskLog(
            task_id=str(task_id),
            task_name=task.name,
            status=state,
            execution_time_ms=execution_time_ms
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log task {task_id} postrun: {e}")
    finally:
        db.close()

@task_failure.connect
def on_task_failure(task_id, exception, args, kwargs, traceback, einfo, *args_, **kwargs_):
    start_time = task_start_times.pop(task_id, time.time())
    execution_time_ms = (time.time() - start_time) * 1000
    
    db = SessionLocal()
    try:
        # Check if log exists (postrun might run, but usually failure runs independently)
        existing = db.query(QueueTaskLog).filter(QueueTaskLog.task_id == str(task_id)).first()
        if existing:
            existing.status = "FAILURE"
            existing.error_traceback = str(traceback)
        else:
            log = QueueTaskLog(
                task_id=str(task_id),
                task_name="unknown (failed)",
                status="FAILURE",
                execution_time_ms=execution_time_ms,
                error_traceback=str(traceback)
            )
            db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log task {task_id} failure: {e}")
    finally:
        db.close()
