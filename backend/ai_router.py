from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any

from .database import get_db
from .dependencies import get_current_user
from .services.ai_engine import AIEngine
from .models import User

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

class AIQueryRequest(BaseModel):
    query: str

@router.post("/query")
def submit_ai_query(
    request: AIQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit a natural language query to the AI Assistant.
    """
    if not request.query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    try:
        response = AIEngine.process_natural_language_query(request.query, db, current_user)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/executive-summary")
def get_executive_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch the AI-generated high-level executive summary for command centers.
    """
    try:
        return AIEngine.generate_executive_summary(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
