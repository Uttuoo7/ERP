import uuid
import logging
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from . import models, schemas, database, dependencies, matching_engine, finance_engine, event_dispatcher
from .tasks.ocr_tasks import process_invoice_ocr

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/", response_model=schemas.InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: schemas.InvoiceCreateRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    AP Entry:
    Creates a new draft vendor invoice with links to PO and optional GRN.
    Immediately triggers 3-way matching engine checks to analyze variances.
    """
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == payload.po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Associated Purchase Order not found.")

    # Calculate net total amount
    # net total = sum(billed_qty * billed_price + tax - discount)
    subtotal = sum(item.quantity_billed * item.unit_price for item in payload.billed_items)
    tax_total = sum(item.tax_amount for item in payload.billed_items)
    discount_total = sum(item.discount_amount for item in payload.billed_items)
    total_amount = subtotal + tax_total - discount_total

    # Create Invoice Header
    invoice = models.Invoice(
        po_id=payload.po_id,
        vendor_id=po.vendor_id,
        grn_id=payload.grn_id,
        invoice_number=payload.invoice_number,
        vendor_invoice_number=payload.vendor_invoice_number,
        invoice_date=payload.invoice_date or datetime.utcnow() if 'datetime' in globals() else models.datetime.utcnow() if hasattr(models, 'datetime') else models.datetime.utcnow(),
        due_date=models.datetime.utcnow() + models.timedelta(days=30) if hasattr(models, 'timedelta') else models.datetime.utcnow() + models.datetime.timedelta(days=30) if hasattr(models, 'datetime') else None,
        total_amount=total_amount,
        gst_amount=payload.gst_amount,
        tds_deducted=payload.tds_deducted,
        discount_amount=payload.discount_amount or discount_total,
        status=models.InvoiceStatus.DRAFT,
        workflow_state="DRAFT",
        remarks=payload.remarks
    )
    
    # Check for datetime library compatibility safely
    from datetime import datetime, timedelta
    invoice.invoice_date = payload.invoice_date or datetime.utcnow()
    invoice.due_date = datetime.utcnow() + timedelta(days=30)

    db.add(invoice)
    db.flush()

    # Create Invoice Line Items
    for item in payload.billed_items:
        po_line = db.query(models.POLineItem).filter(models.POLineItem.id == item.po_line_item_id).first()
        if not po_line:
            raise HTTPException(status_code=400, detail=f"PO line item {item.po_line_item_id} not found.")

        # Update PO line billed balance
        po_line.quantity_billed += item.quantity_billed

        inv_line = models.InvoiceLineItem(
            invoice_id=invoice.id,
            po_line_item_id=item.po_line_item_id,
            grn_line_item_id=item.grn_line_item_id,
            quantity_billed=item.quantity_billed,
            unit_price=item.unit_price,
            tax_amount=item.tax_amount,
            discount_amount=item.discount_amount,
            variance_amount=Decimal("0.0") if 'Decimal' in globals() else models.Decimal("0.0") if hasattr(models, 'Decimal') else 0.0,
            match_status="PENDING_MATCHING"
        )
        
        # Safe decimal setup
        from decimal import Decimal
        inv_line.variance_amount = Decimal("0.0")

        db.add(inv_line)

    db.flush()

    # Emit invoice created event
    event_dispatcher.dispatch(
        "invoice_created",
        {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "total_amount": float(total_amount)
        },
        db
    )

    # Immediately execute 3-Way Match Check
    matching_engine.run_three_way_match(db, invoice.id)

    db.commit()
    db.refresh(invoice)
    return invoice

@router.get("/", response_model=List[schemas.InvoiceResponse])
def get_invoices(
    status_filter: Optional[str] = None,
    vendor_id: Optional[uuid.UUID] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.Invoice)
    if status_filter:
        query = query.filter(models.Invoice.status == status_filter)
    if vendor_id:
        query = query.filter(models.Invoice.vendor_id == vendor_id)
    return query.order_by(models.Invoice.invoice_date.desc()).all()

@router.get("/{id}", response_model=schemas.InvoiceResponse)
def get_invoice_by_id(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice record not found.")
    return invoice

@router.post("/{id}/run-match", response_model=schemas.InvoiceResponse)
def trigger_three_way_match_api(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Triggers 3-way matching check manually.
    """
    try:
        invoice = matching_engine.run_three_way_match(db, id)
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error executing match check: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal 3-way matching evaluation failure.")

@router.post("/{id}/resolve-variance", response_model=schemas.InvoiceResponse)
def resolve_invoice_variance_api(
    id: uuid.UUID,
    resolutions: Dict[uuid.UUID, str],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.FINANCE]))
):
    """
    Allows authorized finance review teams to resolve mismatches and override discrepancies.
    """
    try:
        invoice = matching_engine.resolve_variance(db, id, resolutions, current_user.id)
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error resolving variance: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal matching override failure.")

@router.post("/{id}/post-ledger", response_model=schemas.FinancialTransactionResponse)
def post_invoice_voucher_manually_api(
    id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    """
    AP Post: Approves an invoice, posts balanced journal records to GL accounts,
    enqueues Tally export tasks.
    """
    try:
        tx = finance_engine.create_ap_invoice_voucher(db, id, current_user.id)
        return tx
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Post ledger manually error: {str(e)}")
        raise HTTPException(status_code=500, detail="General Ledger accounting post failed.")

@router.post("/ocr/upload")
async def upload_invoice_for_ocr(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Ingests a raw PDF/Image and drops it into the async AI OCR pipeline.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
        
    # In production, save file to S3 or local storage. Here we just mock it.
    file_path = f"uploads/mock_ocr_{file.filename}"
    
    queue_item = models.OCRProcessingQueue(
        file_name=file.filename,
        file_path=file_path,
        uploaded_by_id=current_user.id,
        status="QUEUED"
    )
    db.add(queue_item)
    db.commit()
    db.refresh(queue_item)
    
    # Fire background Celery Task
    process_invoice_ocr.delay(str(queue_item.id))
    
    return {
        "message": "File ingested successfully. Processing started.",
        "queue_id": str(queue_item.id),
        "status": "QUEUED"
    }

@router.get("/ocr/queue/{queue_id}")
def get_ocr_queue_status(
    queue_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    item = db.query(models.OCRProcessingQueue).filter(models.OCRProcessingQueue.id == queue_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
        
    return {
        "id": str(item.id),
        "status": item.status,
        "file_name": item.file_name,
        "invoice_id": str(item.invoice_id) if item.invoice_id else None,
        "error_log": item.error_log
    }
