import re
import json
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from .. import models

logger = logging.getLogger(__name__)

class AIEngine:
    """
    Simulated Deterministic Semantic Engine for ERP AI Assistant.
    Parses natural language, maps to structured DB queries, and returns explainable narratives.
    Ensures ZERO hallucination by strictly using ORM query results.
    """

    @staticmethod
    def process_natural_language_query(query: str, db: Session, user: models.User) -> Dict[str, Any]:
        """
        Main entry point for AI Chat Assistant.
        """
        q = query.lower()
        
        # 1. Intent Recognition
        intent = "GENERAL"
        if any(word in q for word in ["vendor", "supplier", "risk", "risky"]):
            intent = "VENDOR_RISK"
        elif any(word in q for word in ["approval", "delayed", "stuck", "bottleneck", "overloaded"]):
            intent = "WORKFLOW_BOTTLENECK"
        elif any(word in q for word in ["stock", "inventory", "low", "empty"]):
            intent = "INVENTORY_HEALTH"
        elif any(word in q for word in ["invoice", "mismatch", "discrepancy"]):
            intent = "FINANCE_EXPOSURE"
            
        # 2. Execute Deterministic Query & Generate Narrative
        if intent == "VENDOR_RISK":
            return AIEngine._handle_vendor_risk(db)
        elif intent == "WORKFLOW_BOTTLENECK":
            return AIEngine._handle_workflow_bottleneck(db)
        elif intent == "INVENTORY_HEALTH":
            return AIEngine._handle_inventory_health(db)
        else:
            return {
                "narrative": "I am currently optimized for Procurement, Workflow, Inventory, and Finance queries. Please ask me about risky vendors, delayed approvals, or low stock.",
                "data_points": [],
                "confidence": 1.0,
                "sources": []
            }

    @staticmethod
    def _handle_vendor_risk(db: Session) -> Dict[str, Any]:
        # Query: Find vendors with CRITICAL recommendations or low delivery scores
        recs = db.query(models.OperationalRecommendation).filter(
            models.OperationalRecommendation.entity_type == "VENDOR",
            models.OperationalRecommendation.severity.in_(["WARNING", "CRITICAL"]),
            models.OperationalRecommendation.status == "ACTIVE"
        ).all()
        
        if not recs:
            return {
                "narrative": "All vendor metrics are currently within acceptable operational boundaries. No high-risk vendors detected.",
                "data_points": [],
                "confidence": 0.95,
                "sources": ["OperationalRecommendation Table"]
            }
            
        data_points = []
        for r in recs:
            # Try to fetch vendor name if entity_id is a valid UUID
            vendor_name = "Unknown Vendor"
            try:
                v = db.query(models.Vendor).filter(models.Vendor.id == r.entity_id).first()
                if v: vendor_name = v.name
            except:
                pass
            
            data_points.append({
                "entity": vendor_name,
                "metric": r.severity,
                "explanation": r.description
            })
            
        narrative = f"I found {len(recs)} vendors flagged with risk indicators. "
        for dp in data_points:
            narrative += f"{dp['entity']} is flagged as {dp['metric']} due to: '{dp['explanation']}'. "
            
        narrative += "I recommend reviewing their recent SLA performance in the Intelligence Hub."
        
        return {
            "narrative": narrative,
            "data_points": data_points,
            "confidence": 0.92,
            "sources": ["OperationalRecommendation", "Vendor Table"]
        }

    @staticmethod
    def _handle_workflow_bottleneck(db: Session) -> Dict[str, Any]:
        two_days_ago = datetime.utcnow() - timedelta(days=2)
        stuck_tasks = db.query(models.ApprovalTask).filter(
            models.ApprovalTask.status == "PENDING",
            models.ApprovalTask.created_at < two_days_ago
        ).all()
        
        if not stuck_tasks:
            return {
                "narrative": "No approval bottlenecks detected. All workflows are operating within SLA.",
                "data_points": [],
                "confidence": 0.98,
                "sources": ["ApprovalTask Table"]
            }
            
        # Group by role
        role_counts = {}
        for t in stuck_tasks:
            role_counts[t.assigned_role] = role_counts.get(t.assigned_role, 0) + 1
            
        narrative = f"There are {len(stuck_tasks)} approval tasks delayed beyond 48 hours. "
        for role, count in role_counts.items():
            narrative += f"The {role} role has {count} pending tasks causing bottlenecks. "
            
        narrative += "You can click 'Escalate' on these tasks to force movement."
        
        return {
            "narrative": narrative,
            "data_points": [{"role": k, "count": v} for k, v in role_counts.items()],
            "confidence": 0.94,
            "sources": ["ApprovalTask Table", "WorkflowEngine SLA Engine"]
        }

    @staticmethod
    def _handle_inventory_health(db: Session) -> Dict[str, Any]:
        # Items where on_hand <= reorder_point
        low_stock = db.query(models.InventoryLedger).filter(
            models.InventoryLedger.quantity_on_hand <= models.InventoryLedger.reorder_point
        ).limit(5).all()
        
        if not low_stock:
            return {
                "narrative": "Inventory health is optimal. No items are currently below their reorder points.",
                "data_points": [],
                "confidence": 0.99,
                "sources": ["InventoryLedger Table"]
            }
            
        narrative = f"I detected {len(low_stock)} items currently at or below their safety stock levels. "
        data_points = []
        for ledger in low_stock:
            item_name = ledger.item.name if ledger.item else "Unknown"
            narrative += f"{item_name} has {ledger.quantity_on_hand} units remaining (Reorder point: {ledger.reorder_point}). "
            data_points.append({
                "item": item_name,
                "on_hand": ledger.quantity_on_hand,
                "reorder_point": ledger.reorder_point
            })
            
        narrative += "Consider auto-generating Purchase Requisitions for these items."
        
        return {
            "narrative": narrative,
            "data_points": data_points,
            "confidence": 0.96,
            "sources": ["InventoryLedger Table", "Items Table"]
        }

    @staticmethod
    def generate_executive_summary(db: Session) -> Dict[str, Any]:
        """
        Generates the high-level summary for the Executive Command Center.
        Aggregates multiple domains into a cohesive, readable brief.
        """
        # 1. Procurement Health
        po_count = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.status == "DRAFT").count()
        # 2. Workflow Health
        stuck_tasks = db.query(models.ApprovalTask).filter(models.ApprovalTask.status == "PENDING").count()
        # 3. Anomaly count
        anomalies = db.query(models.OperationalRecommendation).filter(models.OperationalRecommendation.status == "ACTIVE").count()
        
        health_score = 100
        if stuck_tasks > 5: health_score -= 15
        if anomalies > 2: health_score -= 20
        
        status_text = "Optimal"
        if health_score < 70: status_text = "Needs Attention"
        if health_score < 50: status_text = "Critical"

        narrative = f"The overall ERP operational health is {status_text} (Score: {health_score}/100). "
        narrative += f"Currently, there are {po_count} Purchase Orders awaiting submission and {stuck_tasks} approval tasks pending across all departments. "
        if anomalies > 0:
            narrative += f"The Intelligence Engine has actively flagged {anomalies} operational anomalies requiring your review."
            
        return {
            "health_score": health_score,
            "status_text": status_text,
            "executive_narrative": narrative,
            "metrics": {
                "draft_pos": po_count,
                "pending_approvals": stuck_tasks,
                "active_anomalies": anomalies
            },
            "generated_at": datetime.utcnow().isoformat()
        }
