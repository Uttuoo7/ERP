import re
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from . import models

logger = logging.getLogger(__name__)

def evaluate_condition(expression: Optional[str], context: Dict[str, Any]) -> bool:
    """
    Safely evaluates simple comparative expressions against context parameters.
    Supports expressions like 'amount > 50000', 'department == "Finance"', 'is_urgent == True'
    """
    if not expression or not expression.strip():
        return True

    try:
        # Match standard structure: field_name operator value
        match = re.match(r"^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(>=|<=|>|<|==|!=)\s*(.+)\s*$", expression)
        if not match:
            logger.warning(f"Failed to parse condition expression: '{expression}'")
            return False

        field, operator, raw_val = match.groups()
        if field not in context:
            logger.warning(f"Condition field '{field}' not found in provided context.")
            return False

        context_val = context[field]
        raw_val = raw_val.strip()

        # Handle type conversion based on target context type
        if isinstance(context_val, (int, float)):
            target_val = float(raw_val)
            context_val = float(context_val)
        elif isinstance(context_val, bool):
            target_val = raw_val.lower() in ("true", "1", "yes")
        else:
            # Strip outer quotes for strings
            target_val = raw_val.strip("'\"")

        # Evaluate comparison safely
        if operator == ">":
            return context_val > target_val
        elif operator == ">=":
            return context_val >= target_val
        elif operator == "<":
            return context_val < target_val
        elif operator == "<=":
            return context_val <= target_val
        elif operator == "==":
            return context_val == target_val
        elif operator == "!=":
            return context_val != target_val

    except Exception as e:
        logger.error(f"Error evaluating workflow expression '{expression}': {str(e)}")
        return False

    return False

def initialize_workflow(
    module: str,
    entity_id: uuid.UUID,
    context: Dict[str, Any],
    db: Session
) -> Optional[models.WorkflowInstance]:
    """
    Spins up a new workflow instance for an entity and dispatches the first pending approval task.
    """
    # 1. Load active definition for the target module
    definition = db.query(models.WorkflowDefinition)\
        .filter(models.WorkflowDefinition.module == module, models.WorkflowDefinition.is_active == True)\
        .first()

    if not definition:
        logger.info(f"No active workflow definition configured for module {module}. Auto-approving.")
        # Auto-approve target entity directly
        finalize_entity_approval(module, entity_id, db)
        return None

    # Sort steps by step number
    steps = sorted(definition.steps, key=lambda s: s.step_number)
    if not steps:
        logger.info(f"Workflow definition for {module} has no steps configured. Auto-approving.")
        finalize_entity_approval(module, entity_id, db)
        return None

    # 2. Instantiate workflow tracking
    instance = models.WorkflowInstance(
        workflow_definition_id=definition.id,
        entity_id=entity_id,
        status="PENDING_APPROVAL",
        current_step_number=1
    )
    db.add(instance)
    db.flush() # Resolve instance.id

    # 3. Log initial submission event
    history = models.WorkflowHistory(
        workflow_instance_id=instance.id,
        transition_from="DRAFT",
        transition_to="SUBMITTED",
        comments="Workflow initiated automatically."
    )
    db.add(history)

    # 4. Evaluate steps in sequence until one matches conditions
    matched_step = None
    for step in steps:
        if evaluate_condition(step.condition_expression, context):
            matched_step = step
            break

    if not matched_step:
        logger.info(f"No workflow steps matched context for entity {entity_id} in {module}. Auto-approving.")
        instance.status = "APPROVED"
        finalize_entity_approval(module, entity_id, db)
        db.commit()
        return instance

    # 5. Lock instance to matched step and create pending approval task
    instance.current_step_number = matched_step.step_number
    task = models.ApprovalTask(
        workflow_instance_id=instance.id,
        step_id=matched_step.id,
        assigned_role=matched_step.role_required,
        status="PENDING"
    )
    db.add(task)
    db.commit()

    logger.info(f"Initialized workflow for {module} (Entity: {entity_id}) at Step {matched_step.step_number} (Role: {matched_step.role_required})")
    
    # Dynamic Notification Trigger Hook
    trigger_notification_alert(task)
    
    return instance

