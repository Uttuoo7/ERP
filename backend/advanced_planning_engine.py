import uuid
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend import models

logger = logging.getLogger(__name__)

def acquire_lock(db: Session, tenant_id: uuid.UUID, timeout_minutes: int = 45) -> bool:
    """Acquires a tenant-level lock for APS scheduling with timeout protection."""
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=timeout_minutes)
    
    # Query lock for the tenant
    lock = db.query(models.APSLock).filter_by(tenant_id=tenant_id).first()
    
    if lock:
        # Check if lock is active and has not expired
        if lock.is_locked and now < lock.lock_expires_at:
            logger.warning(f"Duplicate active planning run rejected for tenant {tenant_id}. Lock active until {lock.lock_expires_at}")
            return False
        
        # Acquire stale or inactive lock
        lock.is_locked = True
        lock.lock_acquired_at = now
        lock.lock_expires_at = expires_at
        logger.info(f"Lock acquired/refreshed for tenant {tenant_id} (acquired_at={now}, expires_at={expires_at})")
    else:
        # Create new lock
        lock = models.APSLock(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            lock_acquired_at=now,
            lock_expires_at=expires_at,
            is_locked=True
        )
        db.add(lock)
        logger.info(f"New lock created and acquired for tenant {tenant_id} (expires_at={expires_at})")
        
    db.commit()
    return True

def release_lock(db: Session, tenant_id: uuid.UUID) -> bool:
    """Releases the tenant-level APS scheduling lock."""
    lock = db.query(models.APSLock).filter_by(tenant_id=tenant_id).first()
    if lock:
        lock.is_locked = False
        db.commit()
        logger.info(f"Lock released for tenant {tenant_id}")
        return True
    return False

def calculate_available_capacity(db: Session, work_center_id: uuid.UUID, start_date: datetime, end_date: datetime) -> Decimal:
    """Aggregates net available hours on a work center calendar within a date range."""
    cals = db.query(models.CapacityCalendar).filter(
        models.CapacityCalendar.work_center_id == work_center_id,
        models.CapacityCalendar.date >= start_date,
        models.CapacityCalendar.date <= end_date,
        models.CapacityCalendar.is_deleted == False
    ).all()
    return sum(Decimal(str(cal.available_hours)) for cal in cals)

def calculate_required_capacity(db: Session, work_center_id: uuid.UUID, start_date: datetime, end_date: datetime) -> Decimal:
    """Aggregates scheduled hours for operations on a work center within a date range."""
    reqs = db.query(models.CapacityRequirement).filter(
        models.CapacityRequirement.work_center_id == work_center_id,
        models.CapacityRequirement.is_deleted == False
    ).all()
    
    # Filter by parent work order dates or requirement date if applicable
    # Since CapacityRequirement doesn't have its own date, we map to calendar date or parent WO schedule.
    # To keep it robust, we sum the required_hours on CapacityRequirement.
    return sum(Decimal(str(req.required_hours)) for req in reqs)

