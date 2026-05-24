import uuid
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os

from . import models, database, dependencies
from .tasks.document_tasks import async_generate_document
from .services.storage_service import generate_presigned_url, STORAGE_BUCKET

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/generate/{document_type}/{reference_id}", status_code=status.HTTP_202_ACCEPTED)
def request_document_generation(
    document_type: str,
    reference_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Triggers an asynchronous Celery task to generate a branded PDF.
    """
    # Simple validation
    if document_type == "PURCHASE_ORDER":
        po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == reference_id).first()
        if not po:
            raise HTTPException(status_code=404, detail="Purchase Order not found")
    else:
        raise HTTPException(status_code=400, detail="Unsupported document type")
        
    # Dispatch to background
    async_generate_document.delay(document_type, str(reference_id), str(current_user.id))
    
    return {"message": "Document generation started. You will be notified when ready."}

@router.get("/{document_type}/{reference_id}/latest")
def get_latest_document(
    document_type: str,
    reference_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Returns metadata and a pre-signed URL for the latest generated version of this document.
    """
    doc = db.query(models.EnterpriseDocument).filter(
        models.EnterpriseDocument.document_type == document_type,
        models.EnterpriseDocument.reference_id == reference_id
    ).order_by(models.EnterpriseDocument.version.desc()).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="No documents generated yet.")
        
    # Generate S3 presigned URL
    presigned_url = generate_presigned_url(doc.s3_key, expiry_minutes=15)
    
    # Log Audit
    audit = models.DocumentAuditLog(
        document_id=doc.id,
        user_id=current_user.id,
        action="VIEWED",
        ip_address="127.0.0.1" # Mock
    )
    db.add(audit)
    db.commit()
    
    return {
        "id": str(doc.id),
        "file_name": doc.file_name,
        "version": doc.version,
        "is_signed": doc.is_signed,
        "created_at": doc.created_at,
        "download_url": presigned_url
    }

@router.get("/vault/{encoded_key}")
def download_from_vault(
    encoded_key: str,
    sig: str,
    expires: int
):
    """
    Mock S3 endpoint. In production, the user would download directly from AWS S3 using the presigned URL.
    This serves the file locally for simulation.
    """
    physical_path = os.path.join(STORAGE_BUCKET, encoded_key)
    if not os.path.exists(physical_path):
        raise HTTPException(status_code=404, detail="File no longer exists in vault.")
        
    return FileResponse(
        path=physical_path,
        media_type="application/pdf",
        filename=encoded_key.split('_')[-1] # Return the uuid.pdf part
    )
