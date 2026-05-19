from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schemas, database, dependencies
import uuid

router = APIRouter()

@router.post("/", response_model=schemas.VendorResponse)
def create_vendor(vendor: schemas.VendorCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.BUYER]))):
    db_vendor = models.Vendor(**vendor.model_dump())
    db.add(db_vendor)
    db.commit()
    db.refresh(db_vendor)
    return db_vendor

@router.get("/", response_model=List[schemas.VendorResponse])
def read_vendors(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    vendors = db.query(models.Vendor).offset(skip).limit(limit).all()
    return vendors

@router.get("/{vendor_id}", response_model=schemas.VendorResponse)
def read_vendor(vendor_id: uuid.UUID, db: Session = Depends(database.get_db)):
    db_vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if db_vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return db_vendor

@router.put("/{vendor_id}", response_model=schemas.VendorResponse)
def update_vendor(vendor_id: uuid.UUID, vendor: schemas.VendorUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.BUYER]))):
    with db.begin():
        db_vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
        if db_vendor is None:
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        for key, value in vendor.model_dump().items():
            setattr(db_vendor, key, value)
        
        db.refresh(db_vendor)
        return db_vendor

@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: uuid.UUID, db: Session = Depends(database.get_db)):
    db_vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if db_vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found")
    db.delete(db_vendor)
    db.commit()
    return {"ok": True}
