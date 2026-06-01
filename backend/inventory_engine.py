import uuid
import logging
from decimal import Decimal
from datetime import datetime
from typing import List, Optional, Any
from sqlalchemy.orm import Session
from . import models, event_dispatcher

logger = logging.getLogger(__name__)

def record_receipt(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    qty: int,
    unit_cost: Decimal,
    batch_no: Optional[str] = None,
    expiry_date: Optional[datetime] = None,
    serial_nos: Optional[List[str]] = None,
    reference_type: str = "ADJUSTMENT",
    reference_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    remarks: Optional[str] = None
) -> models.StockLedgerEntry:
    """
    ACID Receipt Handler: Logs inventory arrivals, processes batch lot codes & serial lists,
    updates warehouse stock matrices, writes ledger audit logs and emits system events.
    """
    logger.info(f"Inventory Engine: Processing RECEIPT of {qty} units for SKU id {item_id} at WH id {warehouse_id}")
    
    # 1. Resolve or Create Batch Lot
    batch_id = None
    if batch_no and batch_no.strip():
        batch = db.query(models.InventoryBatch).filter(models.InventoryBatch.batch_number == batch_no.strip()).first()
        if not batch:
            batch = models.InventoryBatch(
                item_id=item_id,
                batch_number=batch_no.strip(),
                expiry_date=expiry_date
            )
            db.add(batch)
            db.flush()
        batch_id = batch.id

    # 2. Process Unique Serials
    if serial_nos:
        for sn in serial_nos:
            if not sn.strip():
                continue
            serial = db.query(models.InventorySerial).filter(models.InventorySerial.serial_number == sn.strip()).first()
            if not serial:
                serial = models.InventorySerial(
                    item_id=item_id,
                    batch_id=batch_id,
                    serial_number=sn.strip(),
                    status="AVAILABLE",
                    warehouse_id=warehouse_id
                )
                db.add(serial)
            else:
                serial.status = "AVAILABLE"
                serial.warehouse_id = warehouse_id
                serial.batch_id = batch_id
            db.flush()

    # 3. Update Warehouse Stock Balance
    stock_bal = db.query(models.WarehouseStock).filter(
        models.WarehouseStock.warehouse_id == warehouse_id,
        models.WarehouseStock.item_id == item_id,
        models.WarehouseStock.batch_id == batch_id
    ).first()

    if not stock_bal:
        stock_bal = models.WarehouseStock(
            warehouse_id=warehouse_id,
            item_id=item_id,
            batch_id=batch_id,
            quantity_on_hand=0,
            quantity_reserved=0,
            quantity_damaged=0,
            quantity_transit=0,
            valuation_unit_cost=unit_cost
        )
        db.add(stock_bal)
        db.flush()

    # Update balance counts & averages
    stock_bal.quantity_on_hand += qty
    stock_bal.valuation_unit_cost = unit_cost
    db.flush()

    # 4. Write Chronological Immutable Stock Ledger Entry
    ledger_entry = models.StockLedgerEntry(
        item_id=item_id,
        warehouse_id=warehouse_id,
        batch_id=batch_id,
        transaction_type="RECEIPT",
        quantity_change=qty,
        resulting_on_hand=stock_bal.quantity_on_hand,
        valuation_unit_cost=unit_cost,
        reference_type=reference_type,
        reference_id=reference_id,
        remarks=remarks or f"Stock receipt under {reference_type}",
        created_by_id=user_id
    )
    db.add(ledger_entry)

    # 5. Compatibility log: backend/models.py Legacy InventoryTransaction
    legacy_tx = models.InventoryTransaction(
        item_id=item_id,
        warehouse_id=warehouse_id,
        batch_id=batch_id,
        transaction_type="RECEIPT",
        quantity=qty,
        valuation_unit_cost=unit_cost,
        reference_id=reference_id,
        remarks=remarks,
        created_by_id=user_id
    )
    db.add(legacy_tx)

    # 6. Recalculate Legacy global InventoryLedger summary (sum of all on-hand stocks across WHs)
    total_on_hand = db.query(models.WarehouseStock).filter(models.WarehouseStock.item_id == item_id).sum(models.WarehouseStock.quantity_on_hand)
    total_reserved = db.query(models.WarehouseStock).filter(models.WarehouseStock.item_id == item_id).sum(models.WarehouseStock.quantity_reserved)
    
    global_ledger = db.query(models.InventoryLedger).filter(models.InventoryLedger.item_id == item_id).first()
    if not global_ledger:
        global_ledger = models.InventoryLedger(
            item_id=item_id,
            quantity_on_hand=qty,
            quantity_reserved=0
        )
        db.add(global_ledger)
    else:
        # Resolve via SQL queries sum or simple addition
        q_sum = db.query(models.WarehouseStock).filter(models.WarehouseStock.item_id == item_id).all()
        global_ledger.quantity_on_hand = sum(x.quantity_on_hand for x in q_sum)
        global_ledger.quantity_reserved = sum(x.quantity_reserved for x in q_sum)
        global_ledger.last_updated = datetime.utcnow()

    db.flush()

    # Emit Event
    event_dispatcher.dispatch(
        "stock_received",
        {
            "item_id": item_id,
            "warehouse_id": warehouse_id,
            "quantity": qty,
            "unit_cost": float(unit_cost),
            "batch_number": batch_no,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "user_id": user_id
        },
        db
    )

    return ledger_entry

