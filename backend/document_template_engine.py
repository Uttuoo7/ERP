import logging
import uuid
import qrcode
import base64
from io import BytesIO
from datetime import datetime
from typing import Dict, Any, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from . import models

logger = logging.getLogger(__name__)

TENANT_STATE_CODE = "27" # Maharashtra as default for the Tenant

def generate_qr_base64(data: str) -> str:
    """Generates a QR code and returns it as a base64 string for embedding in HTML."""
    qr = qrcode.QRCode(version=1, box_size=4, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

def calculate_taxes(base_amount: Decimal, tax_rate: Decimal, vendor_state: str) -> Dict[str, Decimal]:
    """
    Calculates CGST/SGST vs IGST based on the state codes.
    """
    amount = Decimal(str(base_amount))
    rate = Decimal(str(tax_rate))
    
    total_tax = amount * (rate / Decimal("100.0"))
    
    if vendor_state == TENANT_STATE_CODE:
        # Intra-state
        return {
            "cgst": total_tax / 2,
            "sgst": total_tax / 2,
            "igst": Decimal("0.0")
        }
    else:
        # Inter-state
        return {
            "cgst": Decimal("0.0"),
            "sgst": Decimal("0.0"),
            "igst": total_tax
        }

def generate_po_html(db: Session, po: models.PurchaseOrder) -> str:
    """
    Generates a professional enterprise-grade HTML representation of a Purchase Order.
    """
    vendor = po.vendor
    commercial_profile = vendor.commercial_profile if vendor else None
    vendor_state = commercial_profile.state_code if commercial_profile else "00"
    
    terms = db.query(models.CommercialTermsTemplate).filter(models.CommercialTermsTemplate.id == po.commercial_terms_id).first() if po.commercial_terms_id else None
    
    # Calculate line item taxes dynamically
    lines_html = ""
    for line in po.line_items:
        taxes = calculate_taxes(line.total_price, line.taxes, vendor_state)
        
        lines_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{line.item.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{line.hsn_code or '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">{line.quantity_ordered}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${line.unit_price:,.2f}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${line.total_price:,.2f}</td>
        </tr>
        """
        
    qr_data = f"PO:{po.po_number}|DT:{po.order_date.strftime('%Y-%m-%d')}|AMT:{po.total_amount}"
    qr_b64 = generate_qr_base64(qr_data)
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Purchase Order {po.po_number}</title>
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 40px; background: #fff; }}
            .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }}
            .company-info h1 {{ margin: 0; color: #2563eb; font-size: 28px; }}
            .company-info p {{ margin: 5px 0 0 0; color: #666; font-size: 14px; }}
            .document-details {{ text-align: right; }}
            .document-details h2 {{ margin: 0; font-size: 24px; color: #333; text-transform: uppercase; letter-spacing: 2px; }}
            .document-details p {{ margin: 5px 0; font-size: 14px; }}
            .parties {{ display: flex; justify-content: space-between; margin-bottom: 30px; }}
            .party {{ width: 45%; }}
            .party h3 {{ border-bottom: 1px solid #ddd; padding-bottom: 5px; font-size: 16px; color: #444; }}
            .party p {{ margin: 5px 0; font-size: 14px; }}
            table {{ width: 100%; border-collapse: collapse; margin-bottom: 30px; }}
            th {{ background: #f8fafc; padding: 12px 10px; text-align: left; font-size: 14px; color: #475569; border-bottom: 2px solid #e2e8f0; }}
            .summary-table {{ width: 40%; float: right; margin-bottom: 30px; }}
            .summary-table td {{ padding: 8px 10px; font-size: 14px; }}
            .summary-table .total-row td {{ font-weight: bold; border-top: 2px solid #e2e8f0; font-size: 16px; }}
            .terms-section {{ clear: both; margin-top: 40px; page-break-inside: avoid; }}
            .terms-section h3 {{ font-size: 16px; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }}
            .terms-section p {{ font-size: 12px; color: #555; white-space: pre-wrap; }}
            .footer {{ margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }}
            .signature-block {{ width: 200px; text-align: center; }}
            .signature-line {{ border-bottom: 1px solid #333; margin-bottom: 10px; height: 40px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-info">
                <h1>ACME CORP ENTERPRISE</h1>
                <p>123 Enterprise Way, Tech Park<br>State Code: {TENANT_STATE_CODE}<br>GSTIN: 27AAAAA0000A1Z5</p>
            </div>
            <div class="document-details">
                <h2>Purchase Order</h2>
                <p><strong>PO Number:</strong> {po.po_number}</p>
                <p><strong>Date:</strong> {po.order_date.strftime('%d-%b-%Y')}</p>
                <img src="{qr_b64}" alt="QR Verification" style="width: 80px; height: 80px; margin-top: 10px;">
            </div>
        </div>
        
        <div class="parties">
            <div class="party">
                <h3>Vendor Details</h3>
                <p><strong>{vendor.name if vendor else 'Unknown'}</strong></p>
                <p>GSTIN: {vendor.gstin if vendor else 'N/A'}</p>
                <p>State Code: {vendor_state}</p>
            </div>
            <div class="party">
                <h3>Delivery Location</h3>
                <p><strong>{po.delivery_type}</strong></p>
                <p>Attention: {po.ship_to_contact_name}</p>
                <p>Delivery By: {po.expected_delivery_date.strftime('%d-%b-%Y') if po.expected_delivery_date else 'TBD'}</p>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Item Description</th>
                    <th>HSN/SAC</th>
                    <th style="text-align: right;">Qty</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Total Base</th>
                </tr>
            </thead>
            <tbody>
                {lines_html}
            </tbody>
        </table>
        
        <table class="summary-table">
            <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">${float(po.total_amount - po.cgst - po.sgst - po.igst - po.freight_tax):,.2f}</td>
            </tr>
            <tr>
                <td>CGST:</td>
                <td style="text-align: right;">${float(po.cgst):,.2f}</td>
            </tr>
            <tr>
                <td>SGST:</td>
                <td style="text-align: right;">${float(po.sgst):,.2f}</td>
            </tr>
            <tr>
                <td>IGST:</td>
                <td style="text-align: right;">${float(po.igst):,.2f}</td>
            </tr>
            <tr>
                <td>Freight/Other Tax:</td>
                <td style="text-align: right;">${float(po.freight_tax):,.2f}</td>
            </tr>
            <tr class="total-row">
                <td>Grand Total:</td>
                <td style="text-align: right;">${float(po.total_amount):,.2f}</td>
            </tr>
        </table>
        
        <div class="terms-section">
            <h3>Commercial Terms & Conditions</h3>
            <p><strong>Payment Terms:</strong> {terms.payment_terms if terms else (po.payment_terms or 'Standard 30 Days')}</p>
            <p><strong>Freight Terms:</strong> {terms.freight_terms if terms else (po.delivery_terms or 'As per standard policy')}</p>
            <p><strong>Warranty:</strong> {terms.warranty_clauses if terms else 'Standard Warranty Applies'}</p>
            <p style="margin-top: 15px; font-size: 10px; color: #888;">This is a computer generated document and does not require a physical signature. Scanning the QR code validates the authenticity of this order against the Enterprise Ledger.</p>
        </div>
        
        <div class="footer">
            <div class="banking-info" style="font-size: 12px; color: #555; width: 60%;">
                <strong>Vendor Remittance Details:</strong><br>
                A/C: {commercial_profile.account_number if commercial_profile else 'N/A'} | IFSC: {commercial_profile.swift_code if commercial_profile else 'N/A'}<br>
                UPI: {commercial_profile.upi_id if commercial_profile else 'N/A'}
            </div>
            <div class="signature-block">
                <div class="signature-line"></div>
                <p style="font-size: 14px; margin: 0;">Authorized Signatory</p>
                <p style="font-size: 12px; color: #666; margin: 0;">Acme Corp Enterprise</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html
