import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_
from . import models, database, dependencies

router = APIRouter()

def get_rank_and_score(q_str: str, obj, entity_type: str):
    doc_num = ""
    if entity_type == "customer":
        doc_num = getattr(obj, "customer_code", "") or ""
    elif entity_type == "vendor":
        doc_num = getattr(obj, "name", "") or ""
    elif entity_type == "item":
        doc_num = getattr(obj, "sku", "") or ""
    elif entity_type == "purchase_order":
        doc_num = getattr(obj, "po_number", "") or ""
    elif entity_type == "sales_order":
        doc_num = getattr(obj, "sales_order_number", "") or getattr(obj, "so_number", "") or ""
    elif entity_type == "work_order":
        doc_num = getattr(obj, "work_order_number", "") or getattr(obj, "wo_number", "") or ""
    elif entity_type == "grn":
        doc_num = getattr(obj, "grn_number", "") or ""
    elif entity_type == "invoice":
        doc_num = getattr(obj, "invoice_number", "") or ""

    doc_num_lower = doc_num.lower().strip()
    q_lower = q_str.lower().strip()

    # 1. Exact document number match
    if doc_num_lower == q_lower:
        return 1, 100, "exact_code"

    # 2. Exact ID match
    try:
        q_uuid = uuid.UUID(q_str.strip())
        if getattr(obj, "id", None) == q_uuid:
            return 2, 80, "exact_id"
    except ValueError:
        pass

    # 3. Prefix match
    if doc_num_lower.startswith(q_lower):
        return 3, 60, "prefix"

    # 4. Contains match
    other_fields = []
    if entity_type == "customer":
        other_fields = [getattr(obj, "company_name", ""), getattr(obj, "contact_email", "")]
    elif entity_type == "vendor":
        other_fields = [getattr(obj, "contact_email", "")]
    elif entity_type == "item":
        other_fields = [getattr(obj, "name", ""), getattr(obj, "description", "")]
    elif entity_type == "invoice":
        other_fields = [getattr(obj, "vendor_invoice_number", "")]

    in_other = any(q_lower in str(field).lower() for field in other_fields if field)
    if q_lower in doc_num_lower or in_other:
        return 4, 40, "contains"

    # 5. Fuzzy Match
    return 5, 20, "fuzzy"