def calculate_fifo_cost(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    qty_to_issue: int,
    fallback_cost: Decimal
) -> Decimal:
    """
    Computes unit valuation cost for stock issues using standard FIFO layers.
    Chronologically matches issued amounts against positive receipt layers.
    """
    if qty_to_issue <= 0:
        return Decimal("0.0")

    # 1. Fetch positive receipt layers
    receipt_layers = db.query(models.StockLedgerEntry).filter(
        models.StockLedgerEntry.item_id == item_id,
        models.StockLedgerEntry.warehouse_id == warehouse_id,
        models.StockLedgerEntry.quantity_change > 0
    ).order_by(models.StockLedgerEntry.created_at.asc()).all()

    if not receipt_layers:
        return fallback_cost

    # 2. Fetch total historically issued quantity (excluding this transaction)
    total_issued_query = db.query(models.StockLedgerEntry).filter(
        models.StockLedgerEntry.item_id == item_id,
        models.StockLedgerEntry.warehouse_id == warehouse_id,
        models.StockLedgerEntry.quantity_change < 0
    ).all()
    
    total_issued = abs(sum(entry.quantity_change for entry in total_issued_query))

    # 3. Consume layers chronologically
    remaining_to_issue = qty_to_issue
    total_cost = Decimal("0.0")
    
    for layer in receipt_layers:
        layer_qty = layer.quantity_change
        
        if total_issued >= layer_qty:
            # Layer is fully consumed by past issues
            total_issued -= layer_qty
            continue
        
        # Partially or fully unconsumed layer
        available_in_layer = layer_qty - total_issued
        total_issued = 0 # All historical issues accounted for
        
        consume_qty = min(remaining_to_issue, available_in_layer)
        total_cost += consume_qty * layer.valuation_unit_cost
        remaining_to_issue -= consume_qty
        
        if remaining_to_issue <= 0:
            break

    # If layers didn't fully satisfy, apply fallback for remaining quantity
    if remaining_to_issue > 0:
        total_cost += remaining_to_issue * fallback_cost

    return total_cost / Decimal(str(qty_to_issue))