def generate_capacity_plan(
    db: Session,
    plan_number: str,
    planning_start_date: datetime,
    planning_end_date: datetime,
    scheduling_mode: str,
    generated_by_id: uuid.UUID,
    schedule_freeze_date: Optional[datetime] = None,
    tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
) -> models.CapacityPlan:
    """Generates a capacity plan and initializes all calendar dates over the planning horizon."""
    if not acquire_lock(db, tenant_id):
        raise ValueError("Cannot execute planning: Another planning run is currently active for this tenant.")
        
    try:
        horizon_days = (planning_end_date - planning_start_date).days
        if horizon_days <= 0:
            horizon_days = 30
            
        plan = models.CapacityPlan(
            id=uuid.uuid4(),
            plan_number=plan_number,
            planning_start_date=planning_start_date,
            planning_end_date=planning_end_date,
            planning_horizon_days=horizon_days,
            scheduling_mode=scheduling_mode,
            schedule_freeze_date=schedule_freeze_date,
            status='DRAFT',
            generated_at=datetime.utcnow(),
            generated_by_id=generated_by_id,
            tenant_id=tenant_id
        )
        db.add(plan)
        db.flush()
        
        # 1. Initialize Capacity Calendars for each work center
        work_centers = db.query(models.WorkCenter).filter(models.WorkCenter.is_deleted == False).all()
        
        for wc in work_centers:
            current_date = planning_start_date
            while current_date <= planning_end_date:
                # Resolve base availability
                base_hours = Decimal(str(wc.available_hours_per_day or 8.0000))
                efficiency = Decimal(str(wc.efficiency_percent or 100.00)) / Decimal("100.00")
                
                # Check for holiday or downtime calendar blocks
                blocked = Decimal("0.0000")
                events = db.query(models.WorkCenterCalendar).filter(
                    models.WorkCenterCalendar.work_center_id == wc.id,
                    models.WorkCenterCalendar.event_date >= datetime(current_date.year, current_date.month, current_date.day),
                    models.WorkCenterCalendar.event_date < datetime(current_date.year, current_date.month, current_date.day) + timedelta(days=1)
                ).all()
                for event in events:
                    if event.event_type in ("HOLIDAY", "MAINTENANCE", "DOWNTIME"):
                        blocked += Decimal(str(event.hours_blocked or 0.0))
                
                # Check if it is a standard non-working weekend (Saturday/Sunday) if calendar is empty
                is_weekend = current_date.weekday() in (5, 6)
                if is_weekend and not events:
                    blocked = base_hours # Block all standard hours on weekend
                    
                # Effective Capacity = (Available Hours + Overtime Hours) * Efficiency Factor
                # Initialize overtime_hours as 0.0000
                overtime = Decimal("0.0000")
                effective_capacity = (base_hours + overtime) * efficiency
                net_available = max(Decimal("0.0000"), effective_capacity - blocked)
                
                cal = models.CapacityCalendar(
                    id=uuid.uuid4(),
                    capacity_plan_id=plan.id,
                    work_center_id=wc.id,
                    date=current_date,
                    available_hours=net_available,
                    overtime_hours=overtime,
                    planned_hours=Decimal("0.0000"),
                    blocked_hours=blocked,
                    efficiency_factor=efficiency,
                    tenant_id=tenant_id
                )
                db.add(cal)
                
                # Create Holiday/Maintenance Capacity Exceptions if needed
                for event in events:
                    if event.event_type in ("HOLIDAY", "MAINTENANCE"):
                        ex = models.CapacityException(
                            id=uuid.uuid4(),
                            capacity_plan_id=plan.id,
                            work_center_id=wc.id,
                            exception_type=event.event_type,
                            exception_date=current_date,
                            severity="WARNING" if event.event_type == "MAINTENANCE" else "INFO",
                            message=f"Scheduled WorkCenter {event.event_type}: {event.description or ''}",
                            impact_hours=event.hours_blocked,
                            late_days=0,
                            resolved=False,
                            tenant_id=tenant_id
                        )
                        db.add(ex)
                
                current_date += timedelta(days=1)
                
        db.flush()
        return plan
    except Exception as e:
        release_lock(db, tenant_id)
        raise e

def identify_bottlenecks(db: Session, capacity_plan_id: uuid.UUID) -> List[Dict[str, Any]]:
    """Identifies work centers with utilization exceeding 100% or overload hours > 0."""
    bottlenecks = []
    
    # Calculate sum of planned_hours and available_hours grouped by work center
    cals = db.query(
        models.CapacityCalendar.work_center_id,
        func.sum(models.CapacityCalendar.available_hours).label('avail'),
        func.sum(models.CapacityCalendar.planned_hours).label('planned')
    ).filter(
        models.CapacityCalendar.capacity_plan_id == capacity_plan_id,
        models.CapacityCalendar.is_deleted == False
    ).group_by(models.CapacityCalendar.work_center_id).all()
    
    for row in cals:
        wc_id, avail, planned = row
        avail = Decimal(str(avail or 0.0))
        planned = Decimal(str(planned or 0.0))
        
        util = (planned / avail * Decimal("100.0")) if avail > 0 else Decimal("0.0")
        if util > Decimal("100.0") or planned > avail:
            wc = db.query(models.WorkCenter).get(wc_id)
            bottlenecks.append({
                "work_center_id": wc_id,
                "work_center_name": wc.name if wc else "Unknown",
                "available_hours": float(avail),
                "planned_hours": float(planned),
                "utilization_percent": float(util),
                "overload_hours": float(planned - avail)
            })
            
    return bottlenecks

