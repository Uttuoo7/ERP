from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import models, schemas, database, dependencies

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory Ledger & Balances"],
    responses={404: {"description": "Not found"}},
)

@router.get("/stock", response_model=List[schemas.InventoryStockResponse])
def get_inventory_stock(
    warehouse_id: uuid.UUID = None,
    item_id: uuid.UUID = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Get current inventory levels across warehouses."""
    query = db.query(models.InventoryStock)
    if warehouse_id:
        query = query.filter(models.InventoryStock.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(models.InventoryStock.item_id == item_id)
        
    return query.offset(skip).limit(limit).all()

@router.get("/ledger", response_model=List[schemas.StockLedgerResponse])
def get_stock_ledger(
    warehouse_id: uuid.UUID = None,
    item_id: uuid.UUID = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Get stock ledger movement history."""
    query = db.query(models.StockLedger)
    if warehouse_id:
        query = query.filter(models.StockLedger.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(models.StockLedger.item_id == item_id)
        
    return query.order_by(models.StockLedger.created_at.desc()).offset(skip).limit(limit).all()
