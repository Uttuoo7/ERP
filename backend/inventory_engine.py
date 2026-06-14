import uuid
import logging
from decimal import Decimal
from datetime import datetime
from typing import List, Optional, Any
from sqlalchemy.orm import Session
from . import models, event_dispatcher

logger = logging.getLogger(__name__)

from .database import get_current_tenant_id

def get_inventory_costing_method(db: Session, tenant_id: Optional[uuid.UUID] = None) -> str:
    """Helper to query the current costing method from TenantConfig."""
    if not tenant_id:
        tenant_id = get_current_tenant_id()
    query = db.query(models.TenantConfig)
    if tenant_id:
        query = query.filter(models.TenantConfig.tenant_uuid == tenant_id)
    config = query.first()
    if config and hasattr(config, "inventory_costing_method"):
        return config.inventory_costing_method or "FIFO"
    return "FIFO"

def get_allow_negative_inventory(db: Session, tenant_id: Optional[uuid.UUID] = None) -> bool:
    """Helper to query the negative inventory setting from TenantConfig."""
    if not tenant_id:
        tenant_id = get_current_tenant_id()
    query = db.query(models.TenantConfig)
    if tenant_id:
        query = query.filter(models.TenantConfig.tenant_uuid == tenant_id)
    config = query.first()
    if config and hasattr(config, "allow_negative_inventory"):
        return config.allow_negative_inventory or False
    return False

def create_audit_log(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: Optional[uuid.UUID],
    action_type: str,
    before_qty: Decimal,
    after_qty: Decimal,
    before_val: Decimal,
    after_val: Decimal,
    reference_type: str,
    reference_id: Optional[uuid.UUID],
    performed_by: Optional[uuid.UUID],
    tenant_id: Optional[uuid.UUID] = None
):
    """Writes a record to the inventory audit log."""
    if not tenant_id:
        tenant_id = get_current_tenant_id()
    log_entry = models.InventoryAuditLog(
        item_id=item_id,
        warehouse_id=warehouse_id,
        action_type=action_type,
        before_quantity=before_qty,
        after_quantity=after_qty,
        before_value=before_val,
        after_value=after_val,
        reference_type=reference_type,
        reference_id=reference_id,
        performed_by=performed_by,
        created_at=datetime.utcnow(),
        tenant_id=tenant_id
    )
    db.add(log_entry)
    db.flush()

def log_inventory_movement(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: Optional[uuid.UUID],
    transaction_type: str,
    qty: int,
    unit_cost: Decimal,
    batch_id: Optional[uuid.UUID] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    remarks: Optional[str] = None,
    tenant_id: Optional[uuid.UUID] = None
) -> models.InventoryTransactionLine:
    """
    Unified central helper to write canonical InventoryTransaction and InventoryTransactionLine movement logs.
    """
    logger.info(f"Inventory Movement Ledger: Logging {qty} units of SKU {item_id} at WH {warehouse_id} (Type: {transaction_type})")

    if not tenant_id:
        tenant_id = get_current_tenant_id()

    tx = None
    if reference_id:
        tx = db.query(models.InventoryTransaction).filter(
            models.InventoryTransaction.reference_id == reference_id
        ).first()

    if not tx:
        tx_number = f"TX-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        tx = models.InventoryTransaction(
            transaction_number=tx_number,
            transaction_type=transaction_type,
            reference_type=reference_type,
            reference_id=reference_id,
            remarks=remarks,
            created_by_id=user_id,
            tenant_id=tenant_id,
            # Legacy compatibility columns
            item_id=item_id,
            warehouse_id=warehouse_id,
            batch_id=batch_id,
            quantity=qty,
            valuation_unit_cost=unit_cost
        )
        db.add(tx)
        db.flush()

    line = models.InventoryTransactionLine(
        transaction_id=tx.id,
        item_id=item_id,
        warehouse_id=warehouse_id,
        batch_id=batch_id,
        quantity=qty,
        valuation_unit_cost=unit_cost,
        remarks=remarks,
        tenant_id=tenant_id
    )
    db.add(line)
    db.flush()
    return line