def record_issue(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    qty: int,
    batch_id: Optional[uuid.UUID] = None,
    serial_ids: Optional[List[uuid.UUID]] = None,
    reference_type: str = "ADJUSTMENT",
    reference_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    remarks: Optional[str] = None
) -> models.StockLedgerEntry:
    """
    ACID Issue Handler: Validates and deducts stock, locks serial numbers to ISSUED,
    updates warehouse matrices, logs immutable stock ledger using FIFO valuation layers.
    """
    logger.info(f"Inventory Engine: Processing ISSUE of {qty} units for SKU id {item_id} from WH id {warehouse_id}")

    stock_bal = db.query(models.WarehouseStock).filter(
        models.WarehouseStock.warehouse_id == warehouse_id,
        models.WarehouseStock.item_id == item_id,
        models.WarehouseStock.batch_id == batch_id
    ).first()

    # Dynamic sync from legacy InventoryStock if WarehouseStock is missing/insufficient
    legacy_stock = db.query(models.InventoryStock).filter(
        models.InventoryStock.warehouse_id == warehouse_id,
        models.InventoryStock.item_id == item_id
    ).first()
    
    if legacy_stock and legacy_stock.current_stock >= qty:
        if not stock_bal:
            stock_bal = models.WarehouseStock(
                warehouse_id=warehouse_id,
                item_id=item_id,
                batch_id=batch_id,
                quantity_on_hand=legacy_stock.current_stock,
                quantity_reserved=getattr(legacy_stock, "reserved_stock", 0) or 0,
                quantity_damaged=0,
                quantity_transit=0,
                valuation_unit_cost=Decimal("0.0")
            )
            db.add(stock_bal)
            db.flush()
        elif stock_bal.quantity_on_hand < qty:
            stock_bal.quantity_on_hand = legacy_stock.current_stock
            db.flush()

    if (not stock_bal or stock_bal.quantity_on_hand < qty) and batch_id is None:
        # Fallback to any batch that has sufficient quantity
        stock_bal = db.query(models.WarehouseStock).filter(
            models.WarehouseStock.warehouse_id == warehouse_id,
            models.WarehouseStock.item_id == item_id,
            models.WarehouseStock.quantity_on_hand >= qty
        ).first()

    if not stock_bal or stock_bal.quantity_on_hand < qty:
        raise ValueError("Sufficient on-hand quantity not located for this stock balance.")

    # Calculate FIFO Costing unit cost
    fifo_unit_cost = calculate_fifo_cost(db, item_id, warehouse_id, qty, stock_bal.valuation_unit_cost)

    # Deduct stock
    stock_bal.quantity_on_hand -= qty
    db.flush()

    # Serials
    if serial_ids:
        for sid in serial_ids:
            serial = db.query(models.InventorySerial).filter(models.InventorySerial.id == sid).first()
            if serial:
                serial.status = "ISSUED"
                serial.warehouse_id = None
                db.flush()

    # Write Ledger
    ledger_entry = models.StockLedgerEntry(
        item_id=item_id,
        warehouse_id=warehouse_id,
        batch_id=batch_id,
        transaction_type="ISSUE",
        quantity_change=-qty,
        resulting_on_hand=stock_bal.quantity_on_hand,
        valuation_unit_cost=fifo_unit_cost,
        reference_type=reference_type,
        reference_id=reference_id,
        remarks=remarks or f"Stock issue under {reference_type}",
        created_by_id=user_id
    )
    db.add(ledger_entry)

    # Write Legacy StockLedger compatibility record
    legacy_ledger = models.StockLedger(
        item_id=item_id,
        warehouse_id=warehouse_id,
        transaction_type="ISSUE",
        reference_type=reference_type,
        reference_id=reference_id or uuid.uuid4(),
        qty_in=0,
        qty_out=qty,
        balance_after=stock_bal.quantity_on_hand,
        unit_rate=fifo_unit_cost,
        total_value=fifo_unit_cost * qty,
        remarks=remarks or f"Issue for {reference_type}"
    )
    db.add(legacy_ledger)

    # Legacy compatibility log
    legacy_tx = models.InventoryTransaction(
        item_id=item_id,
        warehouse_id=warehouse_id,
        batch_id=batch_id,
        transaction_type="ISSUE",
        quantity=-qty,
        valuation_unit_cost=fifo_unit_cost,
        reference_id=reference_id,
        remarks=remarks,
        created_by_id=user_id
    )
    db.add(legacy_tx)

    # Global summary updates
    global_ledger = db.query(models.InventoryLedger).filter(models.InventoryLedger.item_id == item_id).first()
    if global_ledger:
        q_sum = db.query(models.WarehouseStock).filter(models.WarehouseStock.item_id == item_id).all()
        global_ledger.quantity_on_hand = sum(x.quantity_on_hand for x in q_sum)
        global_ledger.quantity_reserved = sum(x.quantity_reserved for x in q_sum)
        global_ledger.last_updated = datetime.utcnow()

    db.flush()

    event_dispatcher.dispatch(
        "stock_issued",
        {
            "item_id": item_id,
            "warehouse_id": warehouse_id,
            "quantity": qty,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "user_id": user_id
        },
        db
    )

    return ledger_entry

