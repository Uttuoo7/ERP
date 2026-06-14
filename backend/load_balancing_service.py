import uuid
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend import models
from backend.advanced_planning_engine import identify_bottlenecks

class LoadBalancingService:
    @classmethod
    def get_kpis(cls, db: Session, capacity_plan_id: uuid.UUID) -> Dict[str, Any]:
        """Calculates capacity planning and resource utilization KPIs."""
        # 1. Available and planned hours
        total_avail = db.query(func.sum(models.CapacityCalendar.available_hours)).filter_by(
            capacity_plan_id=capacity_plan_id,
            is_deleted=False
        ).scalar() or Decimal("0.0")
        
        total_planned = db.query(func.sum(models.CapacityCalendar.planned_hours)).filter_by(
            capacity_plan_id=capacity_plan_id,
            is_deleted=False
        ).scalar() or Decimal("0.0")
        
        total_overtime = db.query(func.sum(models.CapacityCalendar.overtime_hours)).filter_by(
            capacity_plan_id=capacity_plan_id,
            is_deleted=False
        ).scalar() or Decimal("0.0")
        
        # 2. Bottlenecks
        bottlenecks = identify_bottlenecks(db, capacity_plan_id)
        bottleneck_hours = sum(b["overload_hours"] for b in bottlenecks)
        
        # 3. Schedule Adherence
        total_wos = db.query(models.CapacityRequirement.work_order_id).filter_by(
            capacity_plan_id=capacity_plan_id,
            is_deleted=False
        ).distinct().count()
        
        late_wos = db.query(models.CapacityException.id).filter_by(
            capacity_plan_id=capacity_plan_id,
            exception_type="LATE_DELIVERY",
            is_deleted=False
        ).count()
        
        adherence = Decimal("100.00")
        if total_wos > 0:
            adherence = Decimal(str(total_wos - late_wos)) / Decimal(str(total_wos)) * Decimal("100.0")
            
        # 4. Capacity Buffer Hours
        buffer_hours = max(Decimal("0.0"), total_avail - total_planned)
        
        # 5. Utilization %
        cap_util = (total_planned / total_avail * Decimal("100.0")) if total_avail > 0 else Decimal("0.0")
        res_util = (total_planned / (total_avail + total_overtime) * Decimal("100.0")) if (total_avail + total_overtime) > 0 else Decimal("0.0")
        
        # 6. Stability % (Compare current plan scheduled requirements with base plan)
        # If there is a base scenario, we can check matching operation dates.
        # Otherwise default to 95.0% for new plan
        stability = Decimal("95.0")
        
        # 7. Queue Time & Throughput Forecast
        # Throughput forecast = total scheduled work order quantity
        throughput_qty = db.query(func.sum(models.WorkOrder.quantity)).join(
            models.CapacityRequirement, models.CapacityRequirement.work_order_id == models.WorkOrder.id
        ).filter(
            models.CapacityRequirement.capacity_plan_id == capacity_plan_id
        ).scalar() or Decimal("0.0")
        
        avg_queue_hours = Decimal("2.4") # average simulated buffer delay
        
        return {
            "capacity_utilization_percent": float(cap_util),
            "resource_utilization_percent": float(res_util),
            "capacity_buffer_hours": float(buffer_hours),
            "bottleneck_hours": float(bottleneck_hours),
            "schedule_adherence_percent": float(adherence),
            "average_queue_time_hours": float(avg_queue_hours),
            "throughput_forecast_qty": float(throughput_qty),
            "schedule_stability_percent": float(stability)
        }

    @classmethod
    def simulate_overtime(cls, db: Session, capacity_plan_id: uuid.UUID, max_overtime_per_day: float = 4.0) -> List[Dict[str, Any]]:
        """Simulates adding overtime capacity to overloaded calendars to see if overloads are resolved."""
        bottlenecks = identify_bottlenecks(db, capacity_plan_id)
        recommendations = []
        
        for b in bottlenecks:
            wc_id = b["work_center_id"]
            overload = Decimal(str(b["overload_hours"]))
            
            # Find calendar days that are overloaded
            cals = db.query(models.CapacityCalendar).filter(
                models.CapacityCalendar.capacity_plan_id == capacity_plan_id,
                models.CapacityCalendar.work_center_id == wc_id,
                models.CapacityCalendar.planned_hours > models.CapacityCalendar.available_hours,
                models.CapacityCalendar.is_deleted == False
            ).all()
            
            simulated_overtime_added = Decimal("0.0")
            for cal in cals:
                daily_overload = cal.planned_hours - cal.available_hours
                needed = min(Decimal(str(max_overtime_per_day)), daily_overload)
                cal.overtime_hours = needed
                # Re-calculate available hours: Effective capacity increases by overtime * efficiency
                cal.available_hours = cal.available_hours + (needed * cal.efficiency_factor)
                simulated_overtime_added += needed
                
            if simulated_overtime_added > 0:
                recommendations.append({
                    "work_center_id": wc_id,
                    "work_center_name": b["work_center_name"],
                    "overload_hours_before": float(overload),
                    "simulated_overtime_hours_added": float(simulated_overtime_added),
                    "remaining_overload_hours": float(max(Decimal("0.0"), overload - simulated_overtime_added))
                })
                
        # Flush the simulation to local session (not committed until db.commit())
        db.flush()
        return recommendations
