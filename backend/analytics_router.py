from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime
from . import models, schemas, database, dependencies

router = APIRouter()

def apply_date_filters(query, model, start_date: Optional[datetime], end_date: Optional[datetime]):
    if start_date:
        query = query.filter(model.order_date >= start_date)
    if end_date:
        query = query.filter(model.order_date <= end_date)
    return query

@router.get("/overview", response_model=schemas.AnalyticsResponse)
def get_overview(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.BUYER]))
):
    base_query = db.query(models.PurchaseOrder)
    base_query = apply_date_filters(base_query, models.PurchaseOrder, start_date, end_date)
    
    total_spend = base_query.with_entities(func.sum(models.PurchaseOrder.total_amount)).scalar() or 0
    total_pos = base_query.count()
    pending_pos = base_query.filter(models.PurchaseOrder.status == models.POStatus.DRAFT).count()
    approved_pos = base_query.filter(models.PurchaseOrder.status != models.POStatus.DRAFT).count()
    
    data = schemas.AnalyticsOverview(
        total_spend=total_spend,
        total_purchase_orders=total_pos,
        pending_purchase_orders=pending_pos,
        approved_purchase_orders=approved_pos
    )
    
    return {"data": [data.model_dump()], "meta": {"total_count": 1}}

@router.get("/vendor-performance", response_model=schemas.AnalyticsResponse)
def get_vendor_performance(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.BUYER]))
):
    performance_query = db.query(
        models.Vendor.name.label("vendor_name"),
        func.sum(models.PurchaseOrder.total_amount).label("total_spend"),
        func.count(models.PurchaseOrder.id).label("total_orders"),
        func.avg(models.PurchaseOrder.total_amount).label("average_order_value")
    ).join(models.PurchaseOrder, models.Vendor.id == models.PurchaseOrder.vendor_id)
    
    performance_query = apply_date_filters(performance_query, models.PurchaseOrder, start_date, end_date)
    
    performance = performance_query.group_by(models.Vendor.name)\
     .order_by(desc("total_spend"))\
     .all()
    
    data = [schemas.VendorPerformance(**row._asdict()) for row in performance]
    return {"data": data, "meta": {"total_count": len(data)}}

@router.get("/monthly-trends", response_model=schemas.AnalyticsResponse)
def get_monthly_trends(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.BUYER]))
):
    trend_query = db.query(
        func.to_char(models.PurchaseOrder.order_date, 'YYYY-MM').label("month"),
        func.sum(models.PurchaseOrder.total_amount).label("total_spend"),
        func.count(models.PurchaseOrder.id).label("total_orders")
    )
    
    trend_query = apply_date_filters(trend_query, models.PurchaseOrder, start_date, end_date)
    
    trends = trend_query.group_by("month")\
     .order_by("month")\
     .all()
    
    data = [schemas.MonthlyTrend(**row._asdict()) for row in trends]
    return {"data": data, "meta": {"total_count": len(data)}}

@router.get("/top-items", response_model=schemas.AnalyticsResponse)
def get_top_items(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.BUYER]))
):
    item_query = db.query(
        models.Item.name.label("item_name"),
        func.sum(models.POLineItem.quantity_ordered).label("total_quantity_purchased"),
        func.sum(models.POLineItem.quantity_ordered * models.POLineItem.unit_price).label("total_spend")
    ).join(models.POLineItem, models.Item.id == models.POLineItem.item_id)\
     .join(models.PurchaseOrder, models.POLineItem.po_id == models.PurchaseOrder.id)
    
    item_query = apply_date_filters(item_query, models.PurchaseOrder, start_date, end_date)
    
    items = item_query.group_by(models.Item.name)\
     .order_by(desc("total_spend"))\
     .limit(10)\
     .all()
    
    data = [schemas.TopItem(**row._asdict()) for row in items]
    return {"data": data, "meta": {"total_count": len(data)}}

@router.get("/po-status-distribution", response_model=schemas.AnalyticsResponse)
def get_po_status_distribution(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.require_role([models.Role.ADMIN, models.Role.BUYER]))
):
    # Status distribution usually shows the current global state, 
    # but we could add filters if requested. Keeping it as is per requirements.
    dist = db.query(
        models.PurchaseOrder.status.label("status"),
        func.count(models.PurchaseOrder.id).label("count")
    ).group_by(models.PurchaseOrder.status)\
     .all()
    
    data = [schemas.POStatusCount(status=row.status.value, count=row.count) for row in dist]
    return {"data": data, "meta": {"total_count": len(data)}}
