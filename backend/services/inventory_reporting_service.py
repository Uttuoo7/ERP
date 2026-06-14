import uuid
from decimal import Decimal
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend import models

class InventoryReportingService:
    @staticmethod
    def get_ledger_report(
        db: Session,
        start_date: datetime,
        end_date: datetime,
        item_id: Optional[uuid.UUID] = None,
        warehouse_id: Optional[uuid.UUID] = None
    ) -> List[dict]:
        query = db.query(models.InventoryTransactionLine).join(models.InventoryTransaction).filter(
            models.InventoryTransaction.created_at >= start_date,
            models.InventoryTransaction.created_at <= end_date,
            models.InventoryTransactionLine.is_deleted == False
        )
        if item_id:
            query = query.filter(models.InventoryTransactionLine.item_id == item_id)
        if warehouse_id:
            query = query.filter(models.InventoryTransactionLine.warehouse_id == warehouse_id)
        
        lines = query.order_by(models.InventoryTransaction.created_at.asc()).all()
        
        report = []
        for line in lines:
            tx = line.transaction
            report.append({
                "id": str(line.id),
                "transaction_id": str(line.transaction_id),
                "transaction_number": tx.transaction_number if tx else None,
                "transaction_type": tx.transaction_type if tx else None,
                "item_id": str(line.item_id),
                "sku": line.item.sku if line.item else "",
                "item_name": line.item.name if line.item else "",
                "warehouse_id": str(line.warehouse_id) if line.warehouse_id else "",
                "warehouse_name": line.warehouse.name if line.warehouse else "",
                "quantity": float(line.quantity),
                "unit_cost": float(line.valuation_unit_cost),
                "total_value": float(line.quantity * line.valuation_unit_cost),
                "created_at": tx.created_at if tx else None,
                "reference_type": tx.reference_type if tx else None,
                "reference_id": str(tx.reference_id) if tx and tx.reference_id else None
            })
        return report

    @staticmethod
    def get_valuation_report(db: Session, warehouse_id: Optional[uuid.UUID] = None) -> dict:
        query = db.query(models.InventoryCostLayer).filter(
            models.InventoryCostLayer.remaining_quantity != 0,
            models.InventoryCostLayer.is_deleted == False
        )
        if warehouse_id:
            query = query.filter(models.InventoryCostLayer.warehouse_id == warehouse_id)
            
        layers = query.all()
        
        items_map = {}
        warehouse_totals = {}
        category_totals = {}
        company_total_value = Decimal("0.0")
        
        for l in layers:
            item = l.item
            item_id = str(l.item_id)
            qty = l.remaining_quantity
            val = qty * l.unit_cost
            wh_name = l.warehouse.name if l.warehouse else "Unknown Warehouse"
            cat_name = item.category if item and item.category else "Uncategorized"
            
            company_total_value += val
            warehouse_totals[wh_name] = warehouse_totals.get(wh_name, Decimal("0.0")) + val
            category_totals[cat_name] = category_totals.get(cat_name, Decimal("0.0")) + val
            
            if item_id not in items_map:
                items_map[item_id] = {
                    "item_id": item_id,
                    "sku": item.sku if item else "",
                    "name": item.name if item else "",
                    "quantity_on_hand": Decimal("0.0"),
                    "total_value": Decimal("0.0"),
                    "category_name": cat_name,
                    "warehouse_name": wh_name
                }
            items_map[item_id]["quantity_on_hand"] += qty
            items_map[item_id]["total_value"] += val
            
        formatted_items = []
        for i_data in items_map.values():
            qty = i_data["quantity_on_hand"]
            val = i_data["total_value"]
            formatted_items.append({
                "item_id": i_data["item_id"],
                "sku": i_data["sku"],
                "name": i_data["name"],
                "quantity_on_hand": float(qty),
                "unit_cost": float(val / qty) if qty > 0 else 0.0,
                "inventory_value": float(val),
                "category_name": i_data["category_name"],
                "warehouse_name": i_data["warehouse_name"]
            })
            
        return {
            "items": formatted_items,
            "warehouse_totals": {k: float(v) for k, v in warehouse_totals.items()},
            "category_totals": {k: float(v) for k, v in category_totals.items()},
            "company_total_value": float(company_total_value)
        }

    @staticmethod
    def get_turnover_report(db: Session, start_date: datetime, end_date: datetime) -> dict:
        # COGS from posted inventory issues
        cogs_sum = db.query(func.sum(models.InventoryIssueLine.total_cost)).join(models.InventoryIssue).filter(
            models.InventoryIssue.status == "POSTED",
            models.InventoryIssue.issue_date >= start_date,
            models.InventoryIssue.issue_date <= end_date,
            models.InventoryIssue.is_deleted == False
        ).scalar() or Decimal("0.0")
        
        # Average inventory value from snapshots
        snapshots = db.query(models.InventorySnapshot).filter(
            models.InventorySnapshot.snapshot_date >= start_date,
            models.InventorySnapshot.snapshot_date <= end_date,
            models.InventorySnapshot.is_deleted == False
        ).all()
        
        avg_inv = Decimal("0.0")
        if snapshots:
            avg_inv = sum(s.inventory_value for s in snapshots) / Decimal(len(snapshots))
        else:
            # Fallback to current inventory value
            layers = db.query(models.InventoryCostLayer).filter(models.InventoryCostLayer.is_deleted == False).all()
            avg_inv = sum(l.remaining_quantity * l.unit_cost for l in layers)
            
        turnover_ratio = float(cogs_sum / avg_inv) if avg_inv > 0 else 0.0
        turnover_days = 365.0 / turnover_ratio if turnover_ratio > 0 else 365.0
        
        return {
            "cogs": float(cogs_sum),
            "average_inventory": float(avg_inv),
            "turnover_ratio": round(turnover_ratio, 2),
            "turnover_days": round(turnover_days, 1)
        }

    @staticmethod
    def get_exposure_report(db: Session) -> dict:
        # Obsolete / Slow moving / Dead stock analysis
        from datetime import datetime
        items = db.query(models.Item).filter_by(is_deleted=False).all()
        slow_moving = []
        dead_stock = []
        obsolete_stock = []
        exposure_items = []
        
        # Query last issue dates
        last_issues = db.query(
            models.InventoryValuationEntry.item_id,
            func.max(models.InventoryValuationEntry.created_at).label("last_date")
        ).filter(
            models.InventoryValuationEntry.transaction_type == "CONSUMPTION",
            models.InventoryValuationEntry.is_deleted == False
        ).group_by(models.InventoryValuationEntry.item_id).all()
        last_issue_map = {li.item_id: li.last_date for li in last_issues}
        
        current_time = datetime.utcnow()
        
        for item in items:
            item_layers = db.query(models.InventoryCostLayer).filter_by(
                item_id=item.id,
                is_deleted=False
            ).all()
            qty = sum(l.remaining_quantity for l in item_layers)
            val = sum(l.remaining_quantity * l.unit_cost for l in item_layers)
            
            if qty > 0:
                last_issue_date = last_issue_map.get(item.id)
                days_since_issue = (current_time - last_issue_date).days if last_issue_date else 9999
                
                item_info = {
                    "item_id": str(item.id),
                    "sku": item.sku,
                    "name": item.name,
                    "quantity_on_hand": float(qty),
                    "inventory_value": float(val),
                    "days_since_last_issue": days_since_issue
                }
                
                if days_since_issue >= 30 and days_since_issue < 90:
                    slow_moving.append(item_info)
                elif days_since_issue >= 90 and days_since_issue < 180:
                    dead_stock.append(item_info)
                elif days_since_issue >= 180:
                    obsolete_stock.append(item_info)
                    
                po_lines = db.query(models.POLineItem).join(models.PurchaseOrder).filter(
                    models.POLineItem.item_id == item.id,
                    models.PurchaseOrder.status == "APPROVED",
                    models.PurchaseOrder.is_deleted == False
                ).all()
                open_po_val = sum((line.quantity - getattr(line, "received_quantity", 0) or 0) * line.unit_price for line in po_lines)
                exposure_items.append({
                    "sku": item.sku,
                    "name": item.name,
                    "inventory_value": float(val),
                    "po_commitment": float(open_po_val),
                    "total_exposure": float(val + open_po_val)
                })
                
        return {
            "slow_moving": slow_moving,
            "dead_stock": dead_stock,
            "obsolete_stock": obsolete_stock,
            "exposure": sorted(exposure_items, key=lambda x: x["total_exposure"], reverse=True)[:10]
        }

    @staticmethod
    def get_consumption_report(
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[dict]:
        query = db.query(models.InventoryIssueLine).join(models.InventoryIssue).filter(
            models.InventoryIssue.status == "POSTED",
            models.InventoryIssue.is_deleted == False
        )
        if start_date:
            query = query.filter(models.InventoryIssue.issue_date >= start_date)
        if end_date:
            query = query.filter(models.InventoryIssue.issue_date <= end_date)
            
        lines = query.all()
        
        groups = {}
        for line in lines:
            issue = line.issue
            item = line.item
            dept_name = issue.department.name if issue.department else "No Department"
            wh_name = issue.warehouse.name if issue.warehouse else "No Warehouse"
            cat_name = item.category if item and item.category else "Uncategorized"
            item_name = item.name if item else "Unknown"
            item_sku = item.sku if item else "Unknown"
            
            key = (dept_name, wh_name, cat_name, item_sku)
            if key not in groups:
                groups[key] = {
                    "department": dept_name,
                    "warehouse": wh_name,
                    "category": cat_name,
                    "sku": item_sku,
                    "item_name": item_name,
                    "qty_issued": Decimal("0.0"),
                    "total_cost": Decimal("0.0"),
                    "costing_method": line.costing_method_used or "FIFO"
                }
            groups[key]["qty_issued"] += line.quantity
            groups[key]["total_cost"] += line.total_cost
            
        report = []
        for key, data in groups.items():
            report.append({
                "department": data["department"],
                "warehouse": data["warehouse"],
                "category": data["category"],
                "sku": data["sku"],
                "item_name": data["item_name"],
                "quantity_issued": float(data["qty_issued"]),
                "consumption_cost": float(data["total_cost"]),
                "costing_method": data["costing_method"]
            })
        return report

    @staticmethod
    def get_closing_certificate(db: Session, period_id: uuid.UUID) -> dict:
        period = db.query(models.AccountingPeriod).filter_by(id=period_id).first()
        if not period:
            raise ValueError("Period not found")
            
        subledger_total = db.query(
            func.sum(models.InventoryCostLayer.remaining_quantity * models.InventoryCostLayer.unit_cost)
        ).filter(
            models.InventoryCostLayer.is_deleted == False
        ).scalar() or Decimal("0.0")

        account_1200 = db.query(models.Account).filter(models.Account.code == "1200", models.Account.is_deleted == False).first()
        gl_balance = Decimal("0.0")
        if account_1200:
            debit_sum = db.query(func.sum(models.JournalLine.debit_amount)).filter(
                models.JournalLine.account_id == account_1200.id,
                models.JournalLine.is_deleted == False
            ).scalar() or Decimal("0.0")
            credit_sum = db.query(func.sum(models.JournalLine.credit_amount)).filter(
                models.JournalLine.account_id == account_1200.id,
                models.JournalLine.is_deleted == False
            ).scalar() or Decimal("0.0")
            gl_balance = debit_sum - credit_sum

        variance = abs(Decimal(str(subledger_total)) - Decimal(str(gl_balance)))
        
        # Check if there are any open documents to determine validation status
        neg_stock_exists = db.query(models.WarehouseStock).filter(
            models.WarehouseStock.quantity_on_hand < 0,
            models.WarehouseStock.is_deleted == False
        ).first() is not None

        open_adj_exists = db.query(models.InventoryAdjustment).filter(
            models.InventoryAdjustment.status.in_(["DRAFT", "SUBMITTED"]),
            models.InventoryAdjustment.created_at >= period.start_date,
            models.InventoryAdjustment.created_at <= period.end_date,
            models.InventoryAdjustment.is_deleted == False
        ).first() is not None

        open_cc_exists = db.query(models.CycleCount).filter(
            models.CycleCount.status.in_(["DRAFT", "PENDING_APPROVAL"]),
            models.CycleCount.count_date >= period.start_date,
            models.CycleCount.count_date <= period.end_date,
            models.CycleCount.is_deleted == False
        ).first() is not None

        open_trf_exists = db.query(models.InventoryTransfer).filter(
            models.InventoryTransfer.status == "IN_TRANSIT",
            models.InventoryTransfer.created_at >= period.start_date,
            models.InventoryTransfer.created_at <= period.end_date,
            models.InventoryTransfer.is_deleted == False
        ).first() is not None

        # Check snapshots
        curr_date = period.start_date.date()
        end_date = period.end_date.date()
        snapshots_ok = True
        while curr_date <= end_date:
            snapshot_exists = db.query(models.InventorySnapshot).filter(
                func.date(models.InventorySnapshot.snapshot_date) == curr_date,
                models.InventorySnapshot.is_deleted == False
            ).first() is not None
            if not snapshot_exists:
                snapshots_ok = False
                break
            curr_date += timedelta(days=1)

        # Check Trial Balance
        tb_ok = True
        try:
            from backend.services.accounting_service import AccountingService
            AccountingService.validate_trial_balance(db)
        except Exception:
            tb_ok = False

        unposted_issues_exists = db.query(models.InventoryIssue).filter(
            models.InventoryIssue.status.in_(["DRAFT", "SUBMITTED", "APPROVED"]),
            models.InventoryIssue.issue_date >= period.start_date,
            models.InventoryIssue.issue_date <= period.end_date,
            models.InventoryIssue.is_deleted == False
        ).first() is not None

        return {
            "period_name": period.period_name,
            "status": period.status,
            "start_date": period.start_date.strftime("%Y-%m-%d"),
            "end_date": period.end_date.strftime("%Y-%m-%d"),
            "subledger_total": float(subledger_total),
            "gl_balance": float(gl_balance),
            "variance": float(variance),
            "validations": {
                "no_negative_inventory": not neg_stock_exists,
                "subledger_gl_reconciliation": variance <= Decimal("0.001"),
                "no_open_adjustments": not open_adj_exists,
                "no_open_cycle_counts": not open_cc_exists,
                "no_in_transit_transfers": not open_trf_exists,
                "all_snapshots_exist": snapshots_ok,
                "trial_balance_balanced": tb_ok,
                "all_issues_posted": not unposted_issues_exists
            }
        }
