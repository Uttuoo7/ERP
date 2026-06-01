from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies
from . import automation_notification_services, automation_task_services, automation_workflow_services

router = APIRouter(
    prefix="/automation",
    tags=["Workflow Automation & Tasks"],
    responses={404: {"description": "Not found"}},
)

# Notifications
@router.post("/notifications", response_model=schemas.NotificationResponse)
async def create_notification(
    data: schemas.NotificationCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return await automation_notification_services.create_notification(db, data)

@router.get("/notifications", response_model=List[schemas.NotificationResponse])
def get_notifications(
    skip: int = 0, limit: int = 50,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return automation_notification_services.get_user_notifications(db, current_user.id, skip, limit)

@router.put("/notifications/{notif_id}/read")
def mark_read(
    notif_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    automation_notification_services.mark_notification_read(db, notif_id, current_user.id)
    return {"status": "success"}

# Tasks
@router.post("/tasks", response_model=schemas.TaskResponse)
def create_task(
    data: schemas.TaskCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return automation_task_services.create_task(db, data, current_user.id)

@router.get("/tasks", response_model=List[schemas.TaskResponse])
def get_tasks(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return automation_task_services.get_tasks(db, current_user.id, skip, limit)

@router.put("/tasks/{task_id}/status")
def update_task_status(
    task_id: uuid.UUID,
    status: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return automation_task_services.update_task_status(db, task_id, status)

# Workflow Rules
@router.post("/rules", response_model=schemas.WorkflowRuleResponse)
def create_rule(
    data: schemas.WorkflowRuleCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return automation_workflow_services.create_workflow_rule(db, data)

@router.get("/rules", response_model=List[schemas.WorkflowRuleResponse])
def get_rules(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return automation_workflow_services.get_workflow_rules(db, skip, limit)
