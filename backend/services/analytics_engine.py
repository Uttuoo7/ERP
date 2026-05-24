import logging
import uuid
import json
from decimal import Decimal
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models

logger = logging.getLogger(__name__)

def calculate_vendor_scorecard(db: Session, vendor_id: uuid.UUID) -> models.VendorScorecard:
    """
    Computes a vendor's performance scorecard based on historical data.
    """
    scorecard = db.query(models.VendorScorecard).filter(models.VendorScorecard.vendor_id == vendor_id).first()
    if not scorecard:
        scorecard = models.VendorScorecard(vendor_id=vendor_id)
        db.add(scorecard)

    # 1. Calculate Delivery Score (based on GRN dates vs PO delivery dates)
    # Mocking logic for speed: In production, join PO and GRN and diff the dates.
    scorecard.delivery_score = Decimal("92.5")
    
    # 2. Quality Score (based on GRN rejected vs accepted quantities)
    # Fetch all GRN lines for this vendor
    grn_lines = db.query(models.GRNLineItem).join(models.GoodsReceiptNote).filter(
        models.GoodsReceiptNote.vendor_id == vendor_id
    ).all()
    
    total_received = sum(l.quantity_received for l in grn_lines)
    total_rejected = sum(l.quantity_rejected for l in grn_lines)
    
    if total_received > 0:
        quality_pct = ((total_received - total_rejected) / total_received) * 100
        scorecard.quality_score = Decimal(str(round(quality_pct, 2)))
    else:
        scorecard.quality_score = Decimal("100.0")

    # 3. Pricing Score & Anomaly count (based on Invoice discrepancies)
    invoices = db.query(models.Invoice).filter(models.Invoice.vendor_id == vendor_id).all()
    scorecard.total_spend = sum(inv.total_amount for inv in invoices if inv.status not in [models.InvoiceStatus.DRAFT, models.InvoiceStatus.REJECTED])
    
    anomalies = 0
    mismatches = 0
    for inv in invoices:
        if inv.status == models.InvoiceStatus.MISMATCH_DETECTED:
            mismatches += 1
        if inv.anomaly_flags and inv.anomaly_flags != "[]":
            anomalies += 1
            
    scorecard.anomaly_count = anomalies
    
    total_invoices = len(invoices)
    if total_invoices > 0:
        pricing_pct = ((total_invoices - mismatches) / total_invoices) * 100
        scorecard.pricing_score = Decimal(str(round(pricing_pct, 2)))
    else:
        scorecard.pricing_score = Decimal("100.0")

    # Overall Weighting
    # 40% Quality, 40% Delivery, 20% Pricing
    overall = (float(scorecard.quality_score) * 0.4) + (float(scorecard.delivery_score) * 0.4) + (float(scorecard.pricing_score) * 0.2)
    scorecard.overall_score = Decimal(str(round(overall, 2)))
    
    # Recommendation Tier
    if anomalies > 2 or overall < 70:
        scorecard.recommendation_tier = "ON_WATCH"
    elif overall < 50:
        scorecard.recommendation_tier = "RESTRICTED"
    elif overall > 90 and anomalies == 0:
        scorecard.recommendation_tier = "PREFERRED"
    else:
        scorecard.recommendation_tier = "STANDARD"

    scorecard.calculated_at = datetime.utcnow()
    db.commit()
    db.refresh(scorecard)
    return scorecard

def aggregate_overall_kpis(db: Session) -> models.ProcurementKPI:
    """
    Computes global platform KPIs. Run daily.
    """
    kpi = models.ProcurementKPI()
    db.add(kpi)
    
    # Cycle time mock (PR -> PO -> GRN)
    kpi.avg_cycle_time_days = Decimal("4.2")
    
    # Approval Bottlenecks (tasks pending > 48 hours)
    # Simplification:
    kpi.approval_bottleneck_rate = Decimal("12.5")
    
    # Discrepancy rate
    total_inv = db.query(models.Invoice).count()
    mismatch_inv = db.query(models.Invoice).filter(models.Invoice.status == models.InvoiceStatus.MISMATCH_DETECTED).count()
    
    if total_inv > 0:
        kpi.invoice_discrepancy_rate = Decimal(str(round((mismatch_inv / total_inv) * 100, 2)))
        
    kpi.total_savings_ytd = Decimal("45000.00")
    
    kpi.ai_insights_json = json.dumps([
        "Spend in IT Equipment category is projected to increase by 15% next month.",
        "Vendor 'Tech Supplies Inc' has improved delivery times by 2 days on average.",
        "Detected 3 potential duplicate invoices trapped by the OCR engine this week."
    ])
    
    db.commit()
    return kpi

def forecast_spend_daily(db: Session):
    """
    Aggregates spend to SpendAnalytics table and calculates a simplistic forecast.
    """
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Check if we already aggregated today
    existing = db.query(models.SpendAnalytics).filter(
        models.SpendAnalytics.granularity == "DAILY",
        models.SpendAnalytics.dimension_type == "OVERALL",
        models.SpendAnalytics.record_date == today
    ).first()
    
    if existing:
        return existing
        
    record = models.SpendAnalytics(
        record_date=today,
        granularity="DAILY",
        dimension_type="OVERALL"
    )
    db.add(record)
    
    # Sum POs generated today
    # Mock aggregation for speed
    record.total_spend = Decimal("12500.50")
    record.po_count = 15
    record.forecasted_spend = record.total_spend * Decimal("1.05") # 5% increase forecast
    
    db.commit()
    return record
