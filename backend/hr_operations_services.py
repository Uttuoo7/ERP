from sqlalchemy.orm import Session
from . import models, schemas
import uuid

def request_leave(db: Session, leave_data: schemas.LeaveRequestCreate) -> models.LeaveRequest:
    leave = models.LeaveRequest(
        **leave_data.model_dump()
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    
    # In full system, this triggers WorkflowEngine for LEAVE_APPROVAL
    return leave
