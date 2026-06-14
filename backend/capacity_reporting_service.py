import uuid
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend import models
from backend.load_balancing_service import LoadBalancingService
from backend.advanced_planning_engine import identify_bottlenecks

class CapacityReportingService:
    @classmethod
    def get_capacity_utilization_report(cls, db: Session, capacity_plan_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Returns capacity utilization breakdown by work center."""
        cals = db.query(
            models.CapacityCalendar.work_center_id,
            func.sum(models.CapacityCalendar.available_hours).label('avail'),
            func.sum(models.CapacityCalendar.planned_hours).label('planned'),
            func.sum(models.CapacityCalendar.overtime_hours).label('overtime')
        ).filter_by(
            capacity_plan_id=capacity_plan_id,
            is_deleted=False
        ).group_by(models.CapacityCalendar.work_center_id).all()
        
        report = []
        for row in cals:
            wc_id, avail, planned, overtime = row
            wc = db.query(models.WorkCenter).get(wc_id)
            avail = Decimal(str(avail or 0.0))
            planned = Decimal(str(planned or 0.0))
            overtime = Decimal(str(overtime or 0.0))
            
            util = (planned / avail * Decimal("100.0")) if avail > 0 else Decimal("0.0")
            report.append({
                "work_center_id": str(wc_id),
                "work_center_code": wc.code if wc else "",
                "work_center_name": wc.name if wc else "",
                "available_hours": float(avail),
                "planned_hours": float(planned),
                "overtime_hours": float(overtime),
                "utilization_percent": float(util)
            })
        return report

    @classmethod
    def get_bottleneck_analysis_report(cls, db: Session, capacity_plan_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Identifies constrained resources, bottleneck hours, and exception impact."""
        return identify_bottlenecks(db, capacity_plan_id)

    @classmethod
    def get_schedule_adherence_report(cls, db: Session, capacity_plan_id: uuid.UUID) -> Dict[str, Any]:
        """Returns details on late work orders and overall schedule adherence."""
        exceptions = db.query(models.CapacityException).filter_by(
            capacity_plan_id=capacity_plan_id,
            exception_type="LATE_DELIVERY",
            is_deleted=False
        ).all()
        
        kpis = LoadBalancingService.get_kpis(db, capacity_plan_id)
        
        late_details = []
        for ex in exceptions:
            late_details.append({
                "work_center_id": str(ex.work_center_id),
                "exception_date": ex.exception_date.isoformat(),
                "severity": ex.severity,
                "message": ex.message,
                "late_days": ex.late_days
            })
            
        return {
            "schedule_adherence_percent": kpis["schedule_adherence_percent"],
            "total_late_exceptions": len(exceptions),
            "late_orders": late_details
        }

    @classmethod
    def get_work_center_efficiency_report(cls, db: Session, capacity_plan_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Compares work center available hours, efficiency factors, and net effectiveness."""
        cals = db.query(models.CapacityCalendar).filter_by(
            capacity_plan_id=capacity_plan_id,
            is_deleted=False
        ).all()
        
        report = []
        for cal in cals:
            wc = db.query(models.WorkCenter).get(cal.work_center_id)
            report.append({
                "work_center_code": wc.code if wc else "",
                "date": cal.date.strftime("%Y-%m-%d"),
                "available_hours": float(cal.available_hours),
                "efficiency_factor": float(cal.efficiency_factor),
                "blocked_hours": float(cal.blocked_hours),
                "planned_hours": float(cal.planned_hours)
            })
        return report

    @classmethod
    def get_throughput_forecast(cls, db: Session, capacity_plan_id: uuid.UUID) -> Dict[str, Any]:
        """Provides simulated production throughput forecast based on finite plan execution."""
        kpis = LoadBalancingService.get_kpis(db, capacity_plan_id)
        return {
            "capacity_plan_id": str(capacity_plan_id),
            "throughput_forecast_qty": kpis["throughput_forecast_qty"],
            "schedule_stability_percent": kpis["schedule_stability_percent"],
            "average_queue_time_hours": kpis["average_queue_time_hours"]
        }
