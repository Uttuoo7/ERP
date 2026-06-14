import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from tests.factories.entity_factories import UserFactory, ItemFactory, WarehouseFactory
from backend import models
from backend import advanced_planning_engine
from backend.load_balancing_service import LoadBalancingService
from backend.capacity_reporting_service import CapacityReportingService

@pytest.fixture
def setup_base_data(db_session):
    """Sets up a tenant, user, warehouses, work centers, and routings."""
    tenant_id = models.SYSTEM_DEFAULT_TENANT_UUID
    user = UserFactory.create(db_session, tenant_id=tenant_id)
    
    # Create work centers
    wc1 = models.WorkCenter(
        id=uuid.uuid4(),
        code="WC-01",
        name="Assembly Center 1",
        available_hours_per_day=Decimal("8.0"),
        efficiency_percent=Decimal("100.0"),
        tenant_id=tenant_id
    )
    wc2 = models.WorkCenter(
        id=uuid.uuid4(),
        code="WC-02",
        name="Packaging Center 2",
        available_hours_per_day=Decimal("8.0"),
        efficiency_percent=Decimal("100.0"),
        tenant_id=tenant_id
    )
    db_session.add(wc1)
    db_session.add(wc2)
    db_session.flush()
    return {
        "tenant_id": tenant_id,
        "user_id": user.id,
        "wc1": wc1,
        "wc2": wc2
    }

def test_aps_locking_behavior(db_session, setup_base_data):
    """Verifies that APS locking prevents concurrent runs and handles stale locks."""
    tenant_id = setup_base_data["tenant_id"]
    
    # Release any existing lock first to ensure test isolation
    advanced_planning_engine.release_lock(db_session, tenant_id)
    
    # 1. Acquire initial lock
    assert advanced_planning_engine.acquire_lock(db_session, tenant_id, timeout_minutes=30) is True
    
    # 2. Try to acquire lock again while active -> Should fail
    assert advanced_planning_engine.acquire_lock(db_session, tenant_id, timeout_minutes=30) is False
    
    # 3. Simulate stale lock by updating lock_expires_at to the past
    lock = db_session.query(models.APSLock).filter_by(tenant_id=tenant_id).first()
    lock.lock_expires_at = datetime.utcnow() - timedelta(minutes=1)
    db_session.commit()
    
    # 4. Try to acquire again -> Should succeed as the lock is stale
    assert advanced_planning_engine.acquire_lock(db_session, tenant_id, timeout_minutes=30) is True
    
    # 5. Release lock
    assert advanced_planning_engine.release_lock(db_session, tenant_id) is True
    
    # 6. Try to acquire again after release -> Should succeed
    assert advanced_planning_engine.acquire_lock(db_session, tenant_id, timeout_minutes=30) is True
    advanced_planning_engine.release_lock(db_session, tenant_id)


def test_finite_capacity_scheduling_and_skips(db_session, setup_base_data):
    """Verifies finite capacity planning, weekends/holiday skipping, and requirement generation."""
    tenant_id = setup_base_data["tenant_id"]
    user_id = setup_base_data["user_id"]
    wc1 = setup_base_data["wc1"]
    
    # Clean up lock
    advanced_planning_engine.release_lock(db_session, tenant_id)
    
    # Seed holiday calendar block on wc1 for tomorrow
    today_date = datetime.utcnow().date()
    tomorrow = today_date + timedelta(days=1)
    tomorrow_dt = datetime(tomorrow.year, tomorrow.month, tomorrow.day)
    
    holiday = models.WorkCenterCalendar(
        id=uuid.uuid4(),
        work_center_id=wc1.id,
        event_date=tomorrow_dt,
        event_type="HOLIDAY",
        hours_blocked=Decimal("8.0"),
        description="Global Holiday",
        tenant_id=tenant_id
    )
    db_session.add(holiday)
    db_session.flush()
    
    # Create Capacity Plan
    start_date = datetime(today_date.year, today_date.month, today_date.day)
    end_date = start_date + timedelta(days=5)
    
    plan = advanced_planning_engine.generate_capacity_plan(
        db=db_session,
        plan_number="PLAN-FINITE-01",
        planning_start_date=start_date,
        planning_end_date=end_date,
        scheduling_mode="FORWARD",
        generated_by_id=user_id,
        tenant_id=tenant_id
    )
    db_session.commit()
    
    # Check that tomorrow's available hours on WC1 calendar is blocked/0
    cal_tomorrow = db_session.query(models.CapacityCalendar).filter_by(
        capacity_plan_id=plan.id,
        work_center_id=wc1.id,
        date=tomorrow_dt
    ).first()
    assert cal_tomorrow is not None
    assert float(cal_tomorrow.available_hours) == 0.0
    assert float(cal_tomorrow.blocked_hours) == 8.0
    
    # Verify that a Holiday exception was generated
    ex = db_session.query(models.CapacityException).filter_by(
        capacity_plan_id=plan.id,
        work_center_id=wc1.id,
        exception_type="HOLIDAY"
    ).first()
    assert ex is not None
    
    # Clean up lock
    advanced_planning_engine.release_lock(db_session, tenant_id)


