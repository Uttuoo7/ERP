from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from decimal import Decimal
from datetime import datetime

from . import models, schemas, database, dependencies
from backend import manufacturing_engine
from backend.manufacturing_accounting_service import ManufacturingAccountingService
from backend.shop_floor_service import ShopFloorService
from backend.manufacturing_reporting_service import ManufacturingReportingService

router = APIRouter(
    prefix="/mfg/production",
    tags=["Manufacturing Production"],
    responses={404: {"description": "Not found"}},
)

# =========================================================================
# WORK CENTER APIS
# =========================================================================

@router.post("/work-centers", response_model=schemas.WorkCenterResponse)
def create_work_center(
    wc: schemas.WorkCenterCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    wc_record = models.WorkCenter(
        id=uuid.uuid4(),
        code=wc.code,
        name=wc.name,
        capacity_per_day=wc.capacity_per_day,
        cost_per_hour=wc.cost_per_hour,
        available_hours_per_day=wc.available_hours_per_day,
        efficiency_percent=wc.efficiency_percent,
        utilization_percent=wc.utilization_percent,
        status="ACTIVE"
    )
    db.add(wc_record)
    db.commit()
    db.refresh(wc_record)
    return wc_record

@router.get("/work-centers", response_model=List[schemas.WorkCenterResponse])
def get_work_centers(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.WorkCenter).filter(models.WorkCenter.is_deleted == False).all()

@router.post("/work-centers/{wc_id}/calendar", response_model=schemas.WorkCenterCalendarResponse)
def create_calendar_event(
    wc_id: uuid.UUID,
    event: schemas.WorkCenterCalendarCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    wc = db.query(models.WorkCenter).filter_by(id=wc_id).first()
    if not wc:
        raise HTTPException(status_code=404, detail="Work center not found")
        
    cal = models.WorkCenterCalendar(
        id=uuid.uuid4(),
        work_center_id=wc_id,
        event_date=event.event_date,
        event_type=event.event_type,
        hours_blocked=event.hours_blocked,
        description=event.description
    )
    db.add(cal)
    db.commit()
    db.refresh(cal)
    return cal


# =========================================================================
# ROUTING APIS
# =========================================================================

@router.post("/routings", response_model=schemas.RoutingResponse)
def create_routing(
    r: schemas.RoutingCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    routing = models.Routing(
        id=uuid.uuid4(),
        item_id=r.item_id,
        revision=r.revision,
        status="ACTIVE"
    )
    db.add(routing)
    db.flush()
    
    for op in r.operations:
        operation = models.RoutingOperation(
            id=uuid.uuid4(),
            routing_id=routing.id,
            sequence_no=op.sequence_no,
            work_center_id=op.work_center_id,
            operation_name=op.operation_name,
            setup_time_minutes=op.setup_time_minutes,
            run_time_minutes=op.run_time_minutes
        )
        db.add(operation)
        
    db.commit()
    db.refresh(routing)
    return routing

@router.get("/routings", response_model=List[schemas.RoutingResponse])
def get_routings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.Routing).filter(models.Routing.is_deleted == False).all()


# =========================================================================
# WORK ORDER APIS
# =========================================================================

@router.post("/work-orders", response_model=schemas.WorkOrderResponse)
def create_work_order(
    wo: schemas.WorkOrderNewCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        wo_record = manufacturing_engine.create_work_order(
            db=db,
            item_id=wo.item_id,
            quantity=wo.quantity,
            planned_start_date=wo.planned_start_date,
            planned_end_date=wo.planned_end_date,
            mrp_plan_id=wo.mrp_plan_id,
            tenant_id=current_user.tenant_id
        )
        db.commit()
        db.refresh(wo_record)
        return wo_record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/work-orders", response_model=List[schemas.WorkOrderResponse])
def get_work_orders(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.WorkOrder).filter(models.WorkOrder.is_deleted == False).all()

@router.get("/work-orders/{wo_id}", response_model=schemas.WorkOrderResponse)
def get_work_order(
    wo_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    wo = db.query(models.WorkOrder).filter_by(id=wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return wo

@router.put("/work-orders/{wo_id}/release", response_model=schemas.WorkOrderResponse)
def release_work_order(
    wo_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        wo_record = manufacturing_engine.release_work_order(db, wo_id)
        db.commit()
        db.refresh(wo_record)
        return wo_record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/work-orders/{wo_id}/allocate", response_model=schemas.WorkOrderResponse)
def allocate_materials(
    wo_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        wo_record = manufacturing_engine.allocate_materials(db, wo_id, warehouse_id)
        db.commit()
        db.refresh(wo_record)
        return wo_record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/work-orders/{wo_id}/start", response_model=schemas.WorkOrderResponse)
def start_work_order(
    wo_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        wo_record = manufacturing_engine.start_work_order(db, wo_id)
        db.commit()
        db.refresh(wo_record)
        return wo_record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/work-orders/{wo_id}/operations/{op_id}/start", response_model=schemas.WorkOrderOperationResponse)
def start_operation(
    wo_id: uuid.UUID,
    op_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        woo = ShopFloorService.start_operation(db, wo_id, op_id)
        db.commit()
        db.refresh(woo)
        return woo
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/work-orders/{wo_id}/operations/{op_id}/complete", response_model=schemas.WorkOrderOperationResponse)
def complete_operation(
    wo_id: uuid.UUID,
    op_id: uuid.UUID,
    actual_setup_minutes: int,
    actual_run_minutes: int,
    scrap_qty: Decimal = Decimal('0.0000'),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        woo = ShopFloorService.complete_operation(
            db=db,
            work_order_id=wo_id,
            operation_id=op_id,
            actual_setup_minutes=actual_setup_minutes,
            actual_run_minutes=actual_run_minutes,
            scrap_qty=scrap_qty,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id
        )
        db.commit()
        db.refresh(woo)
        return woo
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/work-orders/{wo_id}/qc-inspection", response_model=schemas.QualityInspectionResponse)
def create_qc_inspection(
    wo_id: uuid.UUID,
    inspect: schemas.QualityInspectionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        # Move Work Order status to QC_PENDING
        manufacturing_engine.request_qc_inspection(db, wo_id)
        
        # Create QC Inspection record
        inspection = models.QualityInspection(
            id=uuid.uuid4(),
            inspection_number=inspect.inspection_number,
            work_order_id=wo_id,
            item_id=inspect.item_id,
            batch_id=inspect.batch_id,
            inspected_qty=inspect.inspected_qty,
            accepted_qty=inspect.accepted_qty,
            rejected_qty=inspect.rejected_qty,
            rejection_reason=inspect.rejection_reason,
            inspector_id=current_user.id,
            inspection_status=inspect.status, # PENDING, PASSED, FAILED, REWORK
            disposition=inspect.disposition,
            remarks=inspect.remarks
        )
        db.add(inspection)
        db.flush()
        
        for res in inspect.results:
            result = models.QualityInspectionResult(
                id=uuid.uuid4(),
                inspection_id=inspection.id,
                parameter_name=res.parameter_name,
                expected_value=res.expected_value,
                actual_value=res.actual_value,
                status=res.status
            )
            db.add(result)
            
        # If inspection is FAILED or REWORK, perform related accounting variance or rework moves immediately
        if inspect.status == 'FAILED':
            # Post failed scrap disposition
            unit_cost = Decimal('10.00')
            ManufacturingAccountingService.post_scrap_variance(
                db=db,
                work_order_id=wo_id,
                quantity=Decimal(str(inspect.rejected_qty)),
                unit_cost=unit_cost,
                tenant_id=current_user.tenant_id
            )
        elif inspect.status == 'REWORK':
            # Post rework inventory move
            unit_cost = Decimal('10.00')
            ManufacturingAccountingService.post_rework_posting(
                db=db,
                work_order_id=wo_id,
                quantity=Decimal(str(inspect.inspected_qty)),
                unit_cost=unit_cost,
                tenant_id=current_user.tenant_id
            )

        db.commit()
        db.refresh(inspection)
        return inspection
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/work-orders/{wo_id}/complete", response_model=schemas.WorkOrderResponse)
def complete_work_order(
    wo_id: uuid.UUID,
    completed_qty: Decimal,
    warehouse_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        wo = db.query(models.WorkOrder).filter_by(id=wo_id).first()
        if not wo:
            raise HTTPException(status_code=404, detail="Work order not found")
            
        # Verify QC Inspection PASSED
        qc = db.query(models.QualityInspection).filter_by(work_order_id=wo_id).order_by(models.QualityInspection.created_at.desc()).first()
        if not qc or qc.inspection_status != 'PASSED':
            raise HTTPException(status_code=400, detail="Cannot receive finished goods: Quality inspection has not PASSED")
            
        # Perform finished goods receipt posting (actual costing)
        unit_cost = Decimal('50.00') # Rollup estimate
        ManufacturingAccountingService.post_finished_goods_receipt(
            db=db,
            work_order_id=wo_id,
            warehouse_id=warehouse_id,
            quantity=completed_qty,
            unit_cost=unit_cost,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id
        )
        
        # Transition status to COMPLETED
        wo.status = 'COMPLETED'
        wo.actual_end_date = datetime.utcnow()
        
        # Create lot/batch traceability
        batch_num = f"BAT-{uuid.uuid4().hex[:6].upper()}"
        batch = models.ManufacturingBatch(
            id=uuid.uuid4(),
            finished_good_batch_number=batch_num,
            item_id=wo.item_id,
            work_order_id=wo.id,
            produced_qty=completed_qty,
            yield_percent=Decimal('100.00')
        )
        db.add(batch)
        
        db.commit()
        db.refresh(wo)
        return wo
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/work-orders/{wo_id}/close", response_model=schemas.WorkOrderResponse)
def close_work_order(
    wo_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        wo = db.query(models.WorkOrder).filter_by(id=wo_id).first()
        if not wo:
            raise HTTPException(status_code=404, detail="Work order not found")
            
        if wo.status != 'COMPLETED':
            raise HTTPException(status_code=400, detail="Only COMPLETED work orders can be closed")
            
        # Enforce close controls
        # Post cost variance entries
        ManufacturingAccountingService.post_variance_accounting(db, wo_id, current_user.tenant_id)
        
        wo.status = 'CLOSED'
        db.commit()
        db.refresh(wo)
        return wo
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/work-orders/{wo_id}/cancel", response_model=schemas.WorkOrderResponse)
def cancel_work_order(
    wo_id: uuid.UUID,
    warehouse_id: Optional[uuid.UUID] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        wo_record = manufacturing_engine.cancel_work_order(db, wo_id, warehouse_id)
        db.commit()
        db.refresh(wo_record)
        return wo_record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =========================================================================
# REPORTS & CONTROLS APIS
# =========================================================================

@router.get("/wip-valuation")
def get_wip_valuation(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return ManufacturingReportingService.get_wip_valuation_report(db, current_user.tenant_id)

@router.get("/work-orders/{wo_id}/variance")
def get_production_variance(
    wo_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return ManufacturingReportingService.get_production_variance_report(db, wo_id, current_user.tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/boms/{bom_id}/cost-rollup")
def get_bom_cost_rollup(
    bom_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        return ManufacturingReportingService.get_bom_cost_explosion(db, bom_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/period-close")
def close_manufacturing_period(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    try:
        ManufacturingAccountingService.validate_manufacturing_period_close(db, current_user.tenant_id)
        return {"status": "SUCCESS", "message": "Manufacturing period closed successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Phase 15 Advanced Planning & Capacity Scheduling (APS) APIS

@router.post("/capacity/plan", response_model=schemas.CapacityPlanResponse)
def create_capacity_plan(
    plan_data: schemas.CapacityPlanCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend import advanced_planning_engine
    try:
        plan = advanced_planning_engine.generate_capacity_plan(
            db=db,
            plan_number=plan_data.plan_number,
            planning_start_date=plan_data.planning_start_date,
            planning_end_date=plan_data.planning_end_date,
            scheduling_mode=plan_data.scheduling_mode,
            generated_by_id=current_user.id,
            schedule_freeze_date=plan_data.schedule_freeze_date,
            tenant_id=current_user.tenant_id
        )
        db.commit()
        db.refresh(plan)
        return plan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/capacity/plan/{plan_id}/run", response_model=schemas.CapacityPlanResponse)
def run_capacity_scheduling(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend import advanced_planning_engine
    try:
        plan = advanced_planning_engine.schedule_work_orders(db, plan_id)
        db.commit()
        db.refresh(plan)
        # Automatically release planning lock when done
        advanced_planning_engine.release_lock(db, current_user.tenant_id)
        return plan
    except ValueError as e:
        advanced_planning_engine.release_lock(db, current_user.tenant_id)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as ex:
        advanced_planning_engine.release_lock(db, current_user.tenant_id)
        raise HTTPException(status_code=500, detail=str(ex))

@router.post("/capacity/plan/{plan_id}/rebalance")
def run_capacity_rebalance(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend import advanced_planning_engine
    try:
        reassigned_count = advanced_planning_engine.rebalance_schedule(db, plan_id)
        db.commit()
        return {"status": "SUCCESS", "reassigned_count": reassigned_count}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/capacity/plan/{plan_id}/reschedule-overloads")
def run_reschedule_overloads(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend import advanced_planning_engine
    try:
        shifted_count = advanced_planning_engine.reschedule_overloads(db, plan_id)
        db.commit()
        return {"status": "SUCCESS", "shifted_count": shifted_count}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/capacity/alternates", response_model=schemas.WorkCenterAlternateResponse)
def create_work_center_alternate(
    alt_data: schemas.WorkCenterAlternateCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    alt = models.WorkCenterAlternate(
        id=uuid.uuid4(),
        primary_work_center_id=alt_data.primary_work_center_id,
        alternate_work_center_id=alt_data.alternate_work_center_id,
        priority=alt_data.priority,
        tenant_id=current_user.tenant_id
    )
    db.add(alt)
    db.commit()
    db.refresh(alt)
    return alt

@router.get("/capacity/plan/{plan_id}/bottlenecks")
def get_plan_bottlenecks(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend import advanced_planning_engine
    return advanced_planning_engine.identify_bottlenecks(db, plan_id)

@router.get("/capacity/plan/{plan_id}/kpis")
def get_plan_kpis(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend.load_balancing_service import LoadBalancingService
    return LoadBalancingService.get_kpis(db, plan_id)

@router.post("/capacity/plan/{plan_id}/simulate-overtime")
def simulate_plan_overtime(
    plan_id: uuid.UUID,
    max_overtime: float = 4.0,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend.load_balancing_service import LoadBalancingService
    recs = LoadBalancingService.simulate_overtime(db, plan_id, max_overtime)
    db.commit()
    return recs

@router.get("/capacity/plan/{plan_id}/reports/utilization")
def get_utilization_report(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend.capacity_reporting_service import CapacityReportingService
    return CapacityReportingService.get_capacity_utilization_report(db, plan_id)

@router.get("/capacity/plan/{plan_id}/reports/adherence")
def get_adherence_report(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend.capacity_reporting_service import CapacityReportingService
    return CapacityReportingService.get_schedule_adherence_report(db, plan_id)

@router.get("/capacity/plan/{plan_id}/reports/throughput")
def get_throughput_forecast(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    from backend.capacity_reporting_service import CapacityReportingService
    return CapacityReportingService.get_throughput_forecast(db, plan_id)


@router.get("/capacity/plans", response_model=List[schemas.CapacityPlanResponse])
def list_capacity_plans(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.CapacityPlan).filter(
        models.CapacityPlan.tenant_id == current_user.tenant_id,
        models.CapacityPlan.is_deleted == False
    ).order_by(models.CapacityPlan.generated_at.desc()).all()


@router.get("/capacity/plan/{plan_id}/requirements", response_model=List[schemas.CapacityRequirementResponse])
def get_plan_requirements(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.CapacityRequirement).filter(
        models.CapacityRequirement.capacity_plan_id == plan_id,
        models.CapacityRequirement.is_deleted == False
    ).all()


@router.get("/capacity/plan/{plan_id}/calendars", response_model=List[schemas.CapacityCalendarResponse])
def get_plan_calendars(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.CapacityCalendar).filter(
        models.CapacityCalendar.capacity_plan_id == plan_id,
        models.CapacityCalendar.is_deleted == False
    ).order_by(models.CapacityCalendar.date.asc()).all()


@router.get("/capacity/plan/{plan_id}/exceptions", response_model=List[schemas.CapacityExceptionResponse])
def get_plan_exceptions(
    plan_id: uuid.UUID,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    return db.query(models.CapacityException).filter(
        models.CapacityException.capacity_plan_id == plan_id,
        models.CapacityException.is_deleted == False
    ).all()



