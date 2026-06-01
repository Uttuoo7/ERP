from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from . import models, schemas, database, dependencies, mfg_qc_services

router = APIRouter(
    prefix="/mfg/qc",
    tags=["Manufacturing QC"],
    responses={404: {"description": "Not found"}},
)

@router.post("/inspections")
def create_inspection(
    qc: schemas.QualityInspectionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    qc_record = mfg_qc_services.create_qc_inspection(db, qc, current_user.id)
    return {"id": qc_record.id, "inspection_number": qc_record.inspection_number, "status": qc_record.inspection_status}