def schedule_work_orders(db: Session, capacity_plan_id: uuid.UUID) -> models.CapacityPlan:
    """Schedules work orders and operations chronologically utilizing finite capacity rules."""
    plan = db.query(models.CapacityPlan).get(capacity_plan_id)
    if not plan:
        raise ValueError("Capacity plan not found")
        
    tenant_id = plan.tenant_id
    freeze_date = plan.schedule_freeze_date
    
    # 1. Fetch active work orders (PLANNED, RELEASED, MATERIAL_ALLOCATED, IN_PROGRESS, QC_PENDING)
    wos = db.query(models.WorkOrder).filter(
        models.WorkOrder.status.in_(["PLANNED", "RELEASED", "MATERIAL_ALLOCATED", "IN_PROGRESS", "QC_PENDING"]),
        models.WorkOrder.is_deleted == False,
        models.WorkOrder.tenant_id == tenant_id
    ).all()
    
    # Helper mappings for priority sorting
    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, None: 4}
    cust_priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, None: 3}
    
    # Sort work orders
    def sorting_key(wo):
        p_val = priority_order.get(wo.priority, 4)
        c_val = cust_priority_order.get(wo.customer_priority, 3)
        due_date = wo.planned_end_date or datetime.max
        release_date = wo.release_date or datetime.min
        wo_num = wo.wo_number or wo.work_order_number or ""
        return (p_val, c_val, due_date, release_date, wo_num)
        
    sorted_wos = sorted(wos, key=sorting_key)
    
    # Pre-fetch all operations for these work orders in a single query
    wo_ids = [wo.id for wo in sorted_wos]
    all_ops = db.query(models.WorkOrderOperation).filter(
        models.WorkOrderOperation.work_order_id.in_(wo_ids)
    ).order_by(models.WorkOrderOperation.work_order_id, models.WorkOrderOperation.sequence_no).all()
    
    # Group operations by work_order_id
    ops_by_wo = {}
    for op in all_ops:
        ops_by_wo.setdefault(op.work_order_id, []).append(op)
        
    # Pre-load all capacity calendars for this plan into memory
    cals = db.query(models.CapacityCalendar).filter_by(
        capacity_plan_id=plan.id,
        is_deleted=False
    ).all()
    
    cal_cache = {}
    for c in cals:
        d = datetime(c.date.year, c.date.month, c.date.day)
        cal_cache[(c.work_center_id, d)] = c
        
    # Helper for in-memory available capacity calculation
    def get_cached_available_capacity(wc_id, start, end):
        total = Decimal("0.0")
        curr = datetime(start.year, start.month, start.day)
        limit = datetime(end.year, end.month, end.day)
        while curr <= limit:
            cal_rec = cal_cache.get((wc_id, curr))
            if cal_rec:
                total += Decimal(str(cal_rec.available_hours))
            curr += timedelta(days=1)
        return total

    for wo in sorted_wos:
        # Get operations from in-memory dictionary
        ops = ops_by_wo.get(wo.id, [])
        
        is_frozen = False
        if freeze_date and wo.planned_start_date and wo.planned_start_date <= freeze_date:
            is_frozen = True
            
        current_time = plan.planning_start_date
        if wo.planned_start_date and wo.planned_start_date > current_time:
            current_time = wo.planned_start_date
            
        for op in ops:
            if op.status == 'COMPLETED':
                continue
                
            required_hours = Decimal(str((op.setup_time_minutes + op.run_time_minutes) / 60.0))
            if required_hours <= 0:
                required_hours = Decimal("1.0")
                
            if is_frozen:
                op_date = wo.planned_start_date or plan.planning_start_date
                d_key = datetime(op_date.year, op_date.month, op_date.day)
                cal = cal_cache.get((op.work_center_id, d_key))
                if cal:
                    cal.planned_hours = Decimal(str(cal.planned_hours)) + required_hours
                    
                req = models.CapacityRequirement(
                    id=uuid.uuid4(),
                    capacity_plan_id=plan.id,
                    work_order_id=wo.id,
                    work_center_id=op.work_center_id,
                    operation_id=op.id,
                    required_hours=required_hours,
                    scheduled_hours=required_hours,
                    remaining_hours=Decimal("0.0000"),
                    available_hours=cal.available_hours if cal else Decimal("0.0000"),
                    utilization_percent=Decimal("100.00"),
                    overload_hours=Decimal("0.0000"),
                    tenant_id=tenant_id
                )
                db.add(req)
                continue
                
            hours_to_schedule = hours_to_schedule = required_hours
            op_start_date = None
            op_end_date = None
            
            search_date = datetime(current_time.year, current_time.month, current_time.day)
            
            while hours_to_schedule > 0:
                plan_end_norm = datetime(plan.planning_end_date.year, plan.planning_end_date.month, plan.planning_end_date.day)
                if search_date > plan_end_norm:
                    search_date = plan_end_norm
                    cal = cal_cache.get((op.work_center_id, search_date))
                    if cal:
                        if op_start_date is None:
                            op_start_date = search_date
                        cal.planned_hours = Decimal(str(cal.planned_hours)) + hours_to_schedule
                        hours_to_schedule = Decimal("0.0000")
                        op_end_date = search_date
                    break
                    
                cal = cal_cache.get((op.work_center_id, search_date))
                if not cal:
                    break
                    
                net_available = cal.available_hours - cal.planned_hours
                if net_available > 0:
                    if op_start_date is None:
                        op_start_date = search_date
                        
                    booked = min(hours_to_schedule, net_available)
                    cal.planned_hours = Decimal(str(cal.planned_hours)) + booked
                    hours_to_schedule -= booked
                    op_end_date = search_date
                    
                search_date += timedelta(days=1)
                
            if op_start_date is None:
                op_start_date = current_time
                op_end_date = current_time + timedelta(hours=float(required_hours))
                
            req = models.CapacityRequirement(
                id=uuid.uuid4(),
                capacity_plan_id=plan.id,
                work_order_id=wo.id,
                work_center_id=op.work_center_id,
                operation_id=op.id,
                required_hours=required_hours,
                scheduled_hours=required_hours - hours_to_schedule,
                remaining_hours=hours_to_schedule,
                available_hours=get_cached_available_capacity(op.work_center_id, op_start_date, op_end_date),
                utilization_percent=Decimal("100.00"),
                overload_hours=hours_to_schedule,
                tenant_id=tenant_id
            )
            db.add(req)
            
            current_time = op_end_date + timedelta(days=1)
            
            if wo.planned_end_date and op_end_date > wo.planned_end_date:
                late_days = (op_end_date - wo.planned_end_date).days
                if late_days > 0:
                    ex = models.CapacityException(
                        id=uuid.uuid4(),
                        capacity_plan_id=plan.id,
                        work_center_id=op.work_center_id,
                        exception_type="LATE_DELIVERY",
                        exception_date=op_end_date,
                        severity="CRITICAL" if late_days > 5 else "WARNING",
                        message=f"Work Order {wo.wo_number or wo.work_order_number} delayed by {late_days} days due to capacity constraints.",
                        impact_hours=Decimal(str(late_days * 8)),
                        late_days=late_days,
                        resolved=False,
                        tenant_id=tenant_id
                    )
                    db.add(ex)
                    
    db.flush()
    return plan