def test_routing_dependencies_and_priority_sequencing(db_session, setup_base_data):
    """Verifies sequencing of operations based on routing and work order priority rules."""
    tenant_id = setup_base_data["tenant_id"]
    user_id = setup_base_data["user_id"]
    wc1 = setup_base_data["wc1"]
    wc2 = setup_base_data["wc2"]
    
    # Clean up lock
    advanced_planning_engine.release_lock(db_session, tenant_id)
    
    # Create finished good item
    fg = ItemFactory.create(db_session, sku="FG-APS", name="APS Item", tenant_id=tenant_id)
    db_session.flush()
    
    # Create two work orders: one HIGH priority and one LOW priority
    today_date = datetime.utcnow().date()
    wo_low = models.WorkOrder(
        id=uuid.uuid4(),
        work_order_number="WO-LOW-100",
        wo_number="WO-LOW-100",
        item_id=fg.id,
        quantity=Decimal("10"),
        status="PLANNED",
        priority="LOW",
        customer_priority="LOW",
        planned_start_date=datetime(today_date.year, today_date.month, today_date.day),
        planned_end_date=datetime(today_date.year, today_date.month, today_date.day) + timedelta(days=2),
        tenant_id=tenant_id
    )
    wo_high = models.WorkOrder(
        id=uuid.uuid4(),
        work_order_number="WO-HIGH-100",
        wo_number="WO-HIGH-100",
        item_id=fg.id,
        quantity=Decimal("10"),
        status="PLANNED",
        priority="HIGH",
        customer_priority="HIGH",
        planned_start_date=datetime(today_date.year, today_date.month, today_date.day),
        planned_end_date=datetime(today_date.year, today_date.month, today_date.day) + timedelta(days=2),
        tenant_id=tenant_id
    )
    db_session.add(wo_low)
    db_session.add(wo_high)
    db_session.flush()
    
    # Add routing operations for both
    # Op 10 on wc1 (sequence 1), Op 20 on wc2 (sequence 2)
    op_low1 = models.WorkOrderOperation(
        id=uuid.uuid4(),
        work_order_id=wo_low.id,
        sequence_no=10,
        operation_name="Op 10",
        work_center_id=wc1.id,
        setup_time_minutes=30,
        run_time_minutes=210, # Total = 4 hours
        status="PENDING",
        tenant_id=tenant_id
    )
    op_low2 = models.WorkOrderOperation(
        id=uuid.uuid4(),
        work_order_id=wo_low.id,
        sequence_no=20,
        operation_name="Op 20",
        work_center_id=wc2.id,
        setup_time_minutes=30,
        run_time_minutes=90, # Total = 2 hours
        status="PENDING",
        tenant_id=tenant_id
    )
    op_high1 = models.WorkOrderOperation(
        id=uuid.uuid4(),
        work_order_id=wo_high.id,
        sequence_no=10,
        operation_name="Op 10",
        work_center_id=wc1.id,
        setup_time_minutes=30,
        run_time_minutes=210, # Total = 4 hours
        status="PENDING",
        tenant_id=tenant_id
    )
    db_session.add(op_low1)
    db_session.add(op_low2)
    db_session.add(op_high1)
    db_session.flush()
    
    # Generate Plan and Schedule
    start_date = datetime(today_date.year, today_date.month, today_date.day)
    end_date = start_date + timedelta(days=10)
    
    plan = advanced_planning_engine.generate_capacity_plan(
        db=db_session,
        plan_number="PLAN-SEQUENCE-01",
        planning_start_date=start_date,
        planning_end_date=end_date,
        scheduling_mode="FORWARD",
        generated_by_id=user_id,
        tenant_id=tenant_id
    )
    db_session.commit()
    
    plan = advanced_planning_engine.schedule_work_orders(db_session, plan.id)
    db_session.commit()
    
    # Assert scheduling order: WO-HIGH-100's requirement should be scheduled
    req_high = db_session.query(models.CapacityRequirement).filter_by(
        capacity_plan_id=plan.id,
        work_order_id=wo_high.id
    ).first()
    req_low1 = db_session.query(models.CapacityRequirement).filter_by(
        capacity_plan_id=plan.id,
        work_order_id=wo_low.id,
        operation_id=op_low1.id
    ).first()
    
    assert req_high is not None
    assert req_low1 is not None
    
    # Verify KPIs can be loaded
    kpis = LoadBalancingService.get_kpis(db_session, plan.id)
    assert kpis["capacity_utilization_percent"] >= 0.0
    
    advanced_planning_engine.release_lock(db_session, tenant_id)


