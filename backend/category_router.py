from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from . import database, schemas, models
from .dependencies import get_tenant_id

router = APIRouter(prefix="/api/procurement-categories", tags=["Procurement Categories"])

@router.get("/", response_model=List[schemas.ProcurementCategoryResponse])
def get_categories(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(database.get_db),
    tenant_id: str = Depends(get_tenant_id)
):
    categories = db.query(models.ProcurementCategory).offset(skip).limit(limit).all()
    return categories

@router.post("/", response_model=schemas.ProcurementCategoryResponse)
def create_category(
    category: schemas.ProcurementCategoryCreate,
    db: Session = Depends(database.get_db),
    tenant_id: str = Depends(get_tenant_id)
):
    # Check if category code already exists
    existing = db.query(models.ProcurementCategory).filter(models.ProcurementCategory.code == category.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category code already exists")
        
    db_category = models.ProcurementCategory(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@router.get("/{category_id}", response_model=schemas.ProcurementCategoryResponse)
def get_category(
    category_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    tenant_id: str = Depends(get_tenant_id)
):
    category = db.query(models.ProcurementCategory).filter(models.ProcurementCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@router.put("/{category_id}", response_model=schemas.ProcurementCategoryResponse)
def update_category(
    category_id: uuid.UUID,
    category: schemas.ProcurementCategoryUpdate,
    db: Session = Depends(database.get_db),
    tenant_id: str = Depends(get_tenant_id)
):
    db_category = db.query(models.ProcurementCategory).filter(models.ProcurementCategory.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    for key, value in category.model_dump(exclude_unset=True).items():
        setattr(db_category, key, value)
        
    db.commit()
    db.refresh(db_category)
    return db_category

@router.delete("/{category_id}")
def delete_category(
    category_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    tenant_id: str = Depends(get_tenant_id)
):
    db_category = db.query(models.ProcurementCategory).filter(models.ProcurementCategory.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    db_category.is_active = False # Soft delete
    db.commit()
    return {"message": "Category deactivated successfully"}
