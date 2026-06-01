import logging
import json
import asyncio
from decimal import Decimal
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from .. import models
from .activity_engine import ActivityEngine

logger = logging.getLogger(__name__)

class IntelligenceEngine:
    """
    Central engine for generating actionable Operational Recommendations.
    """
    
    @staticmethod
    def _create_recommendation(
        db: Session,
        module: str,
        entity_type: str,
        severity: str,
        title: str,
        description: str,
        entity_id: Optional[str] = None,
        action_payload: Optional[Dict] = None
    ) -> Optional[models.OperationalRecommendation]:
        
        # Prevent spam: check if identical active recommendation exists
        existing = db.query(models.OperationalRecommendation).filter(
            models.OperationalRecommendation.module == module,
            models.OperationalRecommendation.entity_type == entity_type,
            models.OperationalRecommendation.entity_id == entity_id,
            models.OperationalRecommendation.title == title,
            models.OperationalRecommendation.status == "ACTIVE"
        ).first()

        if existing:
            return None # Already exists
            
        rec = models.OperationalRecommendation(
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            severity=severity,
            title=title,
            description=description,
            action_payload_json=json.dumps(action_payload) if action_payload else None
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        
        # Broadcast to Activity Feed if WARNING or CRITICAL
        if severity in ["WARNING", "CRITICAL"]:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(
                    ActivityEngine.log_and_broadcast(
                        db=db,
                        entity_type="INTELLIGENCE",
                        action="RECOMMENDATION_GENERATED",
                        description=title,
                        severity=severity,
                        metadata={"recommendation_id": str(rec.id)}
                    )
                )
            except RuntimeError:
                pass
                
        return rec

    # --- PHASE 1: PROCUREMENT INTELLIGENCE ---
    @staticmethod
    def evaluate_vendor_risk(db: Session, vendor_id: str):
        """Analyzes vendor delivery times vs defaults to detect risk."""
        # This would typically look at historical PO receipts.
        # For this prototype, we'll simulate a check:
        rec = IntelligenceEngine._create_recommendation(
            db=db,
            module="PROCUREMENT",
            entity_type="VENDOR",
            entity_id=vendor_id,
            severity="WARNING",
            title="Vendor Delivery Risk Detected",
            description="Vendor ABC has delayed 3 of their last 5 deliveries. Consider sourcing alternatives.",
            action_payload={"action": "FLAG_VENDOR", "vendor_id": vendor_id}
        )
        return rec

    # --- PHASE 2: INVENTORY INTELLIGENCE ---
    @staticmethod
    def detect_dead_stock(db: Session):
        """Scans for items with zero movement in the last 90 days."""
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)
        
        # Find ledgers with positive stock but no recent transactions
        stagnant_ledgers = db.query(models.InventoryLedger).filter(
            models.InventoryLedger.quantity_on_hand > 0,
            models.InventoryLedger.last_updated < ninety_days_ago
        ).limit(10).all()
        
        recs = []
        for ledger in stagnant_ledgers:
            rec = IntelligenceEngine._create_recommendation(
                db=db,
                module="INVENTORY",
                entity_type="ITEM",
                entity_id=str(ledger.item_id),
                severity="OPPORTUNITY",
                title="Dead Stock Detected",
                description=f"Item has {ledger.quantity_on_hand} units on hand with no movement in 90 days. Consider liquidation.",
                action_payload={"action": "CREATE_LIQUIDATION_WORKFLOW", "item_id": str(ledger.item_id)}
            )
            if rec: recs.append(rec)
        return recs

    # --- PHASE 3: FINANCE & RISK INTELLIGENCE ---
    @staticmethod
    def detect_invoice_anomalies(db: Session, invoice_data: Dict[str, Any], vendor_id: str):
        total_amount = invoice_data.get("total_amount", 0)
        invoice_date = invoice_data.get("invoice_date")
        
        if invoice_date:
            try:
                parsed_date = datetime.fromisoformat(invoice_date.replace("Z", "+00:00"))
                start_date = parsed_date - timedelta(days=7)
                end_date = parsed_date + timedelta(days=7)
                
                duplicates = db.query(models.Invoice).filter(
                    models.Invoice.vendor_id == vendor_id,
                    models.Invoice.total_amount == total_amount,
                    models.Invoice.invoice_date.between(start_date, end_date)
                ).all()
                
                if duplicates:
                    IntelligenceEngine._create_recommendation(
                        db=db,
                        module="FINANCE",
                        entity_type="INVOICE",
                        entity_id=None,
                        severity="CRITICAL",
                        title="Duplicate Invoice Pattern Detected",
                        description=f"Found {len(duplicates)} matching invoices in a 7-day window. High risk of duplicate payment.",
                        action_payload={"action": "BLOCK_PAYMENT", "vendor_id": vendor_id, "amount": float(total_amount)}
                    )
            except Exception as e:
                logger.error(f"Failed to parse date for invoice anomaly check: {e}")

    # --- PHASE 4: WORKFLOW INTELLIGENCE ---
    @staticmethod
    def detect_approval_bottlenecks(db: Session):
        """Finds workflows stuck at the same step for > 48 hours."""
        two_days_ago = datetime.utcnow() - timedelta(days=2)
        stuck_tasks = db.query(models.ApprovalTask).filter(
            models.ApprovalTask.status == "PENDING",
            models.ApprovalTask.created_at < two_days_ago
        ).limit(10).all()
        
        recs = []
        for task in stuck_tasks:
            rec = IntelligenceEngine._create_recommendation(
                db=db,
                module="WORKFLOW",
                entity_type="WORKFLOW_INSTANCE",
                entity_id=str(task.workflow_instance_id),
                severity="WARNING",
                title="SLA Breach Probability: High",
                description=f"Approval task assigned to {task.assigned_role} has been pending for over 48 hours.",
                action_payload={"action": "ESCALATE", "task_id": str(task.id)}
            )
            if rec: recs.append(rec)
        return recs


