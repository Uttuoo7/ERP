import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import database, dependencies, models, schemas
from .services import InventoryService
from backend.core.exceptions import ErpException

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/balances", response_model=List[schemas.WarehouseStockResponse])
def get_warehouse_stock_balances(
    warehouse_id: Optional[uuid.UUID] = None,
    item_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return InventoryService.get_warehouse_stock_balances(db, warehouse_id, item_id, search)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.get("/ledger", response_model=List[schemas.StockLedgerEntryResponse])
def get_stock_ledger_history(
    warehouse_id: Optional[uuid.UUID] = None,
    item_id: Optional[uuid.UUID] = None,
    transaction_type: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return InventoryService.get_stock_ledger_history(db, warehouse_id, item_id, transaction_type)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.get("/batches", response_model=List[schemas.InventoryBatchResponse])
def get_inventory_batches(
    item_id: Optional[uuid.UUID] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return InventoryService.get_inventory_batches(db, item_id)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.get("/serials", response_model=List[schemas.InventorySerialResponse])
def get_inventory_serials(
    item_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return InventoryService.get_inventory_serials(db, item_id, status_filter)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.post("/adjust", response_model=schemas.StockLedgerEntryResponse, status_code=status.HTTP_201_CREATED)
def manual_stock_adjustment(
    payload: schemas.StockAdjustmentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.WAREHOUSE]))
):
    """
    Executes an administrative count/valuation correction variance.
    Splits into positive receipts or negative issue allocations automatically.
    """
    try:
        return InventoryService.record_manual_adjustment(db, payload, current_user.id)
    except ErpException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Manual Stock Adjustment failure: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error executing inventory reconciliation.")
