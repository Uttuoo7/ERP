from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List

def create_bom(db: Session, bom_data: schemas.BOMCreate, user_id: uuid.UUID) -> models.BOM:
    bom = models.BOM(
        bom_number=f"BOM-{uuid.uuid4().hex[:6].upper()}",
        finished_good_item_id=bom_data.finished_good_item_id,
        version=bom_data.version,
        description=bom_data.description,
        labor_cost=bom_data.labor_cost,
        overhead_cost=bom_data.overhead_cost,
        created_by=user_id
    )
    db.add(bom)
    db.flush()
    
    total_material_cost = 0.0
    
    for li in bom_data.line_items:
        # Determine current cost of the raw material
        rm = db.query(models.Item).filter(models.Item.id == li.raw_material_item_id).first()
        unit_cost = rm.standard_cost if rm and rm.standard_cost else 0.0
        
        # Add wastage
        qty_with_wastage = li.required_qty * (1 + (li.wastage_percent / 100))
        total_cost = float(qty_with_wastage) * float(unit_cost)
        total_material_cost += total_cost
        
        line = models.BOMLineItem(
            bom_id=bom.id,
            raw_material_item_id=li.raw_material_item_id,
            required_qty=li.required_qty,
            wastage_percent=li.wastage_percent,
            unit_cost=unit_cost,
            total_cost=total_cost
        )
        db.add(line)
        
    bom.total_material_cost = total_material_cost
    bom.total_cost = total_material_cost + bom.labor_cost + bom.overhead_cost
    
    db.commit()
    db.refresh(bom)
    return bom

def get_boms(db: Session, skip: int = 0, limit: int = 100) -> List[models.BOM]:
    return db.query(models.BOM).order_by(models.BOM.created_at.desc()).offset(skip).limit(limit).all()

def approve_bom(db: Session, bom_id: uuid.UUID) -> models.BOM:
    bom = db.query(models.BOM).filter(models.BOM.id == bom_id).first()
    if not bom: raise ValueError("BOM not found")
    bom.approval_status = 'APPROVED'
    bom.status = 'ACTIVE'
    db.commit()
    db.refresh(bom)
    return bom