# =========================================================================
# Module-level OCR & Invoice Intelligence helpers
# Used by backend/tasks/ocr_tasks.py
# =========================================================================

def generate_mock_extraction(raw_text: str) -> Dict[str, Any]:
    """
    Parses raw OCR text and returns a structured extraction dict.
    In production this would call an LLM / structured extraction API.
    """
    import re
    invoice_number = "INV-" + re.sub(r"[^0-9]", "", raw_text)[:8] or "INV-UNKNOWN"
    po_number = "PO-" + re.sub(r"[^0-9]", "", raw_text)[-6:] or "PO-UNKNOWN"
    amount_match = re.search(r"\$?([\d,]+\.?\d*)", raw_text)
    total_amount = float(amount_match.group(1).replace(",", "")) if amount_match else 0.0

    return {
        "invoice_number": invoice_number,
        "po_number": po_number,
        "total_amount": total_amount,
        "invoice_date": datetime.utcnow().isoformat(),
        "vendor_name": "Unknown Vendor",
        "line_items": [],
    }


def calculate_confidence_score(
    extracted_data: Dict[str, Any],
    po: Any  # models.PurchaseOrder or mock
) -> Tuple[float, str]:
    """
    Calculates a confidence score for the extraction vs matched PO.
    Returns (confidence: float 0-1, recommendation: str).
    """
    score = 0.0
    if extracted_data.get("invoice_number"):
        score += 0.3
    if extracted_data.get("po_number"):
        score += 0.3
    if extracted_data.get("total_amount", 0) > 0:
        score += 0.4

    if score >= 0.9:
        recommendation = "AUTO_APPROVE"
    elif score >= 0.6:
        recommendation = "MANUAL_REVIEW"
    else:
        recommendation = "REJECT"

    return round(score, 2), recommendation


def detect_anomalies(
    db: Session,
    extracted_data: Dict[str, Any],
    vendor_id: str
) -> List[str]:
    """
    Detects anomalies in extracted invoice data.
    Returns a list of anomaly descriptions.
    """
    anomalies = []
    total = extracted_data.get("total_amount", 0)
    if total <= 0:
        anomalies.append("Invalid or zero total amount detected.")
    if not extracted_data.get("invoice_number"):
        anomalies.append("Missing invoice number.")
    if not extracted_data.get("po_number"):
        anomalies.append("No PO reference found in invoice.")
    return anomalies
