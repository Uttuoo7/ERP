import logging
import json
from decimal import Decimal
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from .. import models

logger = logging.getLogger(__name__)

def detect_anomalies(db: Session, invoice_data: Dict[str, Any], vendor_id: str) -> List[str]:
    """
    Runs basic heuristic checks to detect potential fraud or anomalies.
    """
    flags = []
    
    total_amount = invoice_data.get("total_amount", 0)
    invoice_number = invoice_data.get("invoice_number", "")
    invoice_date = invoice_data.get("invoice_date")
    
    if not invoice_date:
        flags.append("Missing invoice date")
    
    # 1. Duplicate Detection Check
    if invoice_number and invoice_date:
        try:
            parsed_date = datetime.fromisoformat(invoice_date.replace("Z", "+00:00"))
            
            # Look for invoices with exactly the same amount and same vendor within a 7-day window
            start_date = parsed_date - timedelta(days=7)
            end_date = parsed_date + timedelta(days=7)
            
            duplicates = db.query(models.Invoice).filter(
                models.Invoice.vendor_id == vendor_id,
                models.Invoice.total_amount == total_amount,
                models.Invoice.invoice_date.between(start_date, end_date)
            ).all()
            
            if duplicates:
                flags.append(f"Potential duplicate: Found {len(duplicates)} invoice(s) with identical amount from this vendor in a 7-day window.")
        except Exception as e:
            logger.warning(f"Failed to parse invoice date for anomaly detection: {e}")

    # 2. Velocity Check (too many invoices in short time)
    recent_count = db.query(models.Invoice).filter(
        models.Invoice.vendor_id == vendor_id,
        models.Invoice.created_at >= datetime.utcnow() - timedelta(days=1)
    ).count()
    
    if recent_count > 5:
        flags.append("High velocity: More than 5 invoices submitted for this vendor in the last 24 hours.")
        
    return flags

def calculate_confidence_score(invoice_data: Dict[str, Any], po: models.PurchaseOrder) -> Tuple[Decimal, str]:
    """
    Calculates a confidence score based on the clarity of the extraction and PO matching.
    """
    score = 100.0
    
    # 1. Total Amount match
    extracted_total = Decimal(str(invoice_data.get("total_amount", 0)))
    po_total = sum(line.quantity_ordered * line.unit_price for line in po.line_items)
    
    if extracted_total != po_total:
        variance = abs(extracted_total - po_total) / po_total if po_total > 0 else Decimal(1)
        if variance < Decimal("0.05"):
            score -= 10.0 # Minor variance (tax/shipping)
        else:
            score -= 30.0 # Major variance
            
    # 2. Line item matching
    extracted_lines = invoice_data.get("line_items", [])
    if len(extracted_lines) == 0:
        score -= 20.0
    elif len(extracted_lines) != len(po.line_items):
        score -= 15.0
        
    # Minimum score floor
    if score < 0:
        score = 0.0
        
    recommendation = "MANUAL_REVIEW_REQUIRED"
    if score >= 90.0:
        recommendation = "AUTO_APPROVE"
    elif score >= 75.0:
        recommendation = "STANDARD_WORKFLOW"
        
    return Decimal(str(score)), recommendation

def generate_mock_extraction(raw_text: str) -> Dict[str, Any]:
    """
    Simulates calling an LLM (e.g. OpenAI or Gemini) to parse raw text into structured JSON.
    In a real implementation, this would use a library like langchain or raw HTTP requests.
    """
    import random
    
    # We will simulate returning a clean dictionary
    # By searching the raw_text for keywords if possible, or just generating mock data
    
    total_match = 0
    import re
    total_regex = re.search(r"total[:\s\$]+([\d\,\.]+)", raw_text, re.IGNORECASE)
    if total_regex:
        total_match = float(total_regex.group(1).replace(",", ""))
    else:
        total_match = random.randint(100, 5000)
        
    po_match = ""
    po_regex = re.search(r"PO[-_]?(\d+)", raw_text, re.IGNORECASE)
    if po_regex:
        po_match = f"PO-{po_regex.group(1)}"
        
    return {
        "invoice_number": f"INV-{random.randint(10000, 99999)}",
        "invoice_date": datetime.utcnow().isoformat(),
        "total_amount": total_match,
        "po_number": po_match,
        "vendor_name": "Extracted Vendor LLC",
        "line_items": [
            {
                "description": "Extracted Item",
                "quantity": 1,
                "unit_price": total_match
            }
        ]
    }
