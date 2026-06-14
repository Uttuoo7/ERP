from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List

def create_employee(db: Session, employee_data: schemas.HREmployeeCreate) -> models.Employee:
    data = employee_data.model_dump()
    
    # Map employee_code to employee_id if employee_id isn't present
    if "employee_code" in data and "employee_id" not in data:
        data["employee_id"] = data.pop("employee_code")
        
    # Filter out fields that are not columns of models.Employee
    valid_cols = {c.name for c in models.Employee.__table__.columns}
    filtered_data = {k: v for k, v in data.items() if k in valid_cols}
    
    emp = models.Employee(
        **filtered_data
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp

def get_employees(db: Session, skip: int = 0, limit: int = 100) -> List[models.Employee]:
    return db.query(models.Employee).offset(skip).limit(limit).all()
