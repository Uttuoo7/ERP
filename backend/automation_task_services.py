from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List

def create_task(db: Session, task_data: schemas.TaskCreate, assigned_by: uuid.UUID) -> models.Task:
    task = models.Task(
        task_number=f"TSK-{uuid.uuid4().hex[:8].upper()}",
        assigned_by=assigned_by,
        **task_data.model_dump()
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # In a real app, this might also trigger a websocket event or email via Celery
    
    return task

def get_tasks(db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[models.Task]:
    # Could filter by assigned_to == user_id or return all if admin
    return db.query(models.Task).order_by(models.Task.created_at.desc()).offset(skip).limit(limit).all()

def update_task_status(db: Session, task_id: uuid.UUID, status: str) -> models.Task:
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task: raise ValueError("Task not found")
    task.task_status = status
    db.commit()
    db.refresh(task)
    return task
