import uuid
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from backend import models, schemas, inventory_engine
from backend.core.exceptions import EntityNotFoundException, StockInsufficiencyError

logger = logging.getLogger(__name__)

class InventoryService:
    """
    Decoupled Service Layer for Inventory processing, stock balances, and ledger adjustments.
    Enforces multi-tenant query safety and integrates with the acid inventory transaction engine.
    """

    @staticmethod
    def get_warehouse_stock_balances(
        db: Session,
        warehouse_id: Optional[uuid.UUID] = None,
        item_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None
    ) -> List[models.WarehouseStock]:
        """Fetch current stock levels across warehouses based on query parameters."""
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

    @staticmethod
    def get_stock_ledger_history(
        db: Session,
        warehouse_id: Optional[uuid.UUID] = None,
        item_id: Optional[uuid.UUID] = None,
        transaction_type: Optional[str] = None
    ) -> List[models.StockLedgerEntry]:
        """Fetch full chronological audits of inventory movements."""
        query = db.query(models.StockLedgerEntry)
        
        if warehouse_id:
            query = query.filter(models.StockLedgerEntry.warehouse_id == warehouse_id)
        if item_id:
            query = query.filter(models.StockLedgerEntry.item_id == item_id)
        if transaction_type:
            query = query.filter(models.StockLedgerEntry.transaction_type == transaction_type)
            
        return query.order_by(models.StockLedgerEntry.created_at.desc()).all()

    @staticmethod
    def get_inventory_batches(db: Session, item_id: Optional[uuid.UUID] = None) -> List[models.InventoryBatch]:
        """Fetch tracking lots/batches assigned to raw components or items."""
        query = db.query(models.InventoryBatch)
        if item_id:
            query = query.filter(models.InventoryBatch.item_id == item_id)
        return query.order_by(models.InventoryBatch.created_at.desc()).all()

    @staticmethod
    def get_inventory_serials(
        db: Session,
        item_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None
    ) -> List[models.InventorySerial]:
        """Fetch serial numbers tracked across warehouses."""
        query = db.query(models.InventorySerial)
        if item_id:
            query = query.filter(models.InventorySerial.item_id == item_id)
        if status_filter:
            query = query.filter(models.InventorySerial.status == status_filter)
        return query.all()

    @staticmethod
    def record_manual_adjustment(
        db: Session,
        payload: schemas.StockAdjustmentCreate,
        user_id: uuid.UUID
    ) -> models.StockLedgerEntry:
        """
        Executes an administrative stock level override.
        Delegates transactional balance logs to the ACID inventory engine.
        """
        try:
            # Check item exists
            item = db.query(models.Item).filter(models.Item.id == payload.item_id).first()
            if not item:
                raise EntityNotFoundException(f"Item with ID {payload.item_id} not found.")

            # Check warehouse exists
            warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == payload.warehouse_id).first()
            if not warehouse:
                raise EntityNotFoundException(f"Warehouse with ID {payload.warehouse_id} not found.")

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
                user_id=user_id,
                remarks=payload.remarks
            )
            db.commit()
            db.refresh(ledger)
            return ledger
        except ValueError as e:
            db.rollback()
            raise StockInsufficiencyError(str(e))
        except Exception as e:
            db.rollback()
            logger.error(f"Manual Stock Adjustment failure: {str(e)}")
            raise e
