import csv
import io
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from . import models, database, dependencies

router = APIRouter()

@router.get("/pos")
def export_purchase_orders_csv(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_permission("po:view"))
):
    """
    Exports detailed PO records as a downloadable CSV stream.
    """
    pos = db.query(models.PurchaseOrder).all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "PO Number", "Vendor Name", "Department", "Currency", 
        "Payment Terms", "Total Amount", "Status", "Expected Delivery Date"
    ])
    
    for po in pos:
        writer.writerow([
            po.po_number,
            po.vendor.name if hasattr(po, 'vendor') and po.vendor else "N/A",
            po.department or "N/A",
            po.currency,
            po.payment_terms or "N/A",
            float(po.total_amount),
            po.status.value if hasattr(po.status, 'value') else str(po.status),
            po.expected_delivery_date.strftime("%Y-%m-%d") if po.expected_delivery_date else "N/A"
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=purchase_orders_report.csv"}
    )

@router.get("/liabilities")
def export_vendor_liabilities_csv(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_permission("finance:liabilities"))
):
    """
    Exports open accounts payable liabilities as a downloadable CSV stream.
    """
    liabilities = db.query(models.VendorLiability).all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Invoice ID / Ref", "Vendor Name", "Billed Amount", 
        "Outstanding Amount", "Due Date", "Status", "Created At"
    ])
    
    for liability in liabilities:
        writer.writerow([
            liability.id,
            liability.vendor.name if hasattr(liability, 'vendor') and liability.vendor else "N/A",
            float(liability.billed_amount),
            float(liability.outstanding_amount),
            liability.due_date.strftime("%Y-%m-%d") if liability.due_date else "N/A",
            liability.status,
            liability.created_at.strftime("%Y-%m-%d") if liability.created_at else "N/A"
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vendor_liabilities_report.csv"}
    )

@router.get("/mismatches")
def export_mismatches_analytical_csv(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_permission("rbac:manage"))
):
    """
    Exports mismatch discrepancies and total pricing variance reports.
    """
    mismatches = db.query(models.Invoice).filter(models.Invoice.status == models.InvoiceStatus.MISMATCH_DETECTED).all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Invoice Number", "Vendor Name", "Linked PO ID", 
        "Total Billed", "GST Amount", "Discount Amount", "Created At"
    ])
    
    for inv in mismatches:
        writer.writerow([
            inv.invoice_number,
            inv.vendor.name if hasattr(inv, 'vendor') and inv.vendor else "N/A",
            inv.po_id,
            float(inv.total_amount),
            float(inv.gst_amount),
            float(inv.discount_amount),
            inv.invoice_date.strftime("%Y-%m-%d") if inv.invoice_date else "N/A"
        ])
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mismatch_variance_report.csv"}
    )
