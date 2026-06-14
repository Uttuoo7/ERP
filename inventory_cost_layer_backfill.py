import sys
import os
import uuid
from decimal import Decimal
from datetime import datetime

# Add root folder to sys.path so we can import backend packages
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend import models, database

def run_backfill():
    db = database.SessionLocal()
    
    # 1. Fetch Inventory Control Account (1200)
    acc = db.query(models.Account).filter_by(code='1200').first()
    if not acc:
        print("ERROR: Inventory Control Account 1200 not found.")
        db.close()
        sys.exit(1)

    # 2. Ensure default tenant is seeded
    tenant_uuid = models.SYSTEM_DEFAULT_TENANT_UUID
    tenant = db.query(models.Tenant).filter_by(id=tenant_uuid).first()
    if not tenant:
        tenant = models.Tenant(
            id=tenant_uuid,
            name="Default System Tenant",
            domain="system",
            status="ACTIVE"
        )
        db.add(tenant)
        db.flush()

    # 3. Ensure HISTORICAL-ITEM exists
    item = db.query(models.Item).filter_by(sku="HISTORICAL-ITEM").first()
    if not item:
        print(" -> Creating HISTORICAL-ITEM in database...")
        item = models.Item(
            sku="HISTORICAL-ITEM",
            name="Historical Inventory Item",
            category="Raw Material",
            uom="pcs",
            unit_price=Decimal("10.00"),
            standard_rate=Decimal("10.00"),
            tenant_id=tenant_uuid
        )
        db.add(item)
        db.flush()
    else:
        print(" -> HISTORICAL-ITEM already exists in database.")

    # 4. Fetch approved GoodsReceiptNotes ordered chronologically
    grns = db.query(models.GoodsReceiptNote).filter(
        models.GoodsReceiptNote.status == "APPROVED",
        models.GoodsReceiptNote.is_deleted == False
    ).order_by(models.GoodsReceiptNote.receipt_date.asc()).all()

    print("\n" + "=" * 60)
    print("BACKFILLING COST LAYERS FOR HISTORICAL GRNS")
    print("=" * 60)

    running_qty = Decimal("0.0")
    running_val = Decimal("0.0")

    layers_created = 0

    for grn in grns:
        # Check if layer already exists
        exists = db.query(models.InventoryCostLayer).filter_by(
            source_grn_id=grn.id,
            is_deleted=False
        ).first()
        
        if exists:
            print(f" -> Cost layer already exists for {grn.grn_number}. Skipping.")
            running_qty += exists.remaining_quantity
            running_val += exists.remaining_quantity * exists.unit_cost
            continue

        # Get GL value posted to account 1200
        je = db.query(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "GRN",
            models.JournalEntry.reference_id == grn.id,
            models.JournalEntry.is_deleted == False
        ).first()

        gl_value = Decimal("0.0")
        if je:
            lines = db.query(models.JournalLine).filter(
                models.JournalLine.journal_entry_id == je.id,
                models.JournalLine.account_id == acc.id,
                models.JournalLine.debit_amount > 0,
                models.JournalLine.is_deleted == False
            ).all()
            gl_value = sum(l.debit_amount for l in lines)

        # Skip if no GL value
        if gl_value == 0:
            print(f" -> No GL posting found for {grn.grn_number}. Skipping.")
            continue

        # Setup quantities
        unit_cost = Decimal("10.00")
        qty = gl_value / unit_cost
        
        qty_before = running_qty
        val_before = running_val
        
        running_qty += qty
        running_val += gl_value

        # Create Cost Layer
        layer = models.InventoryCostLayer(
            item_id=item.id,
            warehouse_id=grn.warehouse_id,
            original_quantity=qty,
            remaining_quantity=qty,
            unit_cost=unit_cost,
            total_cost=gl_value,
            source_grn_id=grn.id,
            source_po_id=grn.po_id,
            layer_status="OPEN",
            created_at=grn.receipt_date,
            tenant_id=tenant_uuid
        )
        db.add(layer)

        # Create Valuation Entry
        val_entry = models.InventoryValuationEntry(
            item_id=item.id,
            warehouse_id=grn.warehouse_id,
            transaction_type="RECEIPT",
            quantity=qty,
            unit_cost=unit_cost,
            total_value=gl_value,
            running_inventory_qty=running_qty,
            running_inventory_value=running_val,
            costing_method_used="FIFO",
            reference_type="GRN",
            reference_id=grn.id,
            created_at=grn.receipt_date,
            tenant_id=tenant_uuid
        )
        db.add(val_entry)

        # Create Audit Log
        audit_log = models.InventoryAuditLog(
            item_id=item.id,
            warehouse_id=grn.warehouse_id,
            action_type="RECEIPT",
            before_quantity=qty_before,
            after_quantity=running_qty,
            before_value=val_before,
            after_value=running_val,
            reference_type="GRN",
            reference_id=grn.id,
            created_at=grn.receipt_date,
            tenant_id=tenant_uuid
        )
        db.add(audit_log)

        print(f" -> Backfilled cost layers for {grn.grn_number} (Qty: {qty:.2f}, Value: {gl_value:.2f})")
        layers_created += 1

    # 5. Align inventory subledger tables (InventoryLedger, WarehouseStock, InventoryStock)
    if running_qty > 0:
        # InventoryLedger
        ledg = db.query(models.InventoryLedger).filter_by(item_id=item.id, is_deleted=False).first()
        if not ledg:
            ledg = models.InventoryLedger(
                item_id=item.id,
                quantity_on_hand=int(running_qty),
                quantity_reserved=0,
                reorder_point=0,
                last_updated=datetime.utcnow(),
                tenant_id=tenant_uuid
            )
            db.add(ledg)
        else:
            ledg.quantity_on_hand = int(running_qty)
            ledg.last_updated = datetime.utcnow()

        # WarehouseStock
        wh_stock = db.query(models.WarehouseStock).filter_by(
            item_id=item.id, 
            warehouse_id=grns[0].warehouse_id, 
            is_deleted=False
        ).first()
        if not wh_stock:
            wh_stock = models.WarehouseStock(
                item_id=item.id,
                warehouse_id=grns[0].warehouse_id,
                quantity_on_hand=int(running_qty),
                quantity_reserved=0,
                quantity_damaged=0,
                quantity_transit=0,
                valuation_unit_cost=Decimal("10.00"),
                tenant_id=tenant_uuid
            )
            db.add(wh_stock)
        else:
            wh_stock.quantity_on_hand = int(running_qty)

        # InventoryStock
        inv_stock = db.query(models.InventoryStock).filter_by(
            item_id=item.id, 
            warehouse_id=grns[0].warehouse_id, 
            is_deleted=False
        ).first()
        if not inv_stock:
            inv_stock = models.InventoryStock(
                item_id=item.id,
                warehouse_id=grns[0].warehouse_id,
                current_stock=int(running_qty),
                reserved_stock=0,
                available_stock=int(running_qty),
                last_updated=datetime.utcnow(),
                tenant_id=tenant_uuid
            )
            db.add(inv_stock)
        else:
            inv_stock.current_stock = int(running_qty)
            inv_stock.available_stock = int(running_qty)
            inv_stock.last_updated = datetime.utcnow()

        print(f"\n -> Aligned subledger stocks for HISTORICAL-ITEM to {running_qty:.2f} units.")

    db.commit()
    print("=" * 60)
    print(f"COMPLETED: Backfill complete. {layers_created} new layers created.")
    print("=" * 60)
    db.close()

if __name__ == "__main__":
    run_backfill()
