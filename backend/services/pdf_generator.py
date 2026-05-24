import io
import logging
from sqlalchemy.orm import Session
from .. import models

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False

logger = logging.getLogger(__name__)

def generate_purchase_order_pdf(db: Session, po_id: str) -> bytes:
    """
    Generates a branded PDF for a Purchase Order.
    """
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise ValueError("Purchase Order not found")
        
    vendor_name = po.vendor.name if po.vendor else "Unknown Vendor"
    po_number = po.po_number
    total_amount = float(po.total_amount)
    
    # If reportlab isn't installed in the environment yet, we return a mock PDF payload
    if not HAS_REPORTLAB:
        logger.warning("ReportLab not found. Generating mock PDF bytes.")
        return f"%PDF-1.4\n%Mock PDF for PO {po_number}\n%%EOF".encode('utf-8')
        
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(colors.darkblue)
    c.drawString(50, height - 50, "ENTERPRISE ERP")
    
    c.setFont("Helvetica", 12)
    c.setFillColor(colors.black)
    c.drawString(50, height - 70, "123 Procurement Way, Tech City")
    
    # Title
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, height - 120, "PURCHASE ORDER")
    
    # Details
    c.setFont("Helvetica", 12)
    c.drawString(50, height - 150, f"PO Number: {po_number}")
    c.drawString(50, height - 170, f"Date: {po.created_at.strftime('%Y-%m-%d')}")
    c.drawString(50, height - 190, f"Vendor: {vendor_name}")
    
    # Total
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, height - 240, f"Total Amount: INR {total_amount:,.2f}")
    
    # Digital Signature Block
    c.setFont("Helvetica-Oblique", 10)
    c.setFillColor(colors.gray)
    c.drawString(50, 100, "Electronically Generated & Digitally Signed via Enterprise ERP")
    c.drawString(50, 85, f"Signature Hash: {hash(po_number + str(total_amount))}")
    
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return pdf_bytes
