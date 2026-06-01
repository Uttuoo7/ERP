import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from .database import get_db
from .dependencies import get_current_user
from .models import OperationalRecommendation
from .services.intelligence_engine import IntelligenceEngine

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])

class RecommendationOut(BaseModel):
    id: str
    module: str
    entity_type: str
    severity: str
    title: str
    description: str
    action_payload: dict = None
    created_at: str

    class Config:
        from_attributes = True

@router.get("/recommendations")
def get_recommendations(
    module: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = db.query(OperationalRecommendation).filter(
        OperationalRecommendation.status == "ACTIVE"
    )
    
    if module:
        query = query.filter(OperationalRecommendation.module == module)
        
    recs = query.order_by(OperationalRecommendation.created_at.desc()).limit(50).all()
    
    results = []
    for r in recs:
        payload = None
        if r.action_payload_json:
            try:
                payload = json.loads(r.action_payload_json)
            except:
                pass
        
        results.append({
            "id": str(r.id),
            "module": r.module,
            "entity_type": r.entity_type,
            "severity": r.severity,
            "title": r.title,
            "description": r.description,
            "action_payload": payload,
            "created_at": r.created_at.isoformat()
        })
        
    return results

@router.post("/trigger-analysis")
def trigger_analysis(db: Session = Depends(get_db)):
    """Manually triggers background analysis for testing purposes."""
    IntelligenceEngine.detect_dead_stock(db)
    IntelligenceEngine.detect_approval_bottlenecks(db)
    return {"message": "Analysis triggered"}

@router.post("/recommendations/{rec_id}/resolve")
def resolve_recommendation(
    rec_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    rec = db.query(OperationalRecommendation).filter(OperationalRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    rec.status = "RESOLVED"
    db.commit()
    return {"message": "Recommendation resolved successfully"}
