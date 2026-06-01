from sqlalchemy.orm import Session
from . import models, schemas
import uuid
import json
from typing import List

def create_workflow_rule(db: Session, rule_data: schemas.WorkflowRuleCreate) -> models.WorkflowRule:
    rule = models.WorkflowRule(
        **rule_data.model_dump()
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

def get_workflow_rules(db: Session, skip: int = 0, limit: int = 100) -> List[models.WorkflowRule]:
    return db.query(models.WorkflowRule).order_by(models.WorkflowRule.created_at.desc()).offset(skip).limit(limit).all()

def evaluate_rules_for_event(db: Session, trigger_event: str, context: dict):
    """
    Called by other modules when an event happens, e.g., ON_STOCK_CHANGE.
    Evaluates active rules and triggers actions.
    """
    rules = db.query(models.WorkflowRule).filter(
        models.WorkflowRule.trigger_event == trigger_event,
        models.WorkflowRule.is_active == True
    ).all()
    
    for rule in rules:
        try:
            conditions = json.loads(rule.condition_json)
            # Dummy evaluation: in a real system this would parse a DSL or logic tree against the `context`
            passed = True 
            
            if passed:
                actions = json.loads(rule.action_json)
                _execute_action(db, actions, context)
        except Exception as e:
            # Log error
            print(f"Error evaluating rule {rule.id}: {e}")

def _execute_action(db: Session, actions: dict, context: dict):
    """
    Executes the action defined in the JSON.
    E.g. {"type": "CREATE_TASK", "payload": {...}}
    """
    action_type = actions.get("type")
    
    if action_type == "CREATE_NOTIFICATION":
        # Create notification logic
        pass
    elif action_type == "CREATE_TASK":
        # Create task logic
        pass
    # Further actions...