def get_current_totals(db: Session, item_id: uuid.UUID, tenant_id: Optional[uuid.UUID] = None) -> tuple:
    """Calculates total quantity and total value from all remaining cost layers for an item."""
    if not tenant_id:
        tenant_id = get_current_tenant_id()
    query = db.query(models.InventoryCostLayer).filter(
        models.InventoryCostLayer.item_id == item_id,
        models.InventoryCostLayer.remaining_quantity != 0,
        models.InventoryCostLayer.is_deleted == False
    )
    if tenant_id:
        query = query.filter(models.InventoryCostLayer.tenant_id == tenant_id)
    layers = query.all()
    qty = sum(l.remaining_quantity for l in layers)
    val = sum(l.remaining_quantity * l.unit_cost for l in layers)
    return Decimal(str(qty)), Decimal(str(val))

def create_cost_layer(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: Optional[uuid.UUID],
    qty: Decimal,
    unit_cost: Decimal,
    reference_type: str,
    reference_id: Optional[uuid.UUID],
    user_id: Optional[uuid.UUID],
    tenant_id: Optional[uuid.UUID] = None
) -> models.InventoryCostLayer:
    """
    Creates an inventory cost layer for received stock, generates a valuation entry,
    and logs the action in the audit log.
    """
    if not tenant_id:
        tenant_id = get_current_tenant_id()

    # 1. Fetch current totals before receipt
    before_qty, before_val = get_current_totals(db, item_id, tenant_id)

    # 2. Resolve source PO if referenced to a GRN
    source_grn_id = None
    source_po_id = None
    if reference_type == "GOODS_RECEIPT_NOTE" and reference_id:
        grn = db.query(models.GoodsReceiptNote).filter(models.GoodsReceiptNote.id == reference_id).first()
        if grn:
            source_grn_id = reference_id
            source_po_id = grn.po_id

    # 3. Create Cost Layer
    costing_method = get_inventory_costing_method(db, tenant_id)
    resolved_unit_cost = unit_cost
    
    if costing_method == "STANDARD":
        item = db.query(models.Item).filter_by(id=item_id).first()
        if item and item.standard_rate is not None:
            resolved_unit_cost = Decimal(str(item.standard_rate))

    cost_layer = models.InventoryCostLayer(
        item_id=item_id,
        warehouse_id=warehouse_id,
        original_quantity=qty,
        remaining_quantity=qty,
        unit_cost=resolved_unit_cost,
        total_cost=qty * resolved_unit_cost,
        source_grn_id=source_grn_id,
        source_po_id=source_po_id,
        layer_status="OPEN",
        created_at=datetime.utcnow(),
        tenant_id=tenant_id
    )
    db.add(cost_layer)
    db.flush()

    # 4. Record Valuation Entry
    after_qty = before_qty + qty
    after_val = before_val + (qty * resolved_unit_cost)
    
    if costing_method == "WAC":
        # Recalculate WAC
        new_wac = after_val / after_qty if after_qty > 0 else resolved_unit_cost
        
        # Update cost_layer and all existing open cost layers for this item to the new WAC
        cost_layer.unit_cost = new_wac
        cost_layer.total_cost = cost_layer.remaining_quantity * new_wac
        
        open_layers = db.query(models.InventoryCostLayer).filter(
            models.InventoryCostLayer.item_id == item_id,
            models.InventoryCostLayer.remaining_quantity != 0,
            models.InventoryCostLayer.is_deleted == False
        ).all()
        for l in open_layers:
            l.unit_cost = new_wac
            l.total_cost = l.remaining_quantity * new_wac
            
        # Update WarehouseStock valuation cost
        wh_stocks = db.query(models.WarehouseStock).filter(
            models.WarehouseStock.item_id == item_id,
            models.WarehouseStock.is_deleted == False
        ).all()
        for ws in wh_stocks:
            ws.valuation_unit_cost = new_wac
            
        resolved_unit_cost = new_wac
        after_val = after_qty * new_wac

    val_entry = models.InventoryValuationEntry(
        item_id=item_id,
        warehouse_id=warehouse_id,
        transaction_type="RECEIPT",
        running_inventory_qty=after_qty,
        running_inventory_value=after_val,
        quantity=qty,
        unit_cost=unit_cost,  # Keep actual receipt cost in the transaction record
        total_value=qty * unit_cost,
        costing_method_used=costing_method,
        reference_type=reference_type,
        reference_id=reference_id,
        created_at=datetime.utcnow(),
        tenant_id=tenant_id
    )
    db.add(val_entry)
    db.flush()

    # 5. Write Audit Log
    create_audit_log(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        action_type="RECEIPT",
        before_qty=before_qty,
        after_qty=after_qty,
        before_val=before_val,
        after_val=after_val,
        reference_type=reference_type,
        reference_id=reference_id,
        performed_by=user_id,
        tenant_id=tenant_id
    )

    return cost_layer

