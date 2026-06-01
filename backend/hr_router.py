from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies
from . import hr_employee_services, hr_attendance_services, hr_operations_services

router = APIRouter(
    prefix="/hr",
    tags=["Human Resources & Employees"],
    responses={404: {"description": "Not found"}},
)

@router.post("/employees", response_model=schemas.EmployeeResponse)
def create_employee(
    data: schemas.EmployeeCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return hr_employee_services.create_employee(db, data)

@router.get("/employees", response_model=List[schemas.EmployeeResponse])
def get_employees(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return hr_employee_services.get_employees(db, skip, limit)

@router.post("/attendance", response_model=schemas.AttendanceBase) # Using Base for quick prototyping
def log_attendance(
    data: schemas.AttendanceCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return hr_attendance_services.log_attendance(db, data)

@router.post("/leaves", response_model=schemas.LeaveRequestResponse)
def request_leave(
    data: schemas.LeaveRequestCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return hr_operations_services.request_leave(db, data)
