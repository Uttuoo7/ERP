import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend import models
from backend.manufacturing_accounting_service import ManufacturingAccountingService

class ManufacturingReportingService:
    @classmethod
    def get_wip_valuation_report(cls, db: Session, tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID) -> Dict[str, Any]:
        """Generates real-time WIP valuation reports by WO, Product, Work Center, and Aging."""
        accounts = ManufacturingAccountingService.get_manufacturing_accounts(db, tenant_id)
        
        # Get active work orders
        active_wos = db.query(models.WorkOrder).filter(
            models.WorkOrder.status.notin_(["CLOSED", "CANCELLED"]),
            models.WorkOrder.is_deleted == False
        ).all()
        
        wip_by_wo = []
        wip_by_product = {}
        wip_by_wc = {}
        aging_buckets = {"0-7 days": Decimal("0.00"), "8-15 days": Decimal("0.00"), "16-30 days": Decimal("0.00"), "30+ days": Decimal("0.00")}
        
        total_wip = Decimal("0.00")
        
        for wo in active_wos:
            # Sum up WIP posted to this WO
            wip_lines = db.query(
                models.JournalLine.debit_amount,
                models.JournalLine.credit_amount
            ).join(models.JournalEntry).filter(
                models.JournalEntry.reference_type == "WORK_ORDER",
                models.JournalEntry.reference_id == wo.id,
                models.JournalLine.account_id == accounts["wip"],
                models.JournalLine.is_deleted == False
            ).all()
            
            wo_wip = sum(line.debit_amount - line.credit_amount for line in wip_lines)
            if wo_wip == 0:
                continue
                
            total_wip += wo_wip
            
            wip_by_wo.append({
                "work_order_id": wo.id,
                "wo_number": wo.wo_number,
                "item_id": wo.item_id,
                "status": wo.status,
                "wip_value": wo_wip
            })
            
            # Group by product
            wip_by_product[wo.item_id] = wip_by_product.get(wo.item_id, Decimal("0.00")) + wo_wip
            
            # Group by work center (using the active or latest operation's work center)
            latest_op = db.query(models.WorkOrderOperation).filter_by(work_order_id=wo.id).order_by(models.WorkOrderOperation.sequence_no.desc()).first()
            if latest_op:
                wip_by_wc[latest_op.work_center_id] = wip_by_wc.get(latest_op.work_center_id, Decimal("0.00")) + wo_wip
            
            # Aging calculation
            age_days = (datetime.utcnow() - (wo.actual_start_date or wo.planned_start_date)).days
            if age_days <= 7:
                aging_buckets["0-7 days"] += wo_wip
            elif age_days <= 15:
                aging_buckets["8-15 days"] += wo_wip
            elif age_days <= 30:
                aging_buckets["16-30 days"] += wo_wip
            else:
                aging_buckets["30+ days"] += wo_wip
                
        # Transform product and work center dicts to lists
        product_list = [{"item_id": k, "wip_value": v} for k, v in wip_by_product.items()]
        wc_list = [{"work_center_id": k, "wip_value": v} for k, v in wip_by_wc.items()]
        
        return {
            "total_wip_value": total_wip,
            "wip_by_work_order": wip_by_wo,
            "wip_by_product": product_list,
            "wip_by_work_center": wc_list,
            "wip_aging": aging_buckets
        }

    @classmethod
    def get_production_variance_report(
        cls,
        db: Session,
        work_order_id: uuid.UUID,
        tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
    ) -> Dict[str, Any]:
        """Calculates material, labor, overhead, and yield variances for a work order."""
        wo = db.query(models.WorkOrder).filter_by(id=work_order_id).first()
        if not wo:
            raise ValueError("Work order not found")
            
        # Standard Costs from BOM
        bom = db.query(models.BillOfMaterial).filter(
            models.BillOfMaterial.item_id == wo.item_id,
            models.BillOfMaterial.status == 'ACTIVE',
            models.BillOfMaterial.is_deleted == False
        ).first()
        
        std_material_cost = Decimal("0.00")
        if bom:
            for line in bom.line_items:
                # Resolve item cost
                item = db.query(models.Item).filter_by(id=line.component_item_id).first()
                rate = Decimal(str(item.unit_price)) if item and item.unit_price else Decimal("10.00")
                std_material_cost += Decimal(str(line.quantity)) * Decimal(str(wo.quantity)) * rate

        # Standard Routing operations costs
        routing = db.query(models.Routing).filter(
            models.Routing.item_id == wo.item_id,
            models.Routing.status == 'ACTIVE',
            models.Routing.is_deleted == False
        ).first()
        
        std_labor_cost = Decimal("0.00")
        std_overhead_cost = Decimal("0.00")
        if routing:
            for op in routing.operations:
                wc = db.query(models.WorkCenter).filter_by(id=op.work_center_id).first()
                cost_hr = Decimal(str(wc.cost_per_hour)) if wc and wc.cost_per_hour else Decimal("15.00")
                hours = Decimal(op.setup_time_minutes + op.run_time_minutes) / Decimal("60.0")
                std_labor_cost += hours * Decimal("25.00") * Decimal(str(wo.quantity))
                std_overhead_cost += hours * cost_hr * Decimal(str(wo.quantity))
                
        # Actual Costs from G/L postings
        accounts = ManufacturingAccountingService.get_manufacturing_accounts(db, tenant_id)
        
        # Actual Materials
        mat_lines = db.query(models.JournalLine.debit_amount).join(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "WORK_ORDER",
            models.JournalEntry.reference_id == work_order_id,
            models.JournalEntry.source_event == "material_issue",
            models.JournalLine.account_id == accounts["wip"],
            models.JournalLine.is_deleted == False
        ).all()
        actual_material_cost = sum(line.debit_amount for line in mat_lines)
        
        # Actual Labor
        lab_lines = db.query(models.JournalLine.debit_amount).join(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "WORK_ORDER",
            models.JournalEntry.reference_id == work_order_id,
            models.JournalEntry.source_event == "labor_booking",
            models.JournalLine.account_id == accounts["wip"],
            models.JournalLine.is_deleted == False
        ).all()
        actual_labor_cost = sum(line.debit_amount for line in lab_lines)

        # Actual Overhead
        ovh_lines = db.query(models.JournalLine.debit_amount).join(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "WORK_ORDER",
            models.JournalEntry.reference_id == work_order_id,
            models.JournalEntry.source_event == "overhead_booking",
            models.JournalLine.account_id == accounts["wip"],
            models.JournalLine.is_deleted == False
        ).all()
        actual_overhead_cost = sum(line.debit_amount for line in ovh_lines)
        
        # Actual Scrap
        scrap_lines = db.query(models.JournalLine.debit_amount).join(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "WORK_ORDER",
            models.JournalEntry.reference_id == work_order_id,
            models.JournalEntry.source_event == "scrap_posting",
            models.JournalLine.account_id == accounts["scrap_variance"],
            models.JournalLine.is_deleted == False
        ).all()
        actual_scrap_cost = sum(line.debit_amount for line in scrap_lines)

        # Variance Calculation (Actual - Standard)
        mat_var = actual_material_cost - std_material_cost
        lab_var = actual_labor_cost - std_labor_cost
        ovh_var = actual_overhead_cost - std_overhead_cost
        yield_var = actual_scrap_cost # Scrap creates yield loss variance
        
        def classify(v):
            return "Unfavorable" if v > 0 else "Favorable"

        return {
            "wo_number": wo.wo_number,
            "item_id": wo.item_id,
            "material_variance": {
                "actual": actual_material_cost,
                "standard": std_material_cost,
                "variance": mat_var,
                "classification": classify(mat_var)
            },
            "labor_variance": {
                "actual": actual_labor_cost,
                "standard": std_labor_cost,
                "variance": lab_var,
                "classification": classify(lab_var)
            },
            "overhead_variance": {
                "actual": actual_overhead_cost,
                "standard": std_overhead_cost,
                "variance": ovh_var,
                "classification": classify(ovh_var)
            },
            "yield_variance": {
                "actual": actual_scrap_cost,
                "standard": Decimal("0.00"),
                "variance": yield_var,
                "classification": classify(yield_var)
            },
            "total_variance": mat_var + lab_var + ovh_var + yield_var
        }

    @classmethod
    def get_bom_cost_explosion(cls, db: Session, bom_id: uuid.UUID) -> Dict[str, Any]:
        """Rolls up the total standard cost of a BOM including material and operation costs."""
        bom = db.query(models.BillOfMaterial).filter_by(id=bom_id).first()
        if not bom:
            raise ValueError("BOM not found")
            
        lines_costs = []
        total_mat_cost = Decimal("0.00")
        
        for line in bom.line_items:
            item = db.query(models.Item).filter_by(id=line.component_item_id).first()
            rate = Decimal(str(item.unit_price)) if item and item.unit_price else Decimal("10.00")
            line_cost = line.quantity * rate * (1 + line.scrap_factor)
            total_mat_cost += line_cost
            lines_costs.append({
                "component_item_id": line.component_item_id,
                "quantity": line.quantity,
                "scrap_factor": line.scrap_factor,
                "unit_cost": rate,
                "total_cost": line_cost
            })
            
        # Routing operations rollup
        routing = db.query(models.Routing).filter(
            models.Routing.item_id == bom.item_id,
            models.Routing.status == 'ACTIVE',
            models.Routing.is_deleted == False
        ).first()
        
        ops_costs = []
        total_lab_cost = Decimal("0.00")
        total_ovh_cost = Decimal("0.00")
        
        if routing:
            for op in routing.operations:
                wc = db.query(models.WorkCenter).filter_by(id=op.work_center_id).first()
                cost_hr = Decimal(str(wc.cost_per_hour)) if wc and wc.cost_per_hour else Decimal("15.00")
                hours = Decimal(op.setup_time_minutes + op.run_time_minutes) / Decimal("60.0")
                
                lab_cost = hours * Decimal("25.00")
                ovh_cost = hours * cost_hr
                
                total_lab_cost += lab_cost
                total_ovh_cost += ovh_cost
                
                ops_costs.append({
                    "operation_name": op.operation_name,
                    "work_center_id": op.work_center_id,
                    "labor_cost": lab_cost,
                    "overhead_cost": ovh_cost
                })
                
        return {
            "bom_number": bom.bom_number,
            "revision": bom.revision,
            "components": lines_costs,
            "operations": ops_costs,
            "rolled_up_material_cost": total_mat_cost,
            "rolled_up_labor_cost": total_lab_cost,
            "rolled_up_overhead_cost": total_ovh_cost,
            "total_standard_cost": total_mat_cost + total_lab_cost + total_ovh_cost
        }
