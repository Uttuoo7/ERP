from sqlalchemy.orm import Session
from . import models, schemas
import uuid
from typing import List

def create_qc_inspection(db: Session, qc_data: schemas.QualityInspectionCreate, user_id: uuid.UUID) -> models.QualityInspection:
    qc = models.QualityInspection(
        inspection_number=f"QC-{uuid.uuid4().hex[:6].upper()}",
        inspector_id=user_id,
        **qc_data.model_dump()
    )
    db.add(qc)
    
    # Update PO rejected qty if any
    if qc_data.rejected_qty > 0:
        po = db.query(models.ProductionOrder).filter(models.ProductionOrder.id == qc_data.production_order_id).first()
        if po:
            po.rejected_qty += qc_data.rejected_qty
            # Depending on business logic, rejected qty might increase pending qty to re-manufacture
            po.pending_qty = float(po.production_qty) - float(po.completed_qty) - float(po.rejected_qty)
            
    # Set status
    if qc_data.rejected_qty > 0 and qc_data.accepted_qty == 0:
        qc.inspection_status = 'FAILED'
    elif qc_data.rejected_qty > 0 and qc_data.accepted_qty > 0:
        qc.inspection_status = 'REWORK'
    else:
        qc.inspection_status = 'PASSED'
        
    db.commit()
    db.refresh(qc)
    return qc