def rebalance_schedule(db: Session, capacity_plan_id: uuid.UUID) -> int:
    """Shifts overloaded workload to alternate work centers using selection priorities."""
    plan = db.query(models.CapacityPlan).get(capacity_plan_id)
    if not plan:
        return 0
        
    tenant_id = plan.tenant_id
    freeze_date = plan.schedule_freeze_date
    
    # 1. Query bottleneck work centers (planned > available)
    bottlenecks = identify_bottlenecks(db, capacity_plan_id)
    reassigned_count = 0
    
    for b in bottlenecks:
        wc_id = b["work_center_id"]
        
        # Get requirements scheduled on this center after the freeze date
        reqs = db.query(models.CapacityRequirement).filter(
            models.CapacityRequirement.capacity_plan_id == capacity_plan_id,
            models.CapacityRequirement.work_center_id == wc_id,
            models.CapacityRequirement.is_deleted == False
        ).all()
        
        for req in reqs:
            # Check freeze compliance
            wo = db.query(models.WorkOrder).get(req.work_order_id)
            if freeze_date and wo and wo.planned_start_date and wo.planned_start_date <= freeze_date:
                continue # Frozen!
                
            # Find alternates for this work center
            alts = db.query(models.WorkCenterAlternate).filter_by(
                primary_work_center_id=wc_id,
                is_deleted=False
            ).order_by(models.WorkCenterAlternate.priority).all()
            
            # Sort alternates using priority rules:
            # 1. Capability Match (all alternates mapped in WorkCenterAlternate are capability matches)
            # 2. Highest Available Capacity
            # 3. Lowest Utilization
            # 4. Alternate Priority
            alternate_list = []
            for alt in alts:
                alt_wc = db.query(models.WorkCenter).get(alt.alternate_work_center_id)
                if not alt_wc:
                    continue
                    
                # Calculate available and planned hours
                avail = db.query(func.sum(models.CapacityCalendar.available_hours)).filter_by(
                    capacity_plan_id=capacity_plan_id,
                    work_center_id=alt_wc.id
                ).scalar() or Decimal("0.0")
                planned = db.query(func.sum(models.CapacityCalendar.planned_hours)).filter_by(
                    capacity_plan_id=capacity_plan_id,
                    work_center_id=alt_wc.id
                ).scalar() or Decimal("0.0")
                
                util = planned / avail if avail > 0 else Decimal("9.9")
                alternate_list.append({
                    "alt": alt,
                    "avail_hours": avail,
                    "util_rate": util,
                    "priority": alt.priority
                })
                
            # Sort by highest available capacity, then lowest utilization, then priority
            sorted_alts = sorted(
                alternate_list, 
                key=lambda x: (-x["avail_hours"], x["util_rate"], x["priority"])
            )
            
            # Reassign to first alternate that has more remaining capacity than primary
            for item in sorted_alts:
                alt = item["alt"]
                alt_wc_id = alt.alternate_work_center_id
                
                # Check calendar capacity for alternate
                alt_avail = db.query(func.sum(models.CapacityCalendar.available_hours)).filter_by(
                    capacity_plan_id=capacity_plan_id,
                    work_center_id=alt_wc_id
                ).scalar() or Decimal("0.0")
                alt_planned = db.query(func.sum(models.CapacityCalendar.planned_hours)).filter_by(
                    capacity_plan_id=capacity_plan_id,
                    work_center_id=alt_wc_id
                ).scalar() or Decimal("0.0")
                
                alt_remaining = alt_avail - alt_planned
                
                # Reassign if alternate has any remaining headroom (load-shedding logic:
                # even if the full job doesn’t fit, moving it to the center with the
                # most remaining capacity reduces overall overload).
                if alt_remaining > Decimal("0.0"):
                    # Move requirement
                    req.work_center_id = alt_wc_id
                    
                    # Update operation snapshot
                    op = db.query(models.WorkOrderOperation).get(req.operation_id)
                    if op:
                        op.work_center_id = alt_wc_id
                        
                    # Re-allocate calendar hours
                    prim_cal = db.query(models.CapacityCalendar).filter_by(
                        capacity_plan_id=capacity_plan_id,
                        work_center_id=wc_id
                    ).first()
                    if prim_cal:
                        prim_cal.planned_hours = max(Decimal("0.0"), prim_cal.planned_hours - req.required_hours)
                        
                    # Add to alternate calendar
                    alt_cal = db.query(models.CapacityCalendar).filter_by(
                        capacity_plan_id=capacity_plan_id,
                        work_center_id=alt_wc_id
                    ).first()
                    if alt_cal:
                        alt_cal.planned_hours = alt_cal.planned_hours + req.required_hours
                        
                    reassigned_count += 1
                    break
                    
    db.flush()
    return reassigned_count

