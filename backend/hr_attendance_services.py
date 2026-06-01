from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from datetime import datetime

def log_attendance(db: Session, att_data: schemas.AttendanceCreate) -> models.Attendance:
    att = models.Attendance(
        **att_data.model_dump()
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return att
