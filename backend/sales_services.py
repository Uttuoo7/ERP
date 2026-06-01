from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List

def create_sales_quotation(db: Session, qt_data: schemas.SalesQuotationCreate, user_id: uuid.UUID) -> models.SalesQuotation:
    subtotal = 0.0
    tax_amount = 0.0
    
    quotation = models.SalesQuotation(
        quotation_number=f"QT-{uuid.uuid4().hex[:6].upper()}",
        customer_id=qt_data.customer_id,
        lead_id=qt_data.lead_id,
        validity_date=qt_data.validity_date,
        remarks=qt_data.remarks,
        created_by=user_id
    )
    db.add(quotation)
    db.flush()
    
    for li in qt_data.line_items:
        gross = li.qty * li.unit_price
        discount = gross * (li.discount_percent / 100)
        taxable = gross - discount
        tax = taxable * (li.gst_percent / 100)
        total = taxable + tax
        
        subtotal += taxable
        tax_amount += tax
        
        line = models.SalesQuotationLineItem(
            quotation_id=quotation.id,
            **li.model_dump(exclude={'total'}),
            total=total
        )
        db.add(line)
        
    quotation.subtotal = subtotal
    quotation.igst = tax_amount # Assuming IGST for simplicity
    quotation.total_amount = subtotal + tax_amount
    
    if qt_data.lead_id:
        lead = db.query(models.Lead).filter(models.Lead.id == qt_data.lead_id).first()
        if lead:
            lead.stage = 'QUOTATION'
            
    db.commit()
    db.refresh(quotation)
    return quotation

def create_sales_order(db: Session, so_data: schemas.SalesOrderCreate, user_id: uuid.UUID) -> models.SalesOrder:
    # Check Customer Credit Limit First
    customer = db.query(models.Customer).filter(models.Customer.id == so_data.customer_id).first()
    if not customer:
        raise ValueError("Customer not found")
        
    # Simplified Check
    current_receivables = sum([r.balance_amount for r in customer.receivables if r.balance_amount > 0])
    
    subtotal = 0.0
    tax_amount = 0.0
    
    so = models.SalesOrder(
        sales_order_number=f"SO-{uuid.uuid4().hex[:6].upper()}",
        quotation_id=so_data.quotation_id,
        customer_id=so_data.customer_id,
        delivery_date=so_data.delivery_date
    )
    db.add(so)
    db.flush()
    
    for li in so_data.line_items:
        taxable = li.ordered_qty * li.rate
        tax = taxable * (li.gst_percent / 100)
        total = taxable + tax
        
        subtotal += taxable
        tax_amount += tax
        
        line = models.SalesOrderLineItem(
            sales_order_id=so.id,
            item_id=li.item_id,
            ordered_qty=li.ordered_qty,
            pending_qty=li.ordered_qty,
            rate=li.rate,
            gst_percent=li.gst_percent,
            total=total
        )
        db.add(line)
        
    so.subtotal = subtotal
    so.tax_amount = tax_amount
    so.total_amount = subtotal + tax_amount
    
    if current_receivables + so.total_amount > customer.credit_limit:
        # We flag it, maybe require special workflow override
        pass # The workflow engine handles blocking based on rules

    if so_data.quotation_id:
        qt = db.query(models.SalesQuotation).filter(models.SalesQuotation.id == so_data.quotation_id).first()
        if qt:
            qt.status = 'CONVERTED'
            if qt.lead_id:
                lead = db.query(models.Lead).filter(models.Lead.id == qt.lead_id).first()
                if lead: lead.stage = 'WON'
                
    db.commit()
    db.refresh(so)
    return so

def finalize_so_approval(db: Session, so_id: uuid.UUID):
    """
    Hook called by workflow engine when a Sales Order is approved.
    Reserves the inventory.
    """
    so = db.query(models.SalesOrder).filter(models.SalesOrder.id == so_id).first()
    if not so: raise ValueError("SO not found")
    
    for line in so.line_items:
        # Reserve stock in default warehouse or proportional (simplified logic)
        stock = db.query(models.InventoryStock).filter(models.InventoryStock.item_id == line.item_id).first()
        if stock:
            stock.reserved_stock += line.ordered_qty
            stock.available_stock = stock.current_stock - stock.reserved_stock
    
    so.approval_status = 'APPROVED'
    db.commit()