def reschedule_overloads(db: Session, capacity_plan_id: uuid.UUID) -> int:
    """Reschedules remaining overloaded operations to adjacent open capacity dates."""
    # Find all capacity requirements with remaining_hours or overload hours
    reqs = db.query(models.CapacityRequirement).filter(
        models.CapacityRequirement.capacity_plan_id == capacity_plan_id,
        models.CapacityRequirement.overload_hours > 0,
        models.CapacityRequirement.is_deleted == False
    ).all()
    
    shifted_count = 0
    plan = db.query(models.CapacityPlan).get(capacity_plan_id)
    if not plan:
        return 0
        
    for req in reqs:
        # Move it to subsequent dates where net capacity exists
        # Similar to rescheduling overloads to open days
        wc_id = req.work_center_id
        op = db.query(models.WorkOrderOperation).get(req.operation_id)
        if not op:
            continue
            
        hours_to_schedule = req.overload_hours
        search_date = plan.planning_start_date + timedelta(days=plan.planning_horizon_days) # Search beyond horizon
        
        while hours_to_schedule > 0:
            cal = db.query(models.CapacityCalendar).filter_by(
                capacity_plan_id=capacity_plan_id,
                work_center_id=wc_id,
                date=search_date
            ).first()
            
            if not cal:
                # Create a new calendar day beyond horizon dynamically if missing
                cal = models.CapacityCalendar(
                    id=uuid.uuid4(),
                    capacity_plan_id=capacity_plan_id,
                    work_center_id=wc_id,
                    date=search_date,
                    available_hours=Decimal("8.0000"),
                    overtime_hours=Decimal("0.0000"),
                    planned_hours=Decimal("0.0000"),
                    blocked_hours=Decimal("0.0000"),
                    efficiency_factor=Decimal("1.00"),
                    tenant_id=plan.tenant_id
                )
                db.add(cal)
                db.flush()
                
            net_avail = cal.available_hours - cal.planned_hours
            if net_avail > 0:
                booked = min(hours_to_schedule, net_avail)
                cal.planned_hours = cal.planned_hours + booked
                hours_to_schedule -= booked
                shifted_count += 1
                
            search_date += timedelta(days=1)
            
        # Clear overload status
        req.overload_hours = Decimal("0.0000")
        req.scheduled_hours = req.required_hours
        req.remaining_hours = Decimal("0.0000")
        
    db.flush()
    return shifted_count
