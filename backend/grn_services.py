import uuid
import json
import random
import logging
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from . import models, schemas, inventory_engine, event_dispatcher, document_traceability

logger = logging.getLogger(__name__)

def generate_grn_number() -> str:
    return f"GRN-{random.randint(10000, 99999)}"

def convert_po_to_grn_draft(
    db: Session,
    po_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    challan_no: str,
    vehicle_details: Optional[str],
    received_items: List[schemas.GRNLineItemCreate],
    user_id: uuid.UUID,
    remarks: Optional[str] = None
) -> models.GoodsReceiptNote:
    """
    Receiving Engine: Converts PO into physical GRN receiving drafts.
    Performs safety count validation to block over-receipt and binds Document Traceability linkage.
    """
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise ValueError("Referenced Purchase Order not located.")

    if po.status == models.POStatus.FULFILLED:
        raise ValueError("Purchase Order is already fully satisfied/fulfilled.")

    grn_num = generate_grn_number()
    grn = models.GoodsReceiptNote(
        grn_number=grn_num,
        po_id=po_id,
        vendor_id=po.vendor_id,
        warehouse_id=warehouse_id,
        received_by_id=user_id,
        vehicle_details=vehicle_details,
        delivery_challan_number=challan_no,
        status="QC_PENDING",
        workflow_state="APPROVED", # Auto-approved draft receive
        remarks=remarks
    )
    db.add(grn)
    db.flush()

    line_links = []

    for item in received_items:
        po_line = db.query(models.POLineItem).filter(models.POLineItem.id == item.po_line_item_id).first()
        if not po_line:
            raise ValueError(f"POLineItem reference {item.po_line_item_id} not located.")

        # Prevents over-ordering receipts
        remaining = po_line.quantity_ordered - po_line.quantity_received
        if item.quantity_received > remaining:
            raise ValueError(
                f"Receipt failure: item {po_line.item.sku} quantity received ({item.quantity_received}) "
                f"exceeds remaining PO balance ({remaining})."
            )

        serial_json = json.dumps(item.serial_numbers) if item.serial_numbers else None
        
        grn_line = models.GRNLineItem(
            grn_id=grn.id,
            po_line_item_id=item.po_line_item_id,
            item_id=item.item_id,
            quantity_ordered=po_line.quantity_ordered,
            quantity_received=item.quantity_received,
            quantity_accepted=0,
            quantity_rejected=0,
            quantity_damaged=0,
            remaining_quantity=remaining,
            batch_number=item.batch_number,
            serial_numbers=serial_json,
            expiry_date=item.expiry_date,
            warehouse_location=item.warehouse_location
        )
        db.add(grn_line)
        db.flush()

        # Build list for traceability conversion links
        line_links.append({
            "source_line_id": po_line.id,
            "target_line_id": grn_line.id,
            "quantity_converted": item.quantity_received
        })

    # Register relationship in Traceability Engine
    document_traceability.create_relationship(
        db=db,
        source_type="PURCHASE_ORDER",
        source_id=po_id,
        target_type="GOODS_RECEIPT_NOTE",
        target_id=grn.id,
        line_links=line_links,
        user_id=user_id
    )

    db.commit()
    logger.info(f"Receiving Engine: Draft receiving created {grn.grn_number} for PO {po.po_number}")
    return grn