def record_transfer(
    db: Session,
    item_id: uuid.UUID,
    src_wh_id: uuid.UUID,
    dest_wh_id: uuid.UUID,
    qty: int,
    batch_id: Optional[uuid.UUID] = None,
    serial_ids: Optional[List[uuid.UUID]] = None,
    reference_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    remarks: Optional[str] = None
) -> List[models.StockLedgerEntry]:
    """
    ACID Stock Transfer: Deducts from source warehouse, maps in-transit log,
    and updates destination warehouse balance. Updates serial tracking matrices.
    """
    logger.info(f"Inventory Engine: Processing TRANSFER of {qty} units from WH {src_wh_id} to WH {dest_wh_id}")

    # 1. Issue from Source WH
    src_ledger = record_issue(
        db=db,
        item_id=item_id,
        warehouse_id=src_wh_id,
        qty=qty,
        batch_id=batch_id,
        serial_ids=serial_ids,
        reference_type="STOCK_TRANSFER",
        reference_id=reference_id,
        user_id=user_id,
        remarks=remarks or f"Transfer out to warehouse {dest_wh_id}"
    )

    # 2. Get batch lot attributes if any to preserve lot trace
    batch_no = None
    expiry_date = None
    if batch_id:
        batch = db.query(models.InventoryBatch).filter(models.InventoryBatch.id == batch_id).first()
        if batch:
            batch_no = batch.batch_number
            expiry_date = batch.expiry_date

    # Get serial text parameters to re-commission them at destination
    serial_nos = []
    if serial_ids:
        for sid in serial_ids:
            serial = db.query(models.InventorySerial).filter(models.InventorySerial.id == sid).first()
            if serial:
                serial_nos.append(serial.serial_number)

    # 3. Receive at Destination WH
    dest_ledger = record_receipt(
        db=db,
        item_id=item_id,
        warehouse_id=dest_wh_id,
        qty=qty,
        unit_cost=src_ledger.valuation_unit_cost,
        batch_no=batch_no,
        expiry_date=expiry_date,
        serial_nos=serial_nos,
        reference_type="STOCK_TRANSFER",
        reference_id=reference_id,
        user_id=user_id,
        remarks=remarks or f"Transfer in from warehouse {src_wh_id}"
    )

    event_dispatcher.dispatch(
        "stock_transferred",
        {
            "item_id": item_id,
            "source_warehouse_id": src_wh_id,
            "destination_warehouse_id": dest_wh_id,
            "quantity": qty,
            "reference_id": reference_id,
            "user_id": user_id
        },
        db
    )

    return [src_ledger, dest_ledger]

def record_adjustment(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    qty_change: int,
    unit_cost: Decimal,
    batch_number: Optional[str] = None,
    expiry_date: Optional[datetime] = None,
    serial_numbers: Optional[List[str]] = None,
    reference_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    remarks: Optional[str] = None
) -> models.StockLedgerEntry:
    """
    ACID Reconciliation Adjustment: Performs count corrections (positive receipt or negative issue adjustment).
    """
    logger.info(f"Inventory Engine: Processing ADJUSTMENT of {qty_change} units at WH {warehouse_id}")

    if qty_change > 0:
        ledger = record_receipt(
            db=db,
            item_id=item_id,
            warehouse_id=warehouse_id,
            qty=qty_change,
            unit_cost=unit_cost,
            batch_no=batch_number,
            expiry_date=expiry_date,
            serial_nos=serial_numbers,
            reference_type="ADJUSTMENT",
            reference_id=reference_id,
            user_id=user_id,
            remarks=remarks
        )
    elif qty_change < 0:
        # Find the batch if name specified
        batch_id = None
        if batch_number and batch_number.strip():
            batch = db.query(models.InventoryBatch).filter(models.InventoryBatch.batch_number == batch_number.strip()).first()
            if batch:
                batch_id = batch.id

        # Get matching serial IDs if names specified
        serial_ids = []
        if serial_numbers:
            for sname in serial_numbers:
                serial = db.query(models.InventorySerial).filter(
                    models.InventorySerial.serial_number == sname.strip(),
                    models.InventorySerial.item_id == item_id
                ).first()
                if serial:
                    serial_ids.append(serial.id)

        ledger = record_issue(
            db=db,
            item_id=item_id,
            warehouse_id=warehouse_id,
            qty=abs(qty_change),
            batch_id=batch_id,
            serial_ids=serial_ids,
            reference_type="ADJUSTMENT",
            reference_id=reference_id,
            user_id=user_id,
            remarks=remarks
        )
    else:
        raise ValueError("Adjustment quantity change must be non-zero.")

    event_dispatcher.dispatch(
        "inventory_adjusted",
        {
            "item_id": item_id,
            "warehouse_id": warehouse_id,
            "quantity_change": qty_change,
            "unit_cost": float(unit_cost),
            "reference_id": reference_id,
            "user_id": user_id
        },
        db
    )

    return ledger

def deduct_stock(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    qty: float,
    reference_type: str = "ADJUSTMENT",
    reference_id: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    remarks: Optional[str] = None
) -> models.StockLedgerEntry:
    """
    Wrapper mapping deduct_stock to the ACID record_issue handler for acceptance test compatibility.
    """
    qty_int = int(qty)
    ref_uuid = None
    if reference_id:
        try:
            ref_uuid = uuid.UUID(str(reference_id))
        except ValueError:
            pass
            
    return record_issue(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        qty=qty_int,
        reference_type=reference_type,
        reference_id=ref_uuid,
        user_id=user_id,
        remarks=remarks
    )
