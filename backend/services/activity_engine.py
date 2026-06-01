import json
import logging
from sqlalchemy.orm import Session
from ..models import ActivityEvent
from ..websocket_manager import manager

logger = logging.getLogger(__name__)

class ActivityEngine:
    """
    Centralized service to record operational activities to DB 
    and instantly broadcast them over WebSockets.
    """
    @staticmethod
    async def log_and_broadcast(
        db: Session,
        entity_type: str,
        action: str,
        description: str,
        severity: str = "INFO",
        entity_id: str = None,
        actor_id: str = None,
        department_id: str = None,
        metadata: dict = None
    ):
        try:
            # 1. Persist to Database
            event = ActivityEvent(
                entity_type=entity_type,
                entity_id=entity_id,
                action=action,
                severity=severity,
                actor_id=actor_id,
                description=description,
                metadata_json=json.dumps(metadata) if metadata else None,
                department_id=department_id
            )
            db.add(event)
            db.commit()
            db.refresh(event)

            # 2. Build Broadcast Payload
            payload = {
                "type": "ACTIVITY",
                "data": {
                    "id": event.id,
                    "entity_type": event.entity_type,
                    "entity_id": event.entity_id,
                    "action": event.action,
                    "severity": event.severity,
                    "actor_id": event.actor_id,
                    "description": event.description,
                    "metadata": metadata,
                    "created_at": event.created_at.isoformat()
                }
            }

            # 3. Publish to Redis Pub/Sub via WebSocket Manager
            # For now, we broadcast to all connected clients.
            # Role-based filtering can be added here (e.g. publish to "department:<dept_id>")
            await manager.publish_notification("broadcast", payload)
            
            return event
        except Exception as e:
            logger.error(f"Failed to log/broadcast activity: {e}")
            db.rollback()
            return None
