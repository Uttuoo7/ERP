from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from .database import get_db
from .dependencies import get_current_user
from .models import ActivityEvent

router = APIRouter(prefix="/activity", tags=["Activity"])

@router.get("/")
def get_global_activity_feed(
    limit: int = Query(50, ge=1, le=100),
    department_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = db.query(ActivityEvent)
    
    if department_id:
        query = query.filter((ActivityEvent.department_id == department_id) | (ActivityEvent.department_id == None))
        
    events = query.order_by(ActivityEvent.created_at.desc()).limit(limit).all()
    
    result = []
    for event in events:
        metadata = None
        if event.metadata_json:
            try:
                metadata = json.loads(event.metadata_json)
            except:
                pass
                
        result.append({
            "id": event.id,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "action": event.action,
            "severity": event.severity,
            "actor_id": event.actor_id,
            "description": event.description,
            "metadata": metadata,
            "created_at": event.created_at.isoformat()
        })
        
    return result
