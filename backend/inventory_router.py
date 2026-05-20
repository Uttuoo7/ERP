import uuid
import logging
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import database, dependencies, models, schemas, inventory_engine

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
    query = db.query(models.WarehouseStock)
    
    if warehouse_id:
        query = query.filter(models.WarehouseStock.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(models.WarehouseStock.item_id == item_id)
    if search:
        query = query.join(models.Item).filter(
            (models.Item.sku.ilike(f"%{search}%")) | (models.Item.name.ilike(f"%{search}%"))
        )
        
    return query.order_by(models.WarehouseStock.quantity_on_hand.desc()).all()

@router.get("/ledger", response_model=List[schemas.StockLedgerEntryResponse])
def get_stock_ledger_history(
    warehouse_id: Optional[uuid.UUID] = None,
    item_id: Optional[uuid.UUID] = None,
    transaction_type: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.StockLedgerEntry)
    
    if warehouse_id:
        query = query.filter(models.StockLedgerEntry.warehouse_id == warehouse_id)
    if item_id:
        query = query.filter(models.StockLedgerEntry.item_id == item_id)
    if transaction_type:
        query = query.filter(models.StockLedgerEntry.transaction_type == transaction_type)
        
    return query.order_by(models.StockLedgerEntry.created_at.desc()).all()

@router.get("/batches", response_model=List[schemas.InventoryBatchResponse])
def get_inventory_batches(
    item_id: Optional[uuid.UUID] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.InventoryBatch)
    if item_id:
        query = query.filter(models.InventoryBatch.item_id == item_id)
    return query.order_by(models.InventoryBatch.created_at.desc()).all()

@router.get("/serials", response_model=List[schemas.InventorySerialResponse])
def get_inventory_serials(
    item_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.InventorySerial)
    if item_id:
        query = query.filter(models.InventorySerial.item_id == item_id)
    if status_filter:
        query = query.filter(models.InventorySerial.status == status_filter)
    return query.all()

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
        ledger = inventory_engine.record_adjustment(
            db=db,
            item_id=payload.item_id,
            warehouse_id=payload.warehouse_id,
            qty_change=payload.qty_change,
            unit_cost=payload.valuation_unit_cost,
            batch_number=payload.batch_number,
            expiry_date=payload.expiry_date,
            serial_numbers=payload.serial_numbers,
            reference_id=uuid.uuid4(),
            user_id=current_user.id,
            remarks=payload.remarks
        )
        db.commit()
        db.refresh(ledger)
        return ledger
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error(f"Manual Stock Adjustment failure: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error executing inventory reconciliation.")
