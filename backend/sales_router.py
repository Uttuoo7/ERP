from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies, sales_services

router = APIRouter(
    prefix="/sales",
    tags=["Sales Quotes & Orders"],
    responses={404: {"description": "Not found"}},
)

@router.post("/quotations")
def create_quotation(
    qt: schemas.SalesQuotationCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    # Enqueue to workflow here if applicable
    q = sales_services.create_sales_quotation(db, qt, current_user.id)
    return {"id": q.id, "quotation_number": q.quotation_number, "status": "DRAFT"}

@router.post("/orders")
def create_sales_order(
    so: schemas.SalesOrderCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        so_record = sales_services.create_sales_order(db, so, current_user.id)
        # Assuming workflow handles approval -> finalize_so_approval
        return {"id": so_record.id, "sales_order_number": so_record.sales_order_number, "status": "PENDING_APPROVAL"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
