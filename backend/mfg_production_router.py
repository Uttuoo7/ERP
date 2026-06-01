from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies, mfg_production_services

router = APIRouter(
    prefix="/mfg/production",
    tags=["Manufacturing Production"],
    responses={404: {"description": "Not found"}},
)

@router.post("/orders")
def create_production_order(
    po: schemas.ProductionOrderCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    po_record = mfg_production_services.create_production_order(db, po)
    return {"id": po_record.id, "production_order_number": po_record.production_order_number, "status": po_record.production_status}

@router.put("/orders/{po_id}/start")
def start_production(
    po_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        po_record = mfg_production_services.start_production(db, po_id, warehouse_id, current_user.id)
        return {"id": po_record.id, "status": po_record.production_status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/orders/{po_id}/complete")
def complete_production(
    po_id: uuid.UUID,
    completed_qty: float,
    warehouse_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        po_record = mfg_production_services.complete_production(db, po_id, completed_qty, warehouse_id, current_user.id)
        return {"id": po_record.id, "status": po_record.production_status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