def consume_cost_layers(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: Optional[uuid.UUID],
    qty_to_issue: Decimal,
    fallback_cost: Decimal,
    reference_type: str,
    reference_id: Optional[uuid.UUID],
    user_id: Optional[uuid.UUID],
    tenant_id: Optional[uuid.UUID] = None,
    consumed_layers_out: Optional[list] = None
) -> Decimal:
    """
    Consumes inventory cost layers chronologically (FIFO), registers valuation entries,
    and logs the action in the audit log. Supports negative inventory protection.
    Returns the average unit cost of the issue transaction.
    """
    if not tenant_id:
        tenant_id = get_current_tenant_id()

    # 1. Fetch current totals before issue
    before_qty, before_val = get_current_totals(db, item_id, tenant_id)

    # 2. Check Negative Inventory Controls
    allow_negative = get_allow_negative_inventory(db, tenant_id)
    if not allow_negative and qty_to_issue > before_qty:
        raise ValueError("Insufficient inventory available.")

    # 3. Get costing method
    costing_method = get_inventory_costing_method(db, tenant_id)

    # 4. Consume layers chronologically
    remaining_to_issue = qty_to_issue
    total_issue_value = Decimal("0.0")

    # Fetch unconsumed positive layers
    query = db.query(models.InventoryCostLayer).filter(
        models.InventoryCostLayer.item_id == item_id,
        models.InventoryCostLayer.remaining_quantity > 0,
        models.InventoryCostLayer.is_deleted == False
    )
    if tenant_id:
        query = query.filter(models.InventoryCostLayer.tenant_id == tenant_id)
    
    # We sort by created_at asc for FIFO
    layers = query.order_by(models.InventoryCostLayer.created_at.asc()).all()

    for layer in layers:
        if remaining_to_issue <= 0:
            break
        
        consume_qty = min(remaining_to_issue, layer.remaining_quantity)
        layer.remaining_quantity -= consume_qty
        
        # Update layer status and consumed details
        if layer.remaining_quantity == 0:
            layer.layer_status = "CONSUMED"
            layer.consumed_at = datetime.utcnow()
        else:
            layer.layer_status = "PARTIALLY_CONSUMED"
        layer.last_issue_reference = f"{reference_type}:{reference_id}"
        
        if consumed_layers_out is not None:
            consumed_layers_out.append({
                "layer_id": str(layer.id),
                "unit_cost": layer.unit_cost,
                "quantity": consume_qty,
                "batch_id": None
            })

        total_issue_value += consume_qty * layer.unit_cost
        remaining_to_issue -= consume_qty

    # 5. Handle remaining quantity for negative inventory
    if remaining_to_issue > 0:
        if allow_negative:
            # Create a temporary negative cost layer
            neg_layer = models.InventoryCostLayer(
                item_id=item_id,
                warehouse_id=warehouse_id,
                original_quantity=-remaining_to_issue,
                remaining_quantity=-remaining_to_issue,
                unit_cost=fallback_cost,
                total_cost=-remaining_to_issue * fallback_cost,
                layer_status="OPEN",
                created_at=datetime.utcnow(),
                tenant_id=tenant_id
            )
            db.add(neg_layer)
            total_issue_value += remaining_to_issue * fallback_cost
            remaining_to_issue = Decimal("0.0")
        else:
            total_issue_value += remaining_to_issue * fallback_cost
            remaining_to_issue = Decimal("0.0")

    db.flush()

    actual_issue_unit_cost = total_issue_value / qty_to_issue if qty_to_issue > 0 else Decimal("0.0")

    # 6. Record Valuation Entry
    after_qty = before_qty - qty_to_issue
    after_val = before_val - total_issue_value

    val_entry = models.InventoryValuationEntry(
        item_id=item_id,
        warehouse_id=warehouse_id,
        transaction_type="CONSUMPTION",
        quantity=-qty_to_issue,
        unit_cost=actual_issue_unit_cost,
        total_value=-total_issue_value,
        running_inventory_qty=after_qty,
        running_inventory_value=after_val,
        costing_method_used=costing_method,
        reference_type=reference_type,
        reference_id=reference_id,
        created_at=datetime.utcnow(),
        tenant_id=tenant_id
    )
    db.add(val_entry)
    db.flush()

    # 7. Write Audit Log
    create_audit_log(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        action_type="ISSUE",
        before_qty=before_qty,
        after_qty=after_qty,
        before_val=before_val,
        after_val=after_val,
        reference_type=reference_type,
        reference_id=reference_id,
        performed_by=user_id,
        tenant_id=tenant_id
    )

    return actual_issue_unit_cost

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

    # 5. Canonical Movement Ledger: InventoryTransaction & Line
    log_inventory_movement(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        transaction_type="RECEIPT",
        qty=qty,
        unit_cost=unit_cost,
        batch_id=batch_id,
        reference_type=reference_type,
        reference_id=reference_id,
        user_id=user_id,
        remarks=remarks,
        tenant_id=getattr(ledger_entry, "tenant_id", None)
    )

    # 6. Recalculate Legacy global InventoryLedger summary (sum of all on-hand stocks across WHs)
    q_sum = db.query(models.WarehouseStock).filter(models.WarehouseStock.item_id == item_id).all()
    total_on_hand = sum(x.quantity_on_hand for x in q_sum)
    total_reserved = sum(x.quantity_reserved for x in q_sum)
    
    global_ledger = db.query(models.InventoryLedger).filter(models.InventoryLedger.item_id == item_id).first()
    if not global_ledger:
        global_ledger = models.InventoryLedger(
            item_id=item_id,
            quantity_on_hand=total_on_hand,
            quantity_reserved=total_reserved
        )
        db.add(global_ledger)
    else:
        global_ledger.quantity_on_hand = total_on_hand
        global_ledger.quantity_reserved = total_reserved
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

    create_cost_layer(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        qty=Decimal(str(qty)),
        unit_cost=Decimal(str(unit_cost)),
        reference_type=reference_type,
        reference_id=reference_id,
        user_id=user_id,
        tenant_id=getattr(ledger_entry, "tenant_id", None)
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

    tenant_id = get_current_tenant_id()
    allow_negative = get_allow_negative_inventory(db, tenant_id)

    if (not stock_bal or stock_bal.quantity_on_hand < qty) and not allow_negative:
        if batch_id is None:
            # Fallback to any batch that has sufficient quantity
            stock_bal = db.query(models.WarehouseStock).filter(
                models.WarehouseStock.warehouse_id == warehouse_id,
                models.WarehouseStock.item_id == item_id,
                models.WarehouseStock.quantity_on_hand >= qty
            ).first()

        if not stock_bal or stock_bal.quantity_on_hand < qty:
            raise ValueError("Insufficient inventory available.")

    if not stock_bal:
        stock_bal = models.WarehouseStock(
            warehouse_id=warehouse_id,
            item_id=item_id,
            batch_id=batch_id,
            quantity_on_hand=0,
            quantity_reserved=0,
            quantity_damaged=0,
            quantity_transit=0,
            valuation_unit_cost=Decimal("0.0"),
            tenant_id=tenant_id
        )
        db.add(stock_bal)
        db.flush()

    # Calculate Costing unit cost & consume cost layers
    fifo_unit_cost = consume_cost_layers(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        qty_to_issue=Decimal(str(qty)),
        fallback_cost=stock_bal.valuation_unit_cost,
        reference_type=reference_type,
        reference_id=reference_id,
        user_id=user_id,
        tenant_id=getattr(stock_bal, "tenant_id", tenant_id)
    )

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

    # Canonical Movement Ledger: InventoryTransaction & Line
    log_inventory_movement(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        transaction_type="ISSUE",
        qty=-qty,
        unit_cost=fifo_unit_cost,
        batch_id=batch_id,
        reference_type=reference_type,
        reference_id=reference_id,
        user_id=user_id,
        remarks=remarks,
        tenant_id=tenant_id
    )

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

def record_material_issue(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    qty: Decimal,
    reference_type: str,
    reference_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    batch_id: Optional[uuid.UUID] = None,
    remarks: Optional[str] = None
) -> tuple:
    """
    ACID helper for material consumption issues. Validates stock limits, consumes layers,
    and updates StockLedger, Valuation, Audit, and Canonical Movement Ledger tables.
    Returns (unit_cost, total_cost, consumed_layers_info, costing_method)
    """
    logger.info(f"Inventory Engine: record_material_issue for item {item_id}, warehouse {warehouse_id}, qty {qty}")
    
    # Check current stock balance
    stock_bal = db.query(models.WarehouseStock).filter(
        models.WarehouseStock.warehouse_id == warehouse_id,
        models.WarehouseStock.item_id == item_id,
        models.WarehouseStock.batch_id == batch_id
    ).first()

    tenant_id = get_current_tenant_id()
    allow_negative = get_allow_negative_inventory(db, tenant_id)

    # Validate stock
    current_qty = stock_bal.quantity_on_hand if stock_bal else Decimal("0.0")
    if not allow_negative and current_qty < qty:
        if batch_id is None:
            stock_bal = db.query(models.WarehouseStock).filter(
                models.WarehouseStock.warehouse_id == warehouse_id,
                models.WarehouseStock.item_id == item_id,
                models.WarehouseStock.quantity_on_hand >= qty
            ).first()
        if not stock_bal or stock_bal.quantity_on_hand < qty:
            raise ValueError("Insufficient inventory available.")

    if not stock_bal:
        stock_bal = models.WarehouseStock(
            warehouse_id=warehouse_id,
            item_id=item_id,
            batch_id=batch_id,
            quantity_on_hand=Decimal("0.0"),
            quantity_reserved=Decimal("0.0"),
            quantity_damaged=Decimal("0.0"),
            quantity_transit=Decimal("0.0"),
            valuation_unit_cost=Decimal("0.0"),
            tenant_id=tenant_id
        )
        db.add(stock_bal)
        db.flush()

    # Track consumed layers
    consumed_layers = []
    
    # Consume layers (updates cost layers, valuation entry, and audit log)
    fifo_unit_cost = consume_cost_layers(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        qty_to_issue=qty,
        fallback_cost=stock_bal.valuation_unit_cost,
        reference_type=reference_type,
        reference_id=reference_id,
        user_id=user_id,
        tenant_id=tenant_id,
        consumed_layers_out=consumed_layers
    )

    # Deduct stock balance
    stock_bal.quantity_on_hand -= qty
    db.flush()

    # Write stock ledger entry
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
        remarks=remarks or f"Material issue under {reference_type}",
        created_by_id=user_id
    )
    db.add(ledger_entry)

    # Legacy compatibility StockLedger record
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

    # Canonical Movement Ledger (InventoryTransaction & Line)
    log_inventory_movement(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        transaction_type="ISSUE",
        qty=-qty,
        unit_cost=fifo_unit_cost,
        batch_id=batch_id,
        reference_type=reference_type,
        reference_id=reference_id,
        user_id=user_id,
        remarks=remarks,
        tenant_id=tenant_id
    )

    # Update global summary
    global_ledger = db.query(models.InventoryLedger).filter(models.InventoryLedger.item_id == item_id).first()
    if global_ledger:
        q_sum = db.query(models.WarehouseStock).filter(models.WarehouseStock.item_id == item_id).all()
        global_ledger.quantity_on_hand = sum(x.quantity_on_hand for x in q_sum)
        global_ledger.last_updated = datetime.utcnow()

    db.flush()

    costing_method = get_inventory_costing_method(db, tenant_id)
    
    # Format consumed layers reference
    layer_ref_str = None
    if consumed_layers:
        layer_ref_str = ", ".join([f"Layer {l['layer_id'][:8]} (Qty: {l['quantity']:.4f}, Cost: {l['unit_cost']:.2f})" for l in consumed_layers])
        if len(layer_ref_str) > 200:
            layer_ref_str = layer_ref_str[:197] + "..."

    return fifo_unit_cost, fifo_unit_cost * qty, layer_ref_str, costing_method


