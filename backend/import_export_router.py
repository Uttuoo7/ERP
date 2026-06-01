from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import uuid

from . import models, schemas, database, dependencies, import_export_service, template_generator

router = APIRouter(
    prefix="/bulk",
    tags=["Import/Export & Data Management"],
    responses={404: {"description": "Not found"}},
)

@router.get("/templates/{module}")
def download_template(
    module: str,
    current_user: models.User = Depends(dependencies.get_current_user)
):
    valid_modules = ["vendors", "items", "warehouses", "boms"]
    if module not in valid_modules:
        raise HTTPException(status_code=400, detail="Invalid module template requested.")
        
    excel_bytes = template_generator.generate_excel_template(module)
    
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={module}_template.xlsx"}
    )

@router.post("/import/preview/{module}")
async def preview_import(
    module: str,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        contents = await file.read()
        preview_result = import_export_service.preview_import(db, module, contents, file.filename)
        return preview_result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to preview file: {str(e)}")

@router.post("/import/commit/{module}", response_model=schemas.ImportHistoryResponse)
def commit_import(
    module: str,
    validated_data: List[Dict[str, Any]],
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        history = import_export_service.commit_import(db, module, validated_data, current_user.id)
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Commit failed: {str(e)}")

@router.get("/history", response_model=List[schemas.ImportHistoryResponse])
def get_import_history(
    skip: int = 0, limit: int = 50,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.ImportHistory).order_by(models.ImportHistory.uploaded_at.desc()).offset(skip).limit(limit).all()
