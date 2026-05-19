from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from . import models, schemas, database, dependencies
import uuid
import os
import shutil
from typing import List

router = APIRouter()

UPLOAD_DIR = "uploads"

@router.post("/upload", response_model=schemas.AttachmentResponse)
def upload_attachment(
    source_type: str = Form(...),
    po_id: str = Form(None),
    so_id: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    if source_type not in ["PURCHASE_ORDER", "SALES_ORDER"]:
        raise HTTPException(status_code=400, detail="Invalid source_type")

    # Generate a unique physical filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # Save physical file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Save metadata to DB
    db_attachment = models.Attachment(
        file_name=file.filename,
        file_path=file_path,
        file_type=file.content_type,
        source_type=source_type,
        po_id=uuid.UUID(po_id) if po_id else None,
        so_id=uuid.UUID(so_id) if so_id else None
    )
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)

    return db_attachment

@router.get("/{source_type}/{id}", response_model=List[schemas.AttachmentResponse])
def get_attachments(source_type: str, id: uuid.UUID, db: Session = Depends(database.get_db)):
    if source_type == "PURCHASE_ORDER":
        attachments = db.query(models.Attachment).filter(models.Attachment.po_id == id).all()
    elif source_type == "SALES_ORDER":
        attachments = db.query(models.Attachment).filter(models.Attachment.so_id == id).all()
    else:
        raise HTTPException(status_code=400, detail="Invalid source_type")
    
    return attachments

@router.get("/download/{attachment_id}")
def download_attachment(attachment_id: uuid.UUID, db: Session = Depends(database.get_db)):
    attachment = db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    if not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="Physical file not found on disk")

    return FileResponse(
        path=attachment.file_path,
        filename=attachment.file_name,
        media_type=attachment.file_type
    )
