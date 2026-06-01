import os
import uuid
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional

from .. import models

class DocumentEngine:
    """
    Central engine for creating and archiving Enterprise Documents.
    Generates HTML-based PDF mockups and hashes them for QR verification.
    """
    
    @staticmethod
    def _generate_document_hash(payload: str) -> str:
        return hashlib.sha256(payload.encode('utf-8')).hexdigest()

    @staticmethod
    def generate_purchase_order_document(db: Session, po_id: uuid.UUID, generated_by_id: Optional[uuid.UUID] = None) -> models.EnterpriseDocument:
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
        if not po:
            raise ValueError("PO not found")
            
        # In a real system, we'd use Jinja2 + WeasyPrint/pdfkit.
        # For this prototype, we generate raw HTML that looks like a PDF.
        html_content = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: 'Inter', sans-serif; padding: 40px; color: #333; }}
                    .header {{ border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 20px; }}
                    .title {{ font-size: 24px; font-weight: bold; color: #1e293b; }}
                    .meta {{ margin-bottom: 40px; display: flex; justify-content: space-between; }}
                    table {{ width: 100%; border-collapse: collapse; margin-bottom: 30px; }}
                    th, td {{ border: 1px solid #e2e8f0; padding: 12px; text-align: left; }}
                    th {{ background: #f8fafc; font-weight: 600; }}
                    .total {{ text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }}
                    .footer {{ margin-top: 50px; font-size: 12px; color: #64748b; text-align: center; }}
                    .qr-container {{ margin-top: 40px; text-align: center; }}
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">PURCHASE ORDER: {po.po_number}</div>
                    <div style="color: #64748b; margin-top: 5px;">P2P ERP Enterprise</div>
                </div>
                
                <div class="meta">
                    <div>
                        <strong>Vendor:</strong> {po.vendor.name if po.vendor else 'N/A'}<br>
                        <strong>Date:</strong> {po.order_date.strftime('%Y-%m-%d')}<br>
                    </div>
                    <div style="text-align: right;">
                        <strong>Status:</strong> {po.status}<br>
                        <strong>Delivery:</strong> {po.expected_delivery_date.strftime('%Y-%m-%d') if po.expected_delivery_date else 'N/A'}<br>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Item SKU</th>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {"".join([f"<tr><td>{line.item.sku}</td><td>{line.description or line.item.name}</td><td>{line.quantity_ordered}</td><td>${line.unit_price}</td><td>${line.quantity_ordered * line.unit_price}</td></tr>" for line in po.line_items])}
                    </tbody>
                </table>
                
                <div class="total">Grand Total: ${po.total_amount}</div>
                
                <div class="qr-container">
                    <p><strong>Scan to Verify Authenticity</strong></p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={{VERIFICATION_URL}}" alt="Verification QR" />
                </div>
                
                <div class="footer">
                    Document generated securely by P2P ERP Enterprise Document Vault.
                </div>
            </body>
        </html>
        """
        
        # Hash the pure content
        doc_hash = DocumentEngine._generate_document_hash(html_content)
        
        # Inject the verification URL into the QR code
        verification_url = f"https://p2perp.com/verify/{doc_hash}" # Mock public URL
        final_html = html_content.replace("{{VERIFICATION_URL}}", verification_url)
        
        # Save to Vault (simulated S3 storage in local temp dir)
        file_name = f"{po.po_number}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.html"
        s3_key = f"vault/po/{file_name}"
        
        # We will just store the HTML content as if it was the file binary
        
        # Create database record
        doc = models.EnterpriseDocument(
            document_type="PURCHASE_ORDER",
            reference_id=po.id,
            file_name=file_name,
            s3_key=s3_key,
            file_size_bytes=len(final_html.encode('utf-8')),
            file_hash=doc_hash,
            is_signed=True,
            created_by_id=generated_by_id
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        # Audit Log
        audit = models.DocumentAuditLog(
            document_id=doc.id,
            user_id=generated_by_id if generated_by_id else models.SYSTEM_DEFAULT_TENANT_UUID, # Fallback to system user
            action="GENERATED"
        )
        db.add(audit)
        
        # Actually save the file locally to simulate S3
        temp_dir = os.path.join(os.path.expanduser("~"), ".gemini", "antigravity", "scratch", "P2P_ERP", "storage", "vault")
        os.makedirs(os.path.dirname(os.path.join(temp_dir, s3_key)), exist_ok=True)
        with open(os.path.join(temp_dir, s3_key), "w", encoding="utf-8") as f:
            f.write(final_html)
            
        db.commit()
        
        return doc

    @staticmethod
    def generate_executive_digest(db: Session) -> models.EnterpriseDocument:
        """Scheduled task to generate daily executive digest."""
        # Aggregate SLA breaches
        stuck_tasks = db.query(models.ApprovalTask).filter(models.ApprovalTask.status == "PENDING").count()
        # Aggregate high risk vendors
        anomalies = db.query(models.OperationalRecommendation).filter(models.OperationalRecommendation.severity == "CRITICAL").count()
        
        html_content = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: 'Inter', sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; }}
                    .header {{ border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px; }}
                    .title {{ font-size: 28px; font-weight: bold; color: #f8fafc; }}
                    .card {{ background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6; }}
                    .card-critical {{ border-left: 4px solid #ef4444; }}
                    .stat-value {{ font-size: 32px; font-weight: bold; margin-top: 10px; }}
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">DAILY EXECUTIVE DIGEST</div>
                    <div style="color: #94a3b8; margin-top: 5px;">Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</div>
                </div>
                
                <div class="card card-critical">
                    <div style="color: #94a3b8; font-size: 14px; text-transform: uppercase;">Critical System Anomalies</div>
                    <div class="stat-value" style="color: #ef4444;">{anomalies}</div>
                    <p style="font-size: 14px; color: #cbd5e1; margin-top: 5px;">Requires immediate executive review in the Intelligence Hub.</p>
                </div>
                
                <div class="card">
                    <div style="color: #94a3b8; font-size: 14px; text-transform: uppercase;">SLA Breaches & Overdue Approvals</div>
                    <div class="stat-value">{stuck_tasks}</div>
                    <p style="font-size: 14px; color: #cbd5e1; margin-top: 5px;">Tasks stuck in PENDING status.</p>
                </div>
                
                <div style="margin-top: 50px; font-size: 12px; color: #475569; text-align: center;">
                    Confidential Internal Document. Do not distribute.
                </div>
            </body>
        </html>
        """
        
        doc_hash = DocumentEngine._generate_document_hash(html_content)
        file_name = f"EXEC_DIGEST_{datetime.utcnow().strftime('%Y%m%d')}.html"
        s3_key = f"vault/digests/{file_name}"
        
        doc = models.EnterpriseDocument(
            document_type="REPORT",
            reference_id=models.SYSTEM_DEFAULT_TENANT_UUID, # No specific reference
            file_name=file_name,
            s3_key=s3_key,
            file_size_bytes=len(html_content.encode('utf-8')),
            file_hash=doc_hash,
            is_signed=True
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        temp_dir = os.path.join(os.path.expanduser("~"), ".gemini", "antigravity", "scratch", "P2P_ERP", "storage", "vault")
        os.makedirs(os.path.dirname(os.path.join(temp_dir, s3_key)), exist_ok=True)
        with open(os.path.join(temp_dir, s3_key), "w", encoding="utf-8") as f:
            f.write(html_content)
            
        return doc
