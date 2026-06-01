from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
import logging

from . import models, schemas, database, dependencies, document_template_engine

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
    responses={404: {"description": "Not found"}},
)

@router.get("/commercial-templates", response_model=List[schemas.CommercialTermsTemplateResponse])
def get_commercial_templates(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Fetch all commercial templates."""
    return db.query(models.CommercialTermsTemplate).all()

@router.post("/commercial-templates", response_model=schemas.CommercialTermsTemplateResponse)
def create_commercial_template(
    template_in: schemas.CommercialTermsTemplateCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Create a new commercial terms template."""
    template = models.CommercialTermsTemplate(**template_in.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.get("/preview/purchase-order/{po_id}")
def preview_purchase_order_document(
    po_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """
    Returns the HTML content of the print-ready Enterprise Purchase Order.
    This HTML can be rendered by the frontend and natively printed to PDF.
    """
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    html_content = document_template_engine.generate_po_html(db, po)
    
    return {"html": html_content}

@router.get("/vendor-profile/{vendor_id}", response_model=schemas.VendorCommercialProfileResponse)
def get_vendor_commercial_profile(
    vendor_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Fetch vendor commercial profile."""
    profile = db.query(models.VendorCommercialProfile).filter(models.VendorCommercialProfile.vendor_id == vendor_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Commercial profile not found for this vendor")
    return profile

@router.post("/vendor-profile", response_model=schemas.VendorCommercialProfileResponse)
def upsert_vendor_commercial_profile(
    profile_in: schemas.VendorCommercialProfileCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    """Create or update vendor commercial profile."""
    profile = db.query(models.VendorCommercialProfile).filter(models.VendorCommercialProfile.vendor_id == profile_in.vendor_id).first()
    if profile:
        for key, value in profile_in.model_dump(exclude_unset=True).items():
            setattr(profile, key, value)
    else:
        profile = models.VendorCommercialProfile(**profile_in.model_dump())
        db.add(profile)
        
    db.commit()
    db.refresh(profile)
    return profile
