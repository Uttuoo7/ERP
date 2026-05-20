import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import models, schemas, database, dependencies, event_dispatcher

router = APIRouter()
logger = logging.getLogger(__name__)

def create_notification(
    db: Session,
    user_id: uuid.UUID,
    title: str,
    message: str,
    notif_type: str = "INFO",
    priority: str = "MEDIUM"
) -> models.Notification:
    """
    Creates and records a centralized in-app notification.
    """
    notification = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        priority=priority
    )
    db.add(notification)
    db.commit()
    logger.info(f"Recorded in-app notification for user {user_id}: {title}")
    return notification

# Hook Notification builders onto the event dispatcher
def handle_invoice_created_notif(event_data: dict, db: Session):
    # Notify all users with FINANCE or ADMIN role
    finance_users = db.query(models.User).filter(
        models.User.role.in_([models.Role.FINANCE, models.Role.FINANCE_MANAGER, models.Role.ADMIN])
    ).all()
    for user in finance_users:
        create_notification(
            db,
            user.id,
            title="New Invoice Registered",
            message=f"Vendor Invoice {event_data.get('invoice_number')} has been registered. Submitting for 3-way match checking.",
            notif_type="INFO",
            priority="MEDIUM"
        )

def handle_mismatch_detected_notif(event_data: dict, db: Session):
    # Notify buyers and finance managers
    review_users = db.query(models.User).filter(
        models.User.role.in_([models.Role.PROCUREMENT_MANAGER, models.Role.FINANCE_MANAGER, models.Role.ADMIN])
    ).all()
    for user in review_users:
        create_notification(
            db,
            user.id,
            title="AP 3-Way Match Mismatch Alert!",
            message=f"A discrepancy has been flagged for Invoice {event_data.get('invoice_number')}. Action required inside review queue.",
            notif_type="CRITICAL",
            priority="HIGH"
        )

# Register listeners with central event dispatcher
event_dispatcher.subscribe("invoice_created", handle_invoice_created_notif)
event_dispatcher.subscribe("mismatch_detected", handle_mismatch_detected_notif)

# --- REST APIS for Notification Hub ---

@router.get("/", response_model=List[schemas.NotificationResponse])
def get_user_notifications(
    unread_only: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.Notification).filter(models.Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(models.Notification.is_read == False)
    return query.order_by(models.Notification.created_at.desc()).all()

@router.get("/unread-count", response_model=dict)
def get_unread_notification_count(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).count()
    return {"count": count}

@router.post("/read-all", status_code=status.HTTP_200_OK)
def mark_all_notifications_as_read(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All in-app alerts marked as read."}

@router.post("/{id}/read", response_model=schemas.NotificationResponse)
def mark_notification_as_read(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    notification = db.query(models.Notification).filter(
        models.Notification.id == id,
        models.Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification alert not found.")
        
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification
