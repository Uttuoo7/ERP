import logging
from typing import Dict, Any, List, Callable
from sqlalchemy.orm import Session
from . import models

logger = logging.getLogger(__name__)

# Reusable observers list
_listeners: Dict[str, List[Callable[[Any, Session], None]]] = {}

def subscribe(event_name: str, callback: Callable[[Any, Session], None]):
    if event_name not in _listeners:
        _listeners[event_name] = []
    _listeners[event_name].append(callback)

def dispatch(event_name: str, payload: Any, db: Session):
    """
    Triggers all listeners subscribed to a specific event (e.g. pr_submitted).
    """
    logger.info(f"[Event Dispatcher]: Event '{event_name}' dispatched with payload: {payload}")
    
    if event_name in _listeners:
        for callback in _listeners[event_name]:
            try:
                callback(payload, db)
            except Exception as e:
                logger.error(f"Error executing listener for event '{event_name}': {str(e)}")

# -- Standard Observers / Handlers --

def _log_audit_trail(payload: Dict[str, Any], db: Session):
    """
    Creates an audit entry for purchase requisitions dynamically.
    """
    pr_id = payload.get("pr_id")
    user_id = payload.get("user_id")
    action = payload.get("action")
    details = payload.get("details")

    if pr_id and user_id and action:
        audit = models.PurchaseRequisitionAudit(
            pr_id=pr_id,
            user_id=user_id,
            action=action,
            details=details
        )
        db.add(audit)
        db.commit()
        logger.info(f"[Audit observer]: Created audit record for PR {pr_id} (Action: {action})")

# Automatically subscribe observers to central events
subscribe("pr_created", _log_audit_trail)
subscribe("pr_submitted", _log_audit_trail)
subscribe("pr_updated", _log_audit_trail)
subscribe("pr_approved", _log_audit_trail)
subscribe("pr_rejected", _log_audit_trail)
subscribe("pr_converted", _log_audit_trail)
