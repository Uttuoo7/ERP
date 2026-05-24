from backend.celery_app import celery_app
import logging
import hashlib
from ..database import SessionLocal
from .. import models, event_dispatcher
from ..services.pdf_generator import generate_purchase_order_pdf
from ..services.storage_service import upload_to_storage

logger = logging.getLogger(__name__)

@celery_app.task
def async_generate_document(document_type: str, reference_id: str, user_id: str):
    """
    Background worker that generates a PDF, uploads to S3, and saves metadata.
    """
    logger.info(f"Starting async document generation for {document_type} - {reference_id}")
    db = SessionLocal()
    try:
        # Generate the raw bytes
        if document_type == "PURCHASE_ORDER":
            pdf_bytes = generate_purchase_order_pdf(db, reference_id)
            file_name = f"PO_{reference_id[:8]}.pdf"
        else:
            raise ValueError(f"Unsupported document type: {document_type}")
            
        # Upload to Storage Vault (S3 simulation)
        s3_key = upload_to_storage(pdf_bytes, document_type, reference_id)
        
        # Calculate secure hash
        file_hash = hashlib.sha256(pdf_bytes).hexdigest()
        
        # Save to database
        doc = models.EnterpriseDocument(
            document_type=document_type,
            reference_id=reference_id,
            file_name=file_name,
            s3_key=s3_key,
            file_size_bytes=len(pdf_bytes),
            file_hash=file_hash,
            is_signed=True,
            created_by_id=user_id
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        # Dispatch WebSocket event to notify the frontend
        event_dispatcher.dispatch(
            "document_ready",
            {
                "document_id": str(doc.id),
                "document_type": document_type,
                "reference_id": reference_id,
                "message": f"{file_name} is ready for download."
            },
            db
        )
        
        logger.info(f"Successfully generated and stored document {doc.id}")
        
    except Exception as e:
        logger.error(f"Failed to generate document: {e}")
        db.rollback()
        event_dispatcher.dispatch(
            "document_failed",
            {
                "document_type": document_type,
                "reference_id": reference_id,
                "error": str(e)
            },
            db
        )
    finally:
        db.close()
