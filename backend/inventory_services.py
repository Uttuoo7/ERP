from sqlalchemy.orm import Session
from datetime import datetime
from decimal import Decimal
import uuid
import logging

from . import models, schemas
from .document_template_engine import TENANT_STATE_CODE

logger = logging.getLogger(__name__)

def recalculate_moving_average_price(current_qty: int, current_rate: Decimal, new_qty: int, new_rate: Decimal) -> Decimal:
    """Calculates the new Moving Average Price (MAP) when new stock is received."""
    if current_qty + new_qty == 0:
        return Decimal("0.0")
    total_val = (Decimal(current_qty) * current_rate) + (Decimal(new_qty) * new_rate)
    return total_val / Decimal(current_qty + new_qty)

def process_grn_acceptance(db: Session, grn: models.GoodsReceiptNote, user_id: uuid.UUID):
    """
    Executes business logic for accepting a GRN:
    1. Validates quantities against PO
    2. Calculates GST splits (Intra vs Inter-state)
    3. Creates StockLedger entries
    4. Updates InventoryStock
    5. Updates PO fulfillment status
    """
    if grn.status not in ["APPROVED", "QC_PENDING", "PARTIAL"]:
        raise ValueError("GRN must be APPROVED or in an acceptable state to process inventory movement.")

    vendor = db.query(models.Vendor).filter(models.Vendor.id == grn.vendor_id).first()
    vendor_state = vendor.commercial_profile.state_code if vendor and vendor.commercial_profile else "00"
    
    total_cgst = Decimal("0.0")
    total_sgst = Decimal("0.0")
    total_igst = Decimal("0.0")
    subtotal = Decimal("0.0")
    
    for line in grn.line_items:
        if line.accepted_qty <= 0:
            continue
            
        if line.accepted_qty > (line.quantity_ordered - line.previously_received_qty):
            raise ValueError(f"Cannot accept more than remaining PO quantity for item {line.item_id}")
            
        line.pending_qty = line.quantity_ordered - (line.previously_received_qty + line.accepted_qty)
        line.total = Decimal(line.accepted_qty) * line.unit_price
        subtotal += line.total
        
        # Calculate taxes
        tax_val = line.total * (line.gst_percent / Decimal("100.0"))
        if vendor_state == TENANT_STATE_CODE:
            total_cgst += tax_val / 2
            total_sgst += tax_val / 2
        else:
            total_igst += tax_val
            
        # Inventory Updates
        stock = db.query(models.InventoryStock).filter(
            models.InventoryStock.item_id == line.item_id,
            models.InventoryStock.warehouse_id == grn.warehouse_id
        ).first()
        
        if not stock:
            stock = models.InventoryStock(
                item_id=line.item_id,
                warehouse_id=grn.warehouse_id,
                current_stock=0,
                available_stock=0
            )
            db.add(stock)
            db.flush()
            
        # We need the current MAP (for a fully fledged system we'd pull from Item.standard_rate or last ledger entry)
        current_map = line.item.standard_rate
        new_map = recalculate_moving_average_price(stock.current_stock, current_map, line.accepted_qty, line.unit_price)
        line.item.standard_rate = new_map
        
        # Post to Stock Ledger
        ledger_entry = models.StockLedger(
            item_id=line.item_id,
            warehouse_id=grn.warehouse_id,
            transaction_type="GRN_RECEIPT",
            reference_type="GRN",
            reference_id=grn.id,
            qty_in=line.accepted_qty,
            qty_out=0,
            balance_after=stock.current_stock + line.accepted_qty,
            unit_rate=line.unit_price,
            total_value=line.total,
            remarks=f"Receipt from Vendor PO {grn.purchase_order.po_number}"
        )
        db.add(ledger_entry)
        
        # Update physical stock
        stock.current_stock += line.accepted_qty
        stock.available_stock += line.accepted_qty

        # Create cost layer for inventory valuation
        from . import inventory_engine
        inventory_engine.create_cost_layer(
            db=db,
            item_id=line.item_id,
            warehouse_id=grn.warehouse_id,
            qty=Decimal(str(line.accepted_qty)),
            unit_cost=Decimal(str(line.unit_price)),
            reference_type="GOODS_RECEIPT_NOTE",
            reference_id=grn.id,
            user_id=user_id,
            tenant_id=getattr(grn, "tenant_id", None)
        )
        
        # Update PO Line Item fulfillment
        po_line = db.query(models.POLineItem).filter(models.POLineItem.id == line.po_line_item_id).first()
        if po_line:
            po_line.quantity_received += line.accepted_qty
            po_line.remaining_quantity = Decimal(po_line.quantity_ordered - po_line.quantity_received)

    grn.subtotal = subtotal
    grn.cgst = total_cgst
    grn.sgst = total_sgst
    grn.igst = total_igst
    grn.total_amount = subtotal + total_cgst + total_sgst + total_igst
    grn.status = "RECEIVED"
    
    # Check if PO is fully fulfilled
    po = grn.purchase_order
    all_lines_fulfilled = all((l.quantity_ordered - l.quantity_received) <= 0 for l in po.line_items)
    if all_lines_fulfilled:
        po.status = "FULFILLED"
    else:
        po.status = "PARTIAL_RECEIPT"
        
    db.commit()
    db.refresh(grn)
    return grn
