from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List

def create_employee(db: Session, employee_data: schemas.EmployeeCreate) -> models.Employee:
    emp = models.Employee(
        **employee_data.model_dump()
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp

def get_employees(db: Session, skip: int = 0, limit: int = 100) -> List[models.Employee]:
    return db.query(models.Employee).offset(skip).limit(limit).all()