def submit_qc_inspection(
    db: Session,
    grn_id: uuid.UUID,
    qc_items: List[schemas.GRNQCItem],
    inspector_id: uuid.UUID,
    remarks: Optional[str] = None
) -> models.GoodsReceiptNote:
    """
    Quality Inspection Gate: Validates items counts, increments warehouse stock balances,
    records lot batches / serial numbers, updates PO fulfillment status, and logs vendor delivery speed analytics.
    """
    grn = db.query(models.GoodsReceiptNote).filter(models.GoodsReceiptNote.id == grn_id).first()
    if not grn:
        raise ValueError("Goods Receipt Note reference not located.")

    if grn.status != "QC_PENDING":
        raise ValueError("This GRN is already inspected and processed.")

    grn.inspected_by_id = inspector_id
    grn.inspection_date = datetime.utcnow()
    grn.inspection_remarks = remarks

    total_received_sum = 0
    total_accepted_sum = 0
    total_rejected_sum = 0

    for qc in qc_items:
        line = db.query(models.GRNLineItem).filter(models.GRNLineItem.id == qc.line_item_id).first()
        if not line:
            raise ValueError(f"GRNLineItem id {qc.line_item_id} not located.")

        # Reconcile counts check
        expected_total = qc.quantity_accepted + qc.quantity_rejected + qc.quantity_damaged
        if expected_total != line.quantity_received:
            raise ValueError(
                f"QC Count Reconciliation mismatch on SKU {line.item.sku}. "
                f"Received: {line.quantity_received}, Sum of (Accepted+Rejected+Damaged): {expected_total}"
            )

        line.quantity_accepted = qc.quantity_accepted
        line.quantity_rejected = qc.quantity_rejected
        line.quantity_damaged = qc.quantity_damaged
        line.inspection_remarks = qc.remarks
        
        # Override batch / serial numbers at QC console if specified
        if qc.batch_number:
            line.batch_number = qc.batch_number
        if qc.expiry_date:
            line.expiry_date = qc.expiry_date
        if qc.serial_numbers:
            line.serial_numbers = json.dumps(qc.serial_numbers)

        # 1. Update Inventory Ledger balances for accepted goods
        if qc.quantity_accepted > 0:
            serials_list = qc.serial_numbers or []
            # Fallback parsing if string serial text
            if not serials_list and line.serial_numbers:
                try:
                    serials_list = json.loads(line.serial_numbers)
                except Exception:
                    serials_list = []

            inventory_engine.record_receipt(
                db=db,
                item_id=line.item_id,
                warehouse_id=grn.warehouse_id,
                qty=qc.quantity_accepted,
                unit_cost=line.po_line_item.unit_price,
                batch_no=line.batch_number,
                expiry_date=line.expiry_date,
                serial_nos=serials_list,
                reference_type="GOODS_RECEIPT_NOTE",
                reference_id=grn.id,
                user_id=inspector_id,
                remarks=qc.remarks or f"QC approved stock under {grn.grn_number}"
            )

        # 2. Update Damaged Balance Counts (Quarantined in warehouse balance sheet)
        if qc.quantity_damaged > 0:
            stock_bal = db.query(models.WarehouseStock).filter(
                models.WarehouseStock.warehouse_id == grn.warehouse_id,
                models.WarehouseStock.item_id == line.item_id
            ).first()
            if stock_bal:
                stock_bal.quantity_damaged += qc.quantity_damaged
                db.flush()

        # 3. Update PO remaining quantities received
        po_line = line.po_line_item
        po_line.quantity_received += qc.quantity_accepted
        db.flush()

        total_received_sum += line.quantity_received
        total_accepted_sum += qc.quantity_accepted
        total_rejected_sum += qc.quantity_rejected

    # 4. Recalculate GRN status
    if total_accepted_sum == total_received_sum:
        grn.status = "FULLY_ACCEPTED"
    elif total_accepted_sum == 0 and total_rejected_sum > 0:
        grn.status = "REJECTED"
    else:
        grn.status = "PARTIALLY_ACCEPTED"

    # 5. Check PO overall receiving completion status
    po = grn.purchase_order
    all_fulfilled = True
    for pl in po.line_items:
        if pl.quantity_received < pl.quantity_ordered:
            all_fulfilled = False
            break

    if all_fulfilled:
        po.status = models.POStatus.FULFILLED
    else:
        po.status = models.POStatus.PARTIAL_RECEIPT

    db.flush()

    # 6. Vendor Performance Track Summary
    expected_date = po.expected_delivery_date
    receipt_date = grn.receipt_date
    delay_days = 0
    if expected_date:
        delay = (receipt_date - expected_date).days
        delay_days = max(0, delay)

    fill_rate = 100.0
    rejection_rate = 0.0
    if total_received_sum > 0:
        fill_rate = (total_accepted_sum / total_received_sum) * 100
        rejection_rate = (total_rejected_sum / total_received_sum) * 100

    # 7. Dispatch Events
    event_dispatcher.dispatch(
        "goods_received",
        {
            "grn_id": grn.id,
            "grn_number": grn.grn_number,
            "po_number": po.po_number,
            "vendor_name": po.vendor.name if po.vendor else None,
            "total_accepted": total_accepted_sum
        },
        db
    )
    
    event_dispatcher.dispatch(
        "QC_completed",
        {
            "grn_id": grn.id,
            "inspector_id": inspector_id,
            "status": grn.status,
            "total_accepted": total_accepted_sum
        },
        db
    )

    event_dispatcher.dispatch(
        "vendor_delivery_recorded",
        {
            "vendor_id": po.vendor_id,
            "po_id": po.id,
            "delay_days": delay_days,
            "fill_rate": fill_rate,
            "rejection_rate": rejection_rate
        },
        db
    )

    db.commit()
    logger.info(f"Quality Inspection: GRN {grn.grn_number} status updated to {grn.status}")
    return grn
