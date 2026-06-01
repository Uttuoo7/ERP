from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies, dispatch_services

router = APIRouter(
    prefix="/dispatch",
    tags=["Dispatch & Fulfillment"],
    responses={404: {"description": "Not found"}},
)

@router.post("/delivery-challans")
def create_dc(
    dc: schemas.DeliveryChallanCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        dc_record = dispatch_services.create_delivery_challan(db, dc, current_user.id)
        return {"id": dc_record.id, "dc_number": dc_record.dc_number, "status": dc_record.dispatch_status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