def action_task(
    task_id: uuid.UUID,
    actioned_by_id: uuid.UUID,
    action: str, # APPROVED or REJECTED
    comments: Optional[str],
    db: Session
) -> models.ApprovalTask:
    """
    Submits a user action (Approve/Reject) on a pending task, transitioning workflows dynamically.
    """
    task = db.query(models.ApprovalTask).filter(models.ApprovalTask.id == task_id).first()
    if not task or task.status != "PENDING":
        raise ValueError("Task is not active or has already been resolved.")

    instance = task.instance
    definition = instance.definition
    steps = sorted(definition.steps, key=lambda s: s.step_number)

    # 1. Update task details
    task.status = action
    task.comments = comments
    task.actioned_at = datetime.utcnow()
    task.actioned_by_id = actioned_by_id

    # 2. Record historical audit
    history = models.WorkflowHistory(
        workflow_instance_id=instance.id,
        transition_from=f"STEP_{task.step.step_number}_PENDING",
        transition_to=f"STEP_{task.step.step_number}_{action}",
        actioned_by_id=actioned_by_id,
        comments=comments
    )
    db.add(history)

    if action == "REJECTED":
        # Reject complete workflow instantly
        instance.status = "REJECTED"
        finalize_entity_rejection(definition.module, instance.entity_id, db)
        db.commit()
        logger.info(f"Workflow instance {instance.id} rejected by user {actioned_by_id} on Step {task.step.step_number}")
        return task

    # 3. If APPROVED, evaluate if a next step is required
    next_step = None
    # Context evaluation values could be loaded from target entity state if we need dynamic nested rules.
    # For now, evaluate steps higher than the current step number.
    for step in steps:
        if step.step_number > task.step.step_number:
            # Simplify check: we can inherit context from database columns or evaluate all steps
            # Since this is a generic system, we fall through steps.
            next_step = step
            break

    if not next_step:
        # No more approval levels. Entire workflow is complete and fully APPROVED!
        instance.status = "APPROVED"
        finalize_entity_approval(definition.module, instance.entity_id, db)
        
        history_approved = models.WorkflowHistory(
            workflow_instance_id=instance.id,
            transition_from=f"STEP_{task.step.step_number}_APPROVED",
            transition_to="FULLY_APPROVED",
            actioned_by_id=actioned_by_id,
            comments="Entire workflow completed and approved."
        )
        db.add(history_approved)
        db.commit()
        logger.info(f"Workflow instance {instance.id} for module {definition.module} fully approved!")
        return task

    # 4. Progress workflow to next approval level
    instance.current_step_number = next_step.step_number
    next_task = models.ApprovalTask(
        workflow_instance_id=instance.id,
        step_id=next_step.id,
        assigned_role=next_step.role_required,
        status="PENDING"
    )
    db.add(next_task)
    db.commit()

    logger.info(f"Workflow instance {instance.id} advanced to Step {next_step.step_number} (Role: {next_step.role_required})")
    trigger_notification_alert(next_task)

    return task

# -- Target Callback Operations --

def finalize_entity_approval(module: str, entity_id: uuid.UUID, db: Session):
    """
    Generic callback that updates the status of the target ERP entity (e.g. PO, SO, PR) to APPROVED.
    """
    if module == "PURCHASE_ORDER":
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == entity_id).first()
        if po:
            po.status = models.POStatus.ISSUED # Auto-progress PO to ISSUED
            logger.info(f"Purchase Order {entity_id} status updated to ISSUED via workflow engine callback.")
    elif module == "INTERNAL_SALES_ORDER":
        so = db.query(models.InternalSalesOrder).filter(models.InternalSalesOrder.id == entity_id).first()
        if so:
            so.status = "APPROVED"
            logger.info(f"Internal Sales Order {entity_id} status updated to APPROVED.")
    elif module == "PURCHASE_REQUISITION":
        pr = db.query(models.PurchaseRequisition).filter(models.PurchaseRequisition.id == entity_id).first()
        if pr:
            pr.status = "APPROVED"
            logger.info(f"Purchase Requisition {entity_id} status updated to APPROVED.")

def finalize_entity_rejection(module: str, entity_id: uuid.UUID, db: Session):
    if module == "PURCHASE_ORDER":
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == entity_id).first()
        if po:
            po.status = models.POStatus.CLOSED # Mark as closed or rejected
    elif module == "INTERNAL_SALES_ORDER":
        so = db.query(models.InternalSalesOrder).filter(models.InternalSalesOrder.id == entity_id).first()
        if so:
            so.status = "REJECTED"
    elif module == "PURCHASE_REQUISITION":
        pr = db.query(models.PurchaseRequisition).filter(models.PurchaseRequisition.id == entity_id).first()
        if pr:
            pr.status = "REJECTED"

# -- Extensible Notification Hub Hook --

def trigger_notification_alert(task: models.ApprovalTask):
    """
    Extensible hook for future email, WhatsApp, and in-app socket push alerts.
    """
    logger.info(f"[Notification Alert]: New pending approval task instantiated: ID {task.id}. Assigned role: '{task.assigned_role}'")
