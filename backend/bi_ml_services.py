from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List
import json

def run_anomaly_scan(db: Session):
    """
    Placeholder for future ML pipeline (TensorFlow/Scikit-learn).
    Currently runs basic threshold checks to generate BusinessInsights.
    """
    # Example logic
    anomalies = []
    
    # Mock anomaly detection
    insight = models.BusinessInsight(
        module_name="INVENTORY",
        insight_type="ANOMALY",
        message="Abnormal stock consumption detected for RM-104 (Steel Sheets). Consumption rate 300% above 30-day moving average.",
        severity="WARNING",
        data_json=json.dumps({"item_code": "RM-104", "deviation_pct": 300})
    )
    db.add(insight)
    db.commit()
    return {"status": "scan_complete", "anomalies_detected": 1}

def get_insights(db: Session, module_name: str = None, skip: int = 0, limit: int = 50) -> List[models.BusinessInsight]:
    query = db.query(models.BusinessInsight).filter(models.BusinessInsight.is_active == True)
    if module_name:
        query = query.filter(models.BusinessInsight.module_name == module_name)
    return query.order_by(models.BusinessInsight.created_at.desc()).offset(skip).limit(limit).all()
