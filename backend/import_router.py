import os
import uuid
import json
import logging
import shutil
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from . import models, database, dependencies
from .services import import_engine

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads/imports"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_file(
    entity_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    """Upload an Excel/CSV file and parse headers."""
    if not (file.filename.endswith('.csv') or file.filename.endswith('.xlsx')):
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported.")
        
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Create batch
    batch = models.ImportBatch(
        entity_type=entity_type,
        filename=file.filename,
        status="PENDING"
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    headers = import_engine.parse_file_headers(file_path)
    
    return {
        "batch_id": batch.id,
        "filename": batch.filename,
        "headers": headers,
        "file_path": file_path # In production, store this in cache or DB temporarily
    }

@router.post("/validate")
def validate_mapping(
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    """Validate data against mapped columns."""
    batch_id = payload.get("batch_id")
    file_path = payload.get("file_path")
    mapping = payload.get("mapping") # { "FileHeader": "ERPField" }
    
    batch = db.query(models.ImportBatch).filter(models.ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    is_valid, errors = import_engine.validate_batch(db, batch, file_path, mapping)
    
    return {
        "is_valid": is_valid,
        "errors": errors[:100], # Preview first 100 errors
        "total_errors": len(errors)
    }

@router.post("/execute")
def execute_import(
    payload: Dict[str, Any],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    """Execute the import transaction."""
    batch_id = payload.get("batch_id")
    file_path = payload.get("file_path")
    mapping = payload.get("mapping")
    
    batch = db.query(models.ImportBatch).filter(models.ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    success = import_engine.execute_import(db, batch, file_path, mapping)
    
    return {
        "success": success,
        "status": batch.status,
        "success_rows": batch.success_rows,
        "failed_rows": batch.failed_rows
    }

@router.get("/history")
def get_import_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN]))
):
    """Get history of import batches."""
    return db.query(models.ImportBatch).order_by(desc(models.ImportBatch.created_at)).limit(50).all()
