from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
import uuid
from typing import List

def run_mrp_engine(db: Session) -> List[models.MRPRecommendation]:
    # 1. Clear old pending recommendations
    db.query(models.MRPRecommendation).filter(models.MRPRecommendation.status == 'PENDING').delete()
    
    # 2. Get all ACTIVE BOMs
    active_boms = db.query(models.BOM).filter(models.BOM.status == 'ACTIVE').all()
    
    # 3. For this simplified MRP, we'll look at all planned production orders that haven't started
    planned_pos = db.query(models.ProductionOrder).filter(models.ProductionOrder.production_status == 'PLANNED').all()
    
    material_requirements = {}
    
    for po in planned_pos:
        # Get BOM
        bom = db.query(models.BOM).filter(models.BOM.id == po.bom_id).first()
        if not bom: continue
        
        for li in bom.line_items:
            qty_needed = float(li.required_qty) * float(po.production_qty) * (1 + (float(li.wastage_percent) / 100))
            if li.raw_material_item_id not in material_requirements:
                material_requirements[li.raw_material_item_id] = 0.0
            material_requirements[li.raw_material_item_id] += qty_needed
            
    recommendations = []
    
    # 4. Check available stock against requirements
    for item_id, req_qty in material_requirements.items():
        # Get total available stock across all warehouses
        stock_sum = db.query(func.sum(models.InventoryStock.available_stock)).filter(models.InventoryStock.item_id == item_id).scalar()
        available = float(stock_sum) if stock_sum else 0.0
        
        if available < req_qty:
            shortage = req_qty - available
            rec = models.MRPRecommendation(
                item_id=item_id,
                required_qty=req_qty,
                available_qty=available,
                shortage_qty=shortage,
                recommended_procurement_qty=shortage, # Can apply reorder multiples here
                recommendation_type='PURCHASE', # Assuming purchase, could check if item is manufactured
                status='PENDING'
            )
            db.add(rec)
            recommendations.append(rec)
            
    db.commit()
    return recommendations

def get_mrp_recommendations(db: Session, skip: int = 0, limit: int = 100) -> List[models.MRPRecommendation]:
    return db.query(models.MRPRecommendation).order_by(models.MRPRecommendation.created_at.desc()).offset(skip).limit(limit).all()
