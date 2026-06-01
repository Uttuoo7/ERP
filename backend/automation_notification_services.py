from sqlalchemy.orm import Session
from . import models, schemas
import uuid
import json
import asyncio
from typing import List
from .websocket_manager import manager

async def create_notification(db: Session, data: schemas.NotificationCreate) -> models.Notification:
    notif = models.Notification(
        **data.model_dump()
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    
    # Broadcast to the user via WebSocket
    payload = {
        "type": "NEW_NOTIFICATION",
        "data": {
            "id": str(notif.id),
            "title": notif.title,
            "message": notif.message,
            "priority": notif.priority,
            "created_at": notif.created_at.isoformat()
        }
    }
    await manager.send_personal_message(json.dumps(payload), str(notif.assigned_to))
    
    return notif

def get_user_notifications(db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 50) -> List[models.Notification]:
    return db.query(models.Notification)\
             .filter(models.Notification.assigned_to == user_id)\
             .order_by(models.Notification.created_at.desc())\
             .offset(skip).limit(limit).all()

def mark_notification_read(db: Session, notif_id: uuid.UUID, user_id: uuid.UUID):
    notif = db.query(models.Notification).filter(models.Notification.id == notif_id, models.Notification.assigned_to == user_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return notif