@router.get("/search")
def global_search(
    q: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
) -> Dict[str, List[Dict[str, Any]]]:
    grouped_results = {
        "customers": [],
        "vendors": [],
        "items": [],
        "purchase_orders": [],
        "sales_orders": [],
        "work_orders": [],
        "grns": [],
        "invoices": []
    }

    if not q or not q.strip():
        return grouped_results

    q_str = q.strip()
    query_uuid = None
    try:
        query_uuid = uuid.UUID(q_str)
    except ValueError:
        pass

    # 1. Customers
    customer_query = db.query(models.Customer)
    if query_uuid:
        customers = customer_query.filter(models.Customer.id == query_uuid).all()
    else:
        customers = customer_query.filter(
            or_(
                models.Customer.customer_code.ilike(f"%{q_str}%"),
                models.Customer.company_name.ilike(f"%{q_str}%")
            )
        ).limit(15).all()
    for cust in customers:
        prio, score, m_type = get_rank_and_score(q_str, cust, "customer")
        updated_at_str = cust.updated_at.isoformat() if getattr(cust, "updated_at", None) else ""
        grouped_results["customers"].append({
            "id": str(cust.id),
            "title": cust.company_name,
            "subtitle": f"Customer Code: {cust.customer_code}",
            "status": "Active" if cust.is_active else "Inactive",
            "updated_at": updated_at_str,
            "entity_type": "Customer",
            "group": "Master Data",
            "route": "/masters?tab=customers",
            "priority": prio,
            "score": score,
            "match_type": m_type
        })

    # 2. Vendors
    vendor_query = db.query(models.Vendor)
    if query_uuid:
        vendors = vendor_query.filter(models.Vendor.id == query_uuid).all()
    else:
        vendors = vendor_query.filter(
            or_(
                models.Vendor.name.ilike(f"%{q_str}%"),
                models.Vendor.contact_email.ilike(f"%{q_str}%")
            )
        ).limit(15).all()
    for vend in vendors:
        prio, score, m_type = get_rank_and_score(q_str, vend, "vendor")
        updated_at_str = vend.updated_at.isoformat() if getattr(vend, "updated_at", None) else ""
        grouped_results["vendors"].append({
            "id": str(vend.id),
            "title": vend.name,
            "subtitle": f"Email: {vend.contact_email}",
            "status": "Active" if vend.is_active else "Inactive",
            "updated_at": updated_at_str,
            "entity_type": "Vendor",
            "group": "Master Data",
            "route": "/vendors",
            "priority": prio,
            "score": score,
            "match_type": m_type
        })

    # 3. Items
    item_query = db.query(models.Item)
    if query_uuid:
        items = item_query.filter(models.Item.id == query_uuid).all()
    else:
        items = item_query.filter(
            or_(
                models.Item.sku.ilike(f"%{q_str}%"),
                models.Item.name.ilike(f"%{q_str}%"),
                models.Item.description.ilike(f"%{q_str}%")
            )
        ).limit(15).all()
    for item in items:
        prio, score, m_type = get_rank_and_score(q_str, item, "item")
        updated_at_str = item.updated_at.isoformat() if getattr(item, "updated_at", None) else ""
        grouped_results["items"].append({
            "id": str(item.id),
            "title": item.name,
            "subtitle": f"SKU: {item.sku} - Category: {item.category}",
            "status": "Active" if item.is_active else "Inactive",
            "updated_at": updated_at_str,
            "entity_type": "Item",
            "group": "Master Data",
            "route": "/items",
            "priority": prio,
            "score": score,
            "match_type": m_type
        })

    # 4. Purchase Orders
    po_query = db.query(models.PurchaseOrder)
    if query_uuid:
        pos = po_query.filter(models.PurchaseOrder.id == query_uuid).all()
    else:
        pos = po_query.filter(models.PurchaseOrder.po_number.ilike(f"%{q_str}%")).limit(15).all()
    for po in pos:
        prio, score, m_type = get_rank_and_score(q_str, po, "purchase_order")
        updated_at_str = po.updated_at.isoformat() if getattr(po, "updated_at", None) else ""
        grouped_results["purchase_orders"].append({
            "id": str(po.id),
            "title": po.po_number,
            "subtitle": f"Total: {po.total_amount}",
            "status": po.status.value if hasattr(po.status, "value") else str(po.status),
            "updated_at": updated_at_str,
            "entity_type": "Purchase Order",
            "group": "Purchasing",
            "route": f"/pos/{po.id}",
            "priority": prio,
            "score": score,
            "match_type": m_type
        })

    # 5. Sales Orders
    # SalesOrder
    so_query = db.query(models.SalesOrder)
    if query_uuid:
        sos = so_query.filter(models.SalesOrder.id == query_uuid).all()
    else:
        sos = so_query.filter(models.SalesOrder.sales_order_number.ilike(f"%{q_str}%")).limit(15).all()
    for so in sos:
        prio, score, m_type = get_rank_and_score(q_str, so, "sales_order")
        updated_at_str = so.created_at.isoformat() if getattr(so, "created_at", None) else ""
        grouped_results["sales_orders"].append({
            "id": str(so.id),
            "title": so.sales_order_number,
            "subtitle": f"Total: {so.total_amount}",
            "status": so.approval_status,
            "updated_at": updated_at_str,
            "entity_type": "Sales Order",
            "group": "Finance",
            "route": f"/sales-orders/{so.id}",
            "priority": prio,
            "score": score,
            "match_type": m_type
        })

    # InternalSalesOrder
    iso_query = db.query(models.InternalSalesOrder)
    if query_uuid:
        isos = iso_query.filter(models.InternalSalesOrder.id == query_uuid).all()
    else:
        isos = iso_query.filter(models.InternalSalesOrder.so_number.ilike(f"%{q_str}%")).limit(15).all()
    for iso in isos:
        prio, score, m_type = get_rank_and_score(q_str, iso, "sales_order")
        updated_at_str = iso.updated_at.isoformat() if getattr(iso, "updated_at", None) else ""
        grouped_results["sales_orders"].append({
            "id": str(iso.id),
            "title": iso.so_number,
            "subtitle": "Internal Sales Order",
            "status": iso.status,
            "updated_at": updated_at_str,
            "entity_type": "Sales Order",
            "group": "Finance",
            "route": f"/sales-orders/{iso.id}",
            "priority": prio,
            "score": score,
            "match_type": m_type
        })

    # 6. Work Orders
    wo_query = db.query(models.WorkOrder)
    if query_uuid:
        wos = wo_query.filter(models.WorkOrder.id == query_uuid).all()
    else:
        wos = wo_query.filter(
            or_(
                models.WorkOrder.work_order_number.ilike(f"%{q_str}%"),
                models.WorkOrder.wo_number.ilike(f"%{q_str}%")
            )
        ).limit(15).all()
    for wo in wos:
        prio, score, m_type = get_rank_and_score(q_str, wo, "work_order")
        updated_at_str = wo.created_at.isoformat() if getattr(wo, "created_at", None) else ""
        grouped_results["work_orders"].append({
            "id": str(wo.id),
            "title": wo.work_order_number or wo.wo_number,
            "subtitle": f"Qty: {wo.quantity}",
            "status": wo.status,
            "updated_at": updated_at_str,
            "entity_type": "Work Order",
            "group": "Inventory",
            "route": "/manufacturing/work-orders",
            "priority": prio,
            "score": score,
            "match_type": m_type
        })

    # 7. Goods Receipt Notes
    grn_query = db.query(models.GoodsReceiptNote)
    if query_uuid:
        grns = grn_query.filter(models.GoodsReceiptNote.id == query_uuid).all()
    else:
        grns = grn_query.filter(models.GoodsReceiptNote.grn_number.ilike(f"%{q_str}%")).limit(15).all()
    for grn in grns:
        prio, score, m_type = get_rank_and_score(q_str, grn, "grn")
        updated_at_str = grn.receipt_date.isoformat() if getattr(grn, "receipt_date", None) else ""
        grouped_results["grns"].append({
            "id": str(grn.id),
            "title": grn.grn_number,
            "subtitle": f"Receipt Date: {grn.receipt_date.strftime('%Y-%m-%d') if grn.receipt_date else ''}",
            "status": grn.status,
            "updated_at": updated_at_str,
            "entity_type": "Goods Receipt Note",
            "group": "Inventory",
            "route": f"/grns/{grn.id}",
            "priority": prio,
            "score": score,
            "match_type": m_type
        })

    # 8. Invoices
    inv_query = db.query(models.Invoice)
    if query_uuid:
        invoices = inv_query.filter(models.Invoice.id == query_uuid).all()
    else:
        invoices = inv_query.filter(
            or_(
                models.Invoice.invoice_number.ilike(f"%{q_str}%"),
                models.Invoice.vendor_invoice_number.ilike(f"%{q_str}%")
            )
        ).limit(15).all()
    for inv in invoices:
        prio, score, m_type = get_rank_and_score(q_str, inv, "invoice")
        updated_at_str = inv.invoice_date.isoformat() if getattr(inv, "invoice_date", None) else ""
        grouped_results["invoices"].append({
            "id": str(inv.id),
            "title": inv.invoice_number,
            "subtitle": f"Total: {inv.total_amount}",
            "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
            "updated_at": updated_at_str,
            "entity_type": "Invoice",
            "group": "Finance",
            "route": f"/invoices/{inv.id}",
            "priority": prio,
            "score": score,
            "match_type": m_type
        })

    # Sort each group individually by priority (asc) and score (desc)
    for key in grouped_results:
        grouped_results[key].sort(key=lambda x: (x["priority"], -x["score"]))
        # Truncate to 15
        grouped_results[key] = grouped_results[key][:15]

    return grouped_results
