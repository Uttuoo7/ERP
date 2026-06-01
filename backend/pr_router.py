import uuid
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import database, dependencies, models, schemas, event_dispatcher, workflow_engine, budget_engine, commitment_engine

router = APIRouter()

# -- Utility to calculate next auto-incrementing PR number --
def generate_next_pr_number(db: Session, category_id: Optional[uuid.UUID] = None) -> str:
    current_year = datetime.utcnow().year
    prefix_str = ""
    if category_id:
        cat = db.query(models.ProcurementCategory).filter(models.ProcurementCategory.id == category_id).first()
        if cat and cat.prefix:
            prefix_str = f"{cat.prefix}-"
            
    prefix = f"{prefix_str}PR-{current_year}-"
    
    # Fetch count of all PRs created in current year to generate incrementing index
    count = db.query(models.PurchaseRequisition)\
        .filter(models.PurchaseRequisition.pr_number.like(f"{prefix}%"))\
        .count()
        
    next_index = count + 1
    return f"{prefix}{next_index:04d}"

# -- Create and Read Requisitions --

@router.get("/", response_model=List[schemas.PurchaseRequisitionResponse])
def get_requisitions(
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    department_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    query = db.query(models.PurchaseRequisition)
    
    # Filter based on user role (requester can only view their own requests, admins/buyers/finance can view all)
    if current_user.role not in (models.Role.ADMIN, models.Role.BUYER, models.Role.FINANCE):
        query = query.filter(models.PurchaseRequisition.requester_id == current_user.id)
        
    if status_filter:
        query = query.filter(models.PurchaseRequisition.status == status_filter)
    if priority_filter:
        query = query.filter(models.PurchaseRequisition.priority == priority_filter)
    if department_id:
        query = query.filter(models.PurchaseRequisition.department_id == department_id)
    if search:
        query = query.filter(
            (models.PurchaseRequisition.pr_number.ilike(f"%{search}%")) |
            (models.PurchaseRequisition.remarks.ilike(f"%{search}%"))
        )
        
    return query.order_by(models.PurchaseRequisition.created_at.desc()).all()

@router.post("/", response_model=schemas.PurchaseRequisitionResponse, status_code=status.HTTP_201_CREATED)
def create_requisition(
    payload: schemas.PurchaseRequisitionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    pr_num = generate_next_pr_number(db, payload.category_id)
    
    db_pr = models.PurchaseRequisition(
        pr_number=pr_num,
        requester_id=current_user.id,
        department_id=payload.department_id,
        project_id=payload.project_id,
        cost_center_id=payload.cost_center_id,
        category_id=payload.category_id,
        priority=payload.priority,
        required_date=payload.required_date,
        delivery_location_id=payload.delivery_location_id,
        currency=payload.currency,
        remarks=payload.remarks,
        status="DRAFT"
    )
    db.add(db_pr)
    db.flush() # Resolve db_pr.id
    
    for item_data in payload.line_items:
        db_line = models.PurchaseRequisitionLine(
            pr_id=db_pr.id,
            item_id=item_data.item_id,
            description=item_data.description,
            quantity=item_data.quantity,
            uom=item_data.uom,
            estimated_price=item_data.estimated_price,
            suggested_vendor_id=item_data.suggested_vendor_id,
            required_date=item_data.required_date or payload.required_date,
            remarks=item_data.remarks,
            budget_code=item_data.budget_code,
            tax_category=item_data.tax_category
        )
        db.add(db_line)
        
    db.commit()
    db.refresh(db_pr)
    
    # Dispatch create event for Audit logger
    event_dispatcher.dispatch(
        "pr_created",
        {
            "pr_id": db_pr.id,
            "user_id": current_user.id,
            "action": "CREATED",
            "details": f"Created Purchase Requisition {pr_num} with {len(payload.line_items)} lines."
        },
        db
    )
    
    return db_pr

@router.get("/{pr_id}", response_model=schemas.PurchaseRequisitionResponse)
def get_requisition_by_id(
    pr_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    pr = db.query(models.PurchaseRequisition).filter(models.PurchaseRequisition.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Requisition not found")
        
    # Check permissions
    if current_user.role not in (models.Role.ADMIN, models.Role.BUYER, models.Role.FINANCE) and pr.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not have access to view this purchase requisition.")
        
    return pr

@router.put("/{pr_id}", response_model=schemas.PurchaseRequisitionResponse)
def update_requisition(
    pr_id: uuid.UUID,
    payload: schemas.PurchaseRequisitionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    pr = db.query(models.PurchaseRequisition).filter(models.PurchaseRequisition.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Requisition not found")
        
    if pr.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT requisitions can be edited.")
        
    # Check permissions
    if pr.requester_id != current_user.id and current_user.role != models.Role.ADMIN:
        raise HTTPException(status_code=403, detail="You do not have permissions to edit this requisition.")
        
    # Update Header
    pr.department_id = payload.department_id
    pr.project_id = payload.project_id
    pr.cost_center_id = payload.cost_center_id
    pr.category_id = payload.category_id
    pr.priority = payload.priority
    pr.required_date = payload.required_date
    pr.delivery_location_id = payload.delivery_location_id
    pr.currency = payload.currency
    pr.remarks = payload.remarks
    
    # Remove existing lines and re-insert updated ones
    db.query(models.PurchaseRequisitionLine).filter(models.PurchaseRequisitionLine.pr_id == pr_id).delete()
    
    for item_data in payload.line_items:
        db_line = models.PurchaseRequisitionLine(
            pr_id=pr_id,
            item_id=item_data.item_id,
            description=item_data.description,
            quantity=item_data.quantity,
            uom=item_data.uom,
            estimated_price=item_data.estimated_price,
            suggested_vendor_id=item_data.suggested_vendor_id,
            required_date=item_data.required_date or payload.required_date,
            remarks=item_data.remarks,
            budget_code=item_data.budget_code,
            tax_category=item_data.tax_category
        )
        db.add(db_line)
        
    db.commit()
    db.refresh(pr)
    
    # Audit log
    event_dispatcher.dispatch(
        "pr_updated",
        {
            "pr_id": pr.id,
            "user_id": current_user.id,
            "action": "UPDATED",
            "details": f"Updated requisition headers and line items."
        },
        db
    )
    
    return pr

# -- Action Triggers & Engine Workflow Integrations --

@router.post("/{pr_id}/submit", response_model=schemas.PurchaseRequisitionResponse)
def submit_requisition(
    pr_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    pr = db.query(models.PurchaseRequisition).filter(models.PurchaseRequisition.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Requisition not found")
        
    if pr.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Requisition is already submitted or actioned.")
        
    # Verify there is at least one line item
    if not pr.line_items:
        raise HTTPException(status_code=400, detail="Cannot submit a requisition without any line items.")
        
    # Calculate Total Amount for Workflow engine Context
    total_amount = sum(line.estimated_price * line.quantity for line in pr.line_items)
    
    # ---------------------------------------------------------
    # Budget Evaluation
    # ---------------------------------------------------------
    budget_context = {
        "department_id": pr.department_id,
        "project_id": pr.project_id,
        "cost_center_id": pr.cost_center_id,
        "category_id": pr.category_id,
        "branch_id": None
    }
    
    try:
        eval_result = budget_engine.evaluate_transaction(db, float(total_amount), budget_context)
        # If OK or WARNING, we record Planned Spend
        commitment_engine.transition_to_planned(db, float(total_amount), budget_context, "PR", pr.id)
    except budget_engine.BudgetExceededException as e:
        # We block standard workflow and possibly enter exception route,
        # but for PR, raising a 400 is common if no explicit workflow override exists.
        raise HTTPException(status_code=400, detail=str(e.message))

    # Update state
    pr.status = "PENDING_APPROVAL"
    db.commit()
    
    # Dispatch Submitted Event
    event_dispatcher.dispatch(
        "pr_submitted",
        {
            "pr_id": pr.id,
            "user_id": current_user.id,
            "action": "SUBMITTED",
            "details": f"Submitted for approval loop. Requisition Total: {pr.currency} {total_amount}"
        },
        db
    )
    
    # Trigger central dynamic Workflow engine!
    workflow_engine.initialize_workflow(
        module="PURCHASE_REQUISITION",
        entity_id=pr.id,
        context={
            "amount": float(total_amount),
            "department": pr.department.name if pr.department else "General",
            "project": pr.project.name if pr.project else "General",
            "category_id": pr.category_id
        },
        db=db
    )
    
    db.refresh(pr)
    return pr

@router.post("/{pr_id}/duplicate", response_model=schemas.PurchaseRequisitionResponse)
def duplicate_requisition(
    pr_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    source = db.query(models.PurchaseRequisition).filter(models.PurchaseRequisition.id == pr_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Requisition not found")
        
    pr_num = generate_next_pr_number(db, source.category_id)
    
    copy_pr = models.PurchaseRequisition(
        pr_number=pr_num,
        requester_id=current_user.id,
        department_id=source.department_id,
        project_id=source.project_id,
        cost_center_id=source.cost_center_id,
        category_id=source.category_id,
        priority=source.priority,
        required_date=source.required_date,
        delivery_location_id=source.delivery_location_id,
        currency=source.currency,
        remarks=f"Copied from {source.pr_number}. " + (source.remarks or ""),
        status="DRAFT"
    )
    db.add(copy_pr)
    db.flush()
    
    for line in source.line_items:
        copy_line = models.PurchaseRequisitionLine(
            pr_id=copy_pr.id,
            item_id=line.item_id,
            description=line.description,
            quantity=line.quantity,
            uom=line.uom,
            estimated_price=line.estimated_price,
            suggested_vendor_id=line.suggested_vendor_id,
            required_date=line.required_date,
            remarks=line.remarks,
            budget_code=line.budget_code,
            tax_category=line.tax_category
        )
        db.add(copy_line)
        
    db.commit()
    db.refresh(copy_pr)
    
    # Audit log
    event_dispatcher.dispatch(
        "pr_created",
        {
            "pr_id": copy_pr.id,
            "user_id": current_user.id,
            "action": "DUPLICATED",
            "details": f"Duplicated from source Requisition {source.pr_number}."
        },
        db
    )
    
    return copy_pr

# -- Comments Threads --

@router.post("/{pr_id}/comments", response_model=schemas.PurchaseRequisitionCommentResponse)
def add_pr_comment(
    pr_id: uuid.UUID,
    payload: schemas.PurchaseRequisitionCommentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    pr = db.query(models.PurchaseRequisition).filter(models.PurchaseRequisition.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Requisition not found")
        
    comment = models.PurchaseRequisitionComment(
        pr_id=pr_id,
        user_id=current_user.id,
        comment=payload.comment
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
