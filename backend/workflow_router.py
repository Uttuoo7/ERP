import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import database, dependencies, models, schemas, workflow_engine

router = APIRouter()

# -- Workflow Builder Configurations --

@router.get("/definitions", response_model=List[schemas.WorkflowDefinitionResponse])
def get_definitions(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    # Only Admin can manage or view workflow configs
    if current_user.role != models.Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only administrators can manage workflow configurations.")
    return db.query(models.WorkflowDefinition).all()

@router.post("/definitions", response_model=schemas.WorkflowDefinitionResponse, status_code=status.HTTP_201_CREATED)
def create_definition(
    payload: schemas.WorkflowDefinitionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    if current_user.role != models.Role.ADMIN:
        raise HTTPException(status_code=403, detail="Only administrators can manage workflow configurations.")

    # Deactivate existing definition for this module to keep only one active definition at a time
    db.query(models.WorkflowDefinition)\
        .filter(models.WorkflowDefinition.module == payload.module)\
        .update({"is_active": False})

    db_def = models.WorkflowDefinition(
        module=payload.module,
        name=payload.name,
        is_active=payload.is_active
    )
    db.add(db_def)
    db.flush()

    for step_data in payload.steps:
        db_step = models.WorkflowStep(
            workflow_definition_id=db_def.id,
            step_number=step_data.step_number,
            name=step_data.name,
            role_required=step_data.role_required,
            condition_expression=step_data.condition_expression,
            escalation_timeout_hours=step_data.escalation_timeout_hours
        )
        db.add(db_step)

    db.commit()
    db.refresh(db_def)
    return db_def

# -- Approval Inbox Task Operations --

@router.get("/inbox", response_model=List[schemas.ApprovalTaskResponse])
def get_approval_inbox(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    # Retrieve all pending tasks matching the user's role (or if they are Admin, retrieve all pending items)
    query = db.query(models.ApprovalTask).filter(models.ApprovalTask.status == "PENDING")
    
    if current_user.role != models.Role.ADMIN:
        query = query.filter(models.ApprovalTask.assigned_role == current_user.role.value)
        
    return query.order_by(models.ApprovalTask.created_at.desc()).all()

@router.post("/tasks/{task_id}/action", response_model=schemas.ApprovalTaskResponse)
def action_workflow_task(
    task_id: uuid.UUID,
    payload: schemas.ApprovalTaskAction,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    task = db.query(models.ApprovalTask).filter(models.ApprovalTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Approval task not found")

    # Authorize: user must hold the required role or be an Admin
    if current_user.role.value != task.assigned_role and current_user.role != models.Role.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail=f"You do not possess the required approval role: {task.assigned_role}"
        )

    try:
        updated_task = workflow_engine.action_task(
            task_id=task_id,
            actioned_by_id=current_user.id,
            action=payload.action,
            comments=payload.comments,
            db=db
        )
        return updated_task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# -- Workflow Visual History & Auditing --

@router.get("/history/{entity_id}", response_model=List[schemas.WorkflowHistoryResponse])
def get_workflow_history(
    entity_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    instance = db.query(models.WorkflowInstance).filter(models.WorkflowInstance.entity_id == entity_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="No active approval instance found for this entity.")
    return instance.history