def record_material_return(
    db: Session,
    item_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    qty: Decimal,
    unit_cost: Decimal,
    reference_type: str,
    reference_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    batch_id: Optional[uuid.UUID] = None,
    remarks: Optional[str] = None
) -> tuple:
    """
    ACID helper for material returns. Restores inventory layers, reverses valuation,
    updates stock balance, StockLedger, Audit, and Canonical Movement Ledger.
    Returns (unit_cost, total_cost, costing_method)
    """
    logger.info(f"Inventory Engine: record_material_return for item {item_id}, warehouse {warehouse_id}, qty {qty}")
    
    tenant_id = get_current_tenant_id()
    
    # 1. Update Warehouse Stock Balance
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
            quantity_on_hand=Decimal("0.0"),
            quantity_reserved=Decimal("0.0"),
            quantity_damaged=Decimal("0.0"),
            quantity_transit=Decimal("0.0"),
            valuation_unit_cost=unit_cost,
            tenant_id=tenant_id
        )
        db.add(stock_bal)
        db.flush()

    # 2. Restore cost layers (creates layer, valuation entry, audit log)
    cost_layer = create_cost_layer(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        qty=qty,
        unit_cost=unit_cost,
        reference_type=reference_type,
        reference_id=reference_id,
        user_id=user_id,
        tenant_id=tenant_id
    )

    # 3. Update stock balance
    stock_bal.quantity_on_hand += qty
    stock_bal.valuation_unit_cost = cost_layer.unit_cost
    db.flush()

    # 4. Write stock ledger entry
    ledger_entry = models.StockLedgerEntry(
        item_id=item_id,
        warehouse_id=warehouse_id,
        batch_id=batch_id,
        transaction_type="RECEIPT",
        quantity_change=qty,
        resulting_on_hand=stock_bal.quantity_on_hand,
        valuation_unit_cost=cost_layer.unit_cost,
        reference_type=reference_type,
        reference_id=reference_id,
        remarks=remarks or f"Material return under {reference_type}",
        created_by_id=user_id
    )
    db.add(ledger_entry)

    # Legacy compatibility StockLedger record
    legacy_ledger = models.StockLedger(
        item_id=item_id,
        warehouse_id=warehouse_id,
        transaction_type="RECEIPT",
        reference_type=reference_type,
        reference_id=reference_id or uuid.uuid4(),
        qty_in=qty,
        qty_out=0,
        balance_after=stock_bal.quantity_on_hand,
        unit_rate=cost_layer.unit_cost,
        total_value=cost_layer.unit_cost * qty,
        remarks=remarks or f"Return for {reference_type}"
    )
    db.add(legacy_ledger)

    # Canonical Movement Ledger (InventoryTransaction & Line)
    log_inventory_movement(
        db=db,
        item_id=item_id,
        warehouse_id=warehouse_id,
        transaction_type="RECEIPT",
        qty=qty,
        unit_cost=cost_layer.unit_cost,
        batch_id=batch_id,
        reference_type=reference_type,
        reference_id=reference_id,
        user_id=user_id,
        remarks=remarks,
        tenant_id=tenant_id
    )

    # Update global summary
    global_ledger = db.query(models.InventoryLedger).filter(models.InventoryLedger.item_id == item_id).first()
    if global_ledger:
        q_sum = db.query(models.WarehouseStock).filter(models.WarehouseStock.item_id == item_id).all()
        global_ledger.quantity_on_hand = sum(x.quantity_on_hand for x in q_sum)
        global_ledger.last_updated = datetime.utcnow()

    db.flush()

    costing_method = get_inventory_costing_method(db, tenant_id)
    return cost_layer.unit_cost, cost_layer.unit_cost * qty, costing_method