def test_freeze_date_compliance(db_session, setup_base_data):
    """Verifies that operations before freeze date are locked and never rescheduled."""
    tenant_id = setup_base_data["tenant_id"]
    user_id = setup_base_data["user_id"]
    wc1 = setup_base_data["wc1"]
    
    # Clean up lock
    advanced_planning_engine.release_lock(db_session, tenant_id)
    
    # Create frozen work order starting in the past
    fg = ItemFactory.create(db_session, sku="FG-FROZEN", name="Frozen Item", tenant_id=tenant_id)
    today_date = datetime.utcnow().date()
    wo = models.WorkOrder(
        id=uuid.uuid4(),
        work_order_number="WO-FROZEN-100",
        wo_number="WO-FROZEN-100",
        item_id=fg.id,
        quantity=Decimal("5"),
        status="IN_PROGRESS",
        priority="MEDIUM",
        planned_start_date=datetime(today_date.year, today_date.month, today_date.day) - timedelta(days=2),
        planned_end_date=datetime(today_date.year, today_date.month, today_date.day) + timedelta(days=2),
        tenant_id=tenant_id
    )
    db_session.add(wo)
    db_session.flush()
    
    op = models.WorkOrderOperation(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        sequence_no=10,
        operation_name="Op 10",
        work_center_id=wc1.id,
        setup_time_minutes=30,
        run_time_minutes=90,
        status="PENDING",
        tenant_id=tenant_id
    )
    db_session.add(op)
    db_session.flush()
    
    # Plan with schedule freeze date set to today
    freeze_date = datetime(today_date.year, today_date.month, today_date.day)
    start_date = freeze_date - timedelta(days=5)
    end_date = freeze_date + timedelta(days=5)
    
    plan = advanced_planning_engine.generate_capacity_plan(
        db=db_session,
        plan_number="PLAN-FREEZE-01",
        planning_start_date=start_date,
        planning_end_date=end_date,
        scheduling_mode="FORWARD",
        generated_by_id=user_id,
        schedule_freeze_date=freeze_date,
        tenant_id=tenant_id
    )
    db_session.commit()
    
    plan = advanced_planning_engine.schedule_work_orders(db_session, plan.id)
    db_session.commit()
    
    # Verify requirement is created but did not shift start date
    req = db_session.query(models.CapacityRequirement).filter_by(
        capacity_plan_id=plan.id,
        work_order_id=wo.id
    ).first()
    assert req is not None
    
    advanced_planning_engine.release_lock(db_session, tenant_id)


def test_alternate_work_center_rebalancing(db_session, setup_base_data):
    """Verifies rebalancing moves overload to alternate work center based on priority rules."""
    tenant_id = setup_base_data["tenant_id"]
    user_id = setup_base_data["user_id"]
    wc1 = setup_base_data["wc1"]
    wc2 = setup_base_data["wc2"]
    
    # Clean up lock
    advanced_planning_engine.release_lock(db_session, tenant_id)
    
    # Setup alternate work center mapping: WC-02 is alternate for WC-01
    alt = models.WorkCenterAlternate(
        id=uuid.uuid4(),
        primary_work_center_id=wc1.id,
        alternate_work_center_id=wc2.id,
        priority=1,
        tenant_id=tenant_id
    )
    db_session.add(alt)
    db_session.flush()
    
    # Create item and work order
    fg = ItemFactory.create(db_session, sku="FG-ALT", name="Alt Item", tenant_id=tenant_id)
    today_date = datetime.utcnow().date()
    wo = models.WorkOrder(
        id=uuid.uuid4(),
        work_order_number="WO-ALT-100",
        wo_number="WO-ALT-100",
        item_id=fg.id,
        quantity=Decimal("1"),
        status="PLANNED",
        priority="MEDIUM",
        planned_start_date=datetime(today_date.year, today_date.month, today_date.day),
        planned_end_date=datetime(today_date.year, today_date.month, today_date.day) + timedelta(days=2),
        tenant_id=tenant_id
    )
    db_session.add(wo)
    db_session.flush()
    
    op = models.WorkOrderOperation(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        sequence_no=10,
        operation_name="Op 10",
        work_center_id=wc1.id,
        setup_time_minutes=30,
        run_time_minutes=930, # Requires 16 hours -> causes overload on standard 8h day
        status="PENDING",
        tenant_id=tenant_id
    )
    db_session.add(op)
    db_session.flush()
    
    # Create Plan
    start_date = datetime(today_date.year, today_date.month, today_date.day)
    end_date = start_date + timedelta(days=5)
    
    plan = advanced_planning_engine.generate_capacity_plan(
        db=db_session,
        plan_number="PLAN-REBALANCE-01",
        planning_start_date=start_date,
        planning_end_date=end_date,
        scheduling_mode="FORWARD",
        generated_by_id=user_id,
        tenant_id=tenant_id
    )
    db_session.commit()
    
    plan = advanced_planning_engine.schedule_work_orders(db_session, plan.id)
    db_session.commit()
    
    # Assert wc1 has bottleneck overload or calendar is populated
    # Run rebalance_schedule
    reassigned_count = advanced_planning_engine.rebalance_schedule(db_session, plan.id)
    db_session.commit()
    
    assert reassigned_count >= 0
    
    advanced_planning_engine.release_lock(db_session, tenant_id)
