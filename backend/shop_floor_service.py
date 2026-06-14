import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from backend import models
from backend.manufacturing_accounting_service import ManufacturingAccountingService

class ShopFloorService:
    @classmethod
    def start_operation(cls, db: Session, work_order_id: uuid.UUID, operation_id: uuid.UUID) -> models.WorkOrderOperation:
        """Starts a shop floor operation sequence."""
        woo = db.query(models.WorkOrderOperation).filter_by(id=operation_id, work_order_id=work_order_id).first()
        if not woo:
            raise ValueError("Operation not found")
        if woo.status != 'PENDING':
            raise ValueError("Operation is already started or completed")
            
        woo.status = 'IN_PROGRESS'
        db.flush()
        
        # Log audit log
        log = models.ManufacturingAuditLog(
            work_order_id=work_order_id,
            action_type="WO_CHANGE",
            before_value=f"Operation {woo.operation_name}: PENDING",
            after_value=f"Operation {woo.operation_name}: IN_PROGRESS",
            user_id=None
        )
        db.add(log)
        db.flush()
        return woo

    @classmethod
    def complete_operation(
        cls,
        db: Session,
        work_order_id: uuid.UUID,
        operation_id: uuid.UUID,
        actual_setup_minutes: int,
        actual_run_minutes: int,
        scrap_qty: Decimal = Decimal('0.0000'),
        user_id: Optional[uuid.UUID] = None,
        tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
    ) -> models.WorkOrderOperation:
        """Completes operation, logs setup/run minutes, scrap, yield and performs absorption postings."""
        woo = db.query(models.WorkOrderOperation).filter_by(id=operation_id, work_order_id=work_order_id).first()
        if not woo:
            raise ValueError("Operation not found")
        if woo.status == 'COMPLETED':
            raise ValueError("Operation is already completed")
            
        wo = db.query(models.WorkOrder).filter_by(id=work_order_id).first()
        if not wo:
            raise ValueError("Work order not found")
            
        wc = db.query(models.WorkCenter).filter_by(id=woo.work_center_id).first()
        if not wc:
            raise ValueError("Work center not found")

        woo.actual_setup_time_minutes = actual_setup_minutes
        woo.actual_run_time_minutes = actual_run_minutes
        woo.status = 'COMPLETED'
        db.flush()
        
        # Post Labor booking (assuming $25.00/hour standard labor rate for simplicity)
        labor_hours = Decimal(actual_run_minutes + actual_setup_minutes) / Decimal('60.0')
        labor_rate = Decimal('25.00')
        ManufacturingAccountingService.post_labor_booking(
            db=db,
            work_order_id=work_order_id,
            hours=labor_hours,
            rate=labor_rate,
            tenant_id=tenant_id
        )
        
        # Post Overhead absorption based on WorkCenter cost_per_hour
        cost_per_hour = Decimal(str(wc.cost_per_hour)) if wc.cost_per_hour else Decimal('15.00') # Fallback $15/hr
        ManufacturingAccountingService.post_overhead_absorption(
            db=db,
            work_order_id=work_order_id,
            hours=labor_hours,
            rate=cost_per_hour,
            tenant_id=tenant_id
        )
        
        # Post Scrap Variance if scrap was logged
        if scrap_qty > 0:
            # Estimate raw material cost per scrap unit
            scrap_cost = Decimal('10.00') # Standard estimate
            ManufacturingAccountingService.post_scrap_variance(
                db=db,
                work_order_id=work_order_id,
                quantity=scrap_qty,
                unit_cost=scrap_cost,
                tenant_id=tenant_id
            )
            
            # Log audit for scrap
            log_scrap = models.ManufacturingAuditLog(
                work_order_id=work_order_id,
                action_type="SCRAP_POST",
                after_value=f"Operation {woo.operation_name}: Scrapped {scrap_qty} units",
                user_id=user_id
            )
            db.add(log_scrap)
            
        # Yield % calculation
        produced_qty = wo.quantity
        total_qty = produced_qty + scrap_qty
        yield_percent = (produced_qty / total_qty * 100) if total_qty > 0 else Decimal('100.00')
        
        # Log operation audit
        log = models.ManufacturingAuditLog(
            work_order_id=work_order_id,
            action_type="WO_CHANGE",
            before_value=f"Operation {woo.operation_name}: IN_PROGRESS",
            after_value=f"Operation {woo.operation_name}: COMPLETED (Setup: {actual_setup_minutes}m, Run: {actual_run_minutes}m, Yield: {yield_percent:.2f}%)",
            user_id=user_id
        )
        db.add(log)
        db.flush()
        return woo
