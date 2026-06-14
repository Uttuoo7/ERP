import uuid
import logging
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from backend import models, schemas, inventory_engine
from backend.core.exceptions import EntityNotFoundException, StockInsufficiencyError

logger = logging.getLogger(__name__)

class InventoryService:
    """
    Decoupled Service Layer for Inventory processing, stock balances, and ledger adjustments.
    Enforces multi-tenant query safety and integrates with the acid inventory transaction engine.
    """

    @staticmethod
    def get_warehouse_stock_balances(
        db: Session,
        warehouse_id: Optional[uuid.UUID] = None,
        item_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None
    ) -> List[models.WarehouseStock]:
        """Fetch current stock levels across warehouses based on query parameters."""
        query = db.query(models.WarehouseStock)
        
        if warehouse_id:
            query = query.filter(models.WarehouseStock.warehouse_id == warehouse_id)
        if item_id:
            query = query.filter(models.WarehouseStock.item_id == item_id)
        if search:
            query = query.join(models.Item).filter(
                (models.Item.sku.ilike(f"%{search}%")) | (models.Item.name.ilike(f"%{search}%"))
            )
            
        return query.order_by(models.WarehouseStock.quantity_on_hand.desc()).all()

    @staticmethod
    def get_stock_ledger_history(
        db: Session,
        warehouse_id: Optional[uuid.UUID] = None,
        item_id: Optional[uuid.UUID] = None,
        transaction_type: Optional[str] = None
    ) -> List[models.StockLedgerEntry]:
        """Fetch full chronological audits of inventory movements."""
        query = db.query(models.StockLedgerEntry)
        
        if warehouse_id:
            query = query.filter(models.StockLedgerEntry.warehouse_id == warehouse_id)
        if item_id:
            query = query.filter(models.StockLedgerEntry.item_id == item_id)
        if transaction_type:
            query = query.filter(models.StockLedgerEntry.transaction_type == transaction_type)
            
        return query.order_by(models.StockLedgerEntry.created_at.desc()).all()

    @staticmethod
    def get_inventory_batches(db: Session, item_id: Optional[uuid.UUID] = None) -> List[models.InventoryBatch]:
        """Fetch tracking lots/batches assigned to raw components or items."""
        query = db.query(models.InventoryBatch)
        if item_id:
            query = query.filter(models.InventoryBatch.item_id == item_id)
        return query.order_by(models.InventoryBatch.created_at.desc()).all()

    @staticmethod
    def get_inventory_serials(
        db: Session,
        item_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None
    ) -> List[models.InventorySerial]:
        """Fetch serial numbers tracked across warehouses."""
        query = db.query(models.InventorySerial)
        if item_id:
            query = query.filter(models.InventorySerial.item_id == item_id)
        if status_filter:
            query = query.filter(models.InventorySerial.status == status_filter)
        return query.all()

    @staticmethod
    def record_manual_adjustment(
        db: Session,
        payload: schemas.StockAdjustmentCreate,
        user_id: uuid.UUID
    ) -> models.StockLedgerEntry:
        """
        Executes an administrative stock level override.
        Delegates transactional balance logs to the ACID inventory engine.
        """
        try:
            # Check item exists
            item = db.query(models.Item).filter(models.Item.id == payload.item_id).first()
            if not item:
                raise EntityNotFoundException(f"Item with ID {payload.item_id} not found.")

            # Check warehouse exists
            warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == payload.warehouse_id).first()
            if not warehouse:
                raise EntityNotFoundException(f"Warehouse with ID {payload.warehouse_id} not found.")

            ledger = inventory_engine.record_adjustment(
                db=db,
                item_id=payload.item_id,
                warehouse_id=payload.warehouse_id,
                qty_change=payload.qty_change,
                unit_cost=payload.valuation_unit_cost,
                batch_number=payload.batch_number,
                expiry_date=payload.expiry_date,
                serial_numbers=payload.serial_numbers,
                reference_id=uuid.uuid4(),
                user_id=user_id,
                remarks=payload.remarks
            )
            db.commit()
            db.refresh(ledger)
            return ledger
        except ValueError as e:
            db.rollback()
            raise StockInsufficiencyError(str(e))
        except Exception as e:
            db.rollback()
            logger.error(f"Manual Stock Adjustment failure: {str(e)}")
            raise e

    @staticmethod
    def get_revaluations(db: Session) -> List[models.InventoryRevaluation]:
        return db.query(models.InventoryRevaluation).filter_by(is_deleted=False).order_by(models.InventoryRevaluation.created_at.desc()).all()

    @staticmethod
    def propose_revaluation(db: Session, item_id: uuid.UUID, new_cost: float, reason: str, tenant_id: uuid.UUID) -> models.InventoryRevaluation:
        item = db.query(models.Item).filter_by(id=item_id, is_deleted=False).first()
        if not item:
            raise EntityNotFoundException("Item not found.")

        # Get costing method
        costing_method = inventory_engine.get_inventory_costing_method(db, tenant_id)

        # Get old cost
        if costing_method == "STANDARD":
            old_cost = item.standard_rate or Decimal("0.0")
        else:
            qty, val = inventory_engine.get_current_totals(db, item_id, tenant_id)
            old_cost = val / qty if qty > 0 else (item.standard_rate or Decimal("0.0"))

        qty_affected, val_before = inventory_engine.get_current_totals(db, item_id, tenant_id)
        value_difference = Decimal(str(qty_affected)) * (Decimal(str(new_cost)) - Decimal(str(old_cost)))

        reval = models.InventoryRevaluation(
            item_id=item_id,
            old_cost=old_cost,
            new_cost=Decimal(str(new_cost)),
            quantity_affected=qty_affected,
            value_difference=value_difference,
            reason=reason,
            status="DRAFT",
            tenant_id=tenant_id
        )
        db.add(reval)
        db.commit()
        db.refresh(reval)
        return reval

    @staticmethod
    def submit_revaluation(db: Session, reval_id: uuid.UUID) -> models.InventoryRevaluation:
        reval = db.query(models.InventoryRevaluation).filter_by(id=reval_id, is_deleted=False).first()
        if not reval:
            raise EntityNotFoundException("Revaluation not found.")
        reval.status = "SUBMITTED"
        db.commit()
        db.refresh(reval)
        return reval

    @staticmethod
    def approve_revaluation(db: Session, reval_id: uuid.UUID, user_id: uuid.UUID) -> models.InventoryRevaluation:
        reval = db.query(models.InventoryRevaluation).filter_by(id=reval_id, is_deleted=False).first()
        if not reval:
            raise EntityNotFoundException("Revaluation not found.")
        
        if reval.status == "APPROVED":
            return reval

        try:
            # Get costing method
            costing_method = inventory_engine.get_inventory_costing_method(db, reval.tenant_id)

            # 1. Update standard_rate on the item
            item = db.query(models.Item).filter_by(id=reval.item_id).first()
            if item:
                item.standard_rate = reval.new_cost

            # Calculate current stock totals before revaluation
            before_qty, before_val = inventory_engine.get_current_totals(db, reval.item_id, reval.tenant_id)

            # 2. Update all open cost layers unit cost and total cost
            open_layers = db.query(models.InventoryCostLayer).filter(
                models.InventoryCostLayer.item_id == reval.item_id,
                models.InventoryCostLayer.remaining_quantity != 0,
                models.InventoryCostLayer.is_deleted == False
            ).all()
            for l in open_layers:
                l.unit_cost = reval.new_cost
                l.total_cost = l.remaining_quantity * reval.new_cost

            # 3. Update WarehouseStock valuation cost
            wh_stocks = db.query(models.WarehouseStock).filter(
                models.WarehouseStock.item_id == reval.item_id,
                models.WarehouseStock.is_deleted == False
            ).all()
            for ws in wh_stocks:
                ws.valuation_unit_cost = reval.new_cost

            # Calculate after quantities and values
            after_qty, after_val = inventory_engine.get_current_totals(db, reval.item_id, reval.tenant_id)

            # 4. Write Valuation Entry (adjustment transaction)
            val_entry = models.InventoryValuationEntry(
                item_id=reval.item_id,
                warehouse_id=open_layers[0].warehouse_id if open_layers else None,
                transaction_type="ADJUSTMENT",
                running_inventory_qty=after_qty,
                running_inventory_value=after_val,
                quantity=Decimal("0.0"),
                unit_cost=reval.new_cost - reval.old_cost,
                total_value=reval.value_difference,
                costing_method_used=costing_method,
                reference_type="REVALUATION",
                reference_id=reval.id,
                created_at=datetime.utcnow(),
                tenant_id=reval.tenant_id
            )
            db.add(val_entry)

            # 5. Write Audit Log
            inventory_engine.create_audit_log(
                db=db,
                item_id=reval.item_id,
                warehouse_id=open_layers[0].warehouse_id if open_layers else None,
                action_type="REVALUATION",
                before_qty=before_qty,
                after_qty=after_qty,
                before_val=before_val,
                after_val=after_val,
                reference_type="REVALUATION",
                reference_id=reval.id,
                performed_by=user_id,
                tenant_id=reval.tenant_id
            )

            reval.status = "APPROVED"
            reval.approved_by = user_id
            reval.approved_at = datetime.utcnow()
            db.flush()

            # 6. Post G/L entries (do not commit inside posting engine)
            from backend.services.posting_engine import PostingEngine
            PostingEngine.post_inventory_revaluation(db, reval, commit=False)

            db.commit()
            db.refresh(reval)
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to approve revaluation: {str(e)}")
            raise e

        return reval


    @staticmethod
    def reject_revaluation(db: Session, reval_id: uuid.UUID) -> models.InventoryRevaluation:
        reval = db.query(models.InventoryRevaluation).filter_by(id=reval_id, is_deleted=False).first()
        if not reval:
            raise EntityNotFoundException("Revaluation not found.")
        reval.status = "REJECTED"
        db.commit()
        db.refresh(reval)
        return reval

    @staticmethod
    def get_snapshots(db: Session) -> List[models.InventorySnapshot]:
        return db.query(models.InventorySnapshot).filter_by(is_deleted=False).order_by(models.InventorySnapshot.snapshot_date.desc()).all()

    @staticmethod
    def generate_snapshot(db: Session, snapshot_date: datetime, warehouse_id: Optional[uuid.UUID] = None, tenant_id: Optional[uuid.UUID] = None) -> models.InventorySnapshot:
        if not tenant_id:
            from backend.database import get_current_tenant_id
            tenant_id = get_current_tenant_id()

        total_qty = Decimal("0.0")
        total_val = Decimal("0.0")
        item_ids = set()

        val_query = db.query(models.InventoryValuationEntry).filter(
            models.InventoryValuationEntry.created_at <= snapshot_date,
            models.InventoryValuationEntry.is_deleted == False
        )
        if tenant_id:
            val_query = val_query.filter(models.InventoryValuationEntry.tenant_id == tenant_id)
        if warehouse_id:
            val_query = val_query.filter(models.InventoryValuationEntry.warehouse_id == warehouse_id)

        entries = val_query.all()
        
        item_entries = {}
        for entry in entries:
            item_entries.setdefault(entry.item_id, []).append(entry)

        for item_id, item_entries in item_entries.items():
            item_entries.sort(key=lambda x: x.created_at)
            last_entry = item_entries[-1]
            qty_on_date = last_entry.running_inventory_qty
            val_on_date = last_entry.running_inventory_value
            if qty_on_date > 0:
                total_qty += qty_on_date
                total_val += val_on_date
                item_ids.add(item_id)

        snapshot = models.InventorySnapshot(
            snapshot_date=snapshot_date,
            warehouse_id=warehouse_id,
            inventory_value=total_val,
            inventory_quantity=total_qty,
            item_count=len(item_ids),
            tenant_id=tenant_id
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot

    @staticmethod
    def get_snapshot_details(db: Session, snapshot_id: uuid.UUID) -> List[dict]:
        snapshot = db.query(models.InventorySnapshot).filter_by(id=snapshot_id).first()
        if not snapshot:
            raise EntityNotFoundException("Snapshot not found.")
        
        val_query = db.query(models.InventoryValuationEntry).filter(
            models.InventoryValuationEntry.created_at <= snapshot.snapshot_date,
            models.InventoryValuationEntry.is_deleted == False
        )
        if snapshot.tenant_id:
            val_query = val_query.filter(models.InventoryValuationEntry.tenant_id == snapshot.tenant_id)
        if snapshot.warehouse_id:
            val_query = val_query.filter(models.InventoryValuationEntry.warehouse_id == snapshot.warehouse_id)

        entries = val_query.all()
        
        item_entries = {}
        for entry in entries:
            item_entries.setdefault(entry.item_id, []).append(entry)

        items_map = {item.id: item for item in db.query(models.Item).all()}
        details = []

        for item_id, entries_list in item_entries.items():
            entries_list.sort(key=lambda x: x.created_at)
            last_entry = entries_list[-1]
            qty = last_entry.running_inventory_qty
            val = last_entry.running_inventory_value
            if qty > 0:
                item = items_map.get(item_id)
                details.append({
                    "item_id": str(item_id),
                    "sku": item.sku if item else "UNKNOWN",
                    "name": item.name if item else "UNKNOWN",
                    "category": item.category if item else "Uncategorized",
                    "quantity_on_hand": float(qty),
                    "unit_cost": float(val / qty) if qty > 0 else 0.0,
                    "inventory_value": float(val)
                })
        return details

    @staticmethod
    def restore_snapshot(db: Session, snapshot_id: uuid.UUID) -> bool:
        snapshot = db.query(models.InventorySnapshot).filter_by(id=snapshot_id).first()
        if not snapshot:
            raise EntityNotFoundException("Snapshot not found.")

        snapshot_date = snapshot.snapshot_date

        cost_layers_after = db.query(models.InventoryCostLayer).filter(
            models.InventoryCostLayer.created_at > snapshot_date
        ).all()
        for layer in cost_layers_after:
            layer.is_deleted = True

        cost_layers_before = db.query(models.InventoryCostLayer).filter(
            models.InventoryCostLayer.created_at <= snapshot_date
        ).all()

        items = db.query(models.Item).all()
        for item in items:
            layers = db.query(models.InventoryCostLayer).filter(
                models.InventoryCostLayer.item_id == item.id,
                models.InventoryCostLayer.created_at <= snapshot_date
            ).order_by(models.InventoryCostLayer.created_at.asc()).all()

            for l in layers:
                l.remaining_quantity = l.original_quantity
                l.layer_status = "OPEN"
                l.is_deleted = False

            issues_val = db.query(models.InventoryValuationEntry).filter(
                models.InventoryValuationEntry.item_id == item.id,
                models.InventoryValuationEntry.transaction_type == "CONSUMPTION",
                models.InventoryValuationEntry.created_at <= snapshot_date,
                models.InventoryValuationEntry.is_deleted == False
            ).all()
            total_qty_to_deplete = sum(abs(i.quantity) for i in issues_val)

            for l in layers:
                if total_qty_to_deplete <= 0:
                    break
                consume = min(total_qty_to_deplete, l.remaining_quantity)
                l.remaining_quantity -= consume
                total_qty_to_deplete -= consume
                if l.remaining_quantity == 0:
                    l.layer_status = "CONSUMED"
                else:
                    l.layer_status = "PARTIALLY_CONSUMED"

        db.query(models.InventoryValuationEntry).filter(models.InventoryValuationEntry.created_at > snapshot_date).update({models.InventoryValuationEntry.is_deleted: True}, synchronize_session=False)
        db.query(models.InventoryAuditLog).filter(models.InventoryAuditLog.created_at > snapshot_date).update({models.InventoryAuditLog.is_deleted: True}, synchronize_session=False)
        db.query(models.StockLedgerEntry).filter(models.StockLedgerEntry.created_at > snapshot_date).update({models.StockLedgerEntry.is_deleted: True}, synchronize_session=False)
        db.query(models.StockLedger).filter(models.StockLedger.created_at > snapshot_date).update({models.StockLedger.is_deleted: True}, synchronize_session=False)
        db.query(models.InventoryTransaction).filter(models.InventoryTransaction.created_at > snapshot_date).update({models.InventoryTransaction.is_deleted: True}, synchronize_session=False)

        # Flush cost layer mutations and updates to the DB so queries below reflect them
        db.flush()

        db.query(models.WarehouseStock).update({models.WarehouseStock.quantity_on_hand: 0}, synchronize_session="fetch")
        open_layers = db.query(models.InventoryCostLayer).filter(models.InventoryCostLayer.is_deleted == False).all()
        
        wh_stock_map = {}
        for l in open_layers:
            key = (l.item_id, l.warehouse_id)
            wh_stock_map[key] = wh_stock_map.get(key, Decimal("0.0")) + l.remaining_quantity

        for (item_id, wh_id), qty in wh_stock_map.items():
            stock = db.query(models.WarehouseStock).filter_by(item_id=item_id, warehouse_id=wh_id, batch_id=None).first()
            if stock:
                stock.quantity_on_hand = int(qty)
            else:
                stock = models.WarehouseStock(
                    item_id=item_id,
                    warehouse_id=wh_id,
                    quantity_on_hand=int(qty),
                    quantity_reserved=0,
                    quantity_damaged=0,
                    quantity_transit=0,
                    valuation_unit_cost=open_layers[0].unit_cost if open_layers else Decimal("0.0"),
                    tenant_id=snapshot.tenant_id
                )
                db.add(stock)

        db.query(models.InventoryLedger).update({models.InventoryLedger.quantity_on_hand: 0}, synchronize_session="fetch")
        item_qty_map = {}
        for l in open_layers:
            item_qty_map[l.item_id] = item_qty_map.get(l.item_id, Decimal("0.0")) + l.remaining_quantity

        for item_id, qty in item_qty_map.items():
            ledger = db.query(models.InventoryLedger).filter_by(item_id=item_id).first()
            if ledger:
                ledger.quantity_on_hand = int(qty)
            else:
                ledger = models.InventoryLedger(
                    item_id=item_id,
                    quantity_on_hand=int(qty),
                    quantity_reserved=0,
                    tenant_id=snapshot.tenant_id
                )
                db.add(ledger)

        db.commit()
        return True

    @staticmethod
    def get_inventory_analytics(db: Session, tenant_id: Optional[uuid.UUID] = None) -> dict:
        if not tenant_id:
            from backend.database import get_current_tenant_id
            tenant_id = get_current_tenant_id()

        from datetime import timedelta
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        cogs_val = db.query(models.InventoryValuationEntry).filter(
            models.InventoryValuationEntry.transaction_type == "CONSUMPTION",
            models.InventoryValuationEntry.created_at >= thirty_days_ago,
            models.InventoryValuationEntry.is_deleted == False
        )
        if tenant_id:
            cogs_val = cogs_val.filter(models.InventoryValuationEntry.tenant_id == tenant_id)
        cogs = abs(sum(i.total_value for i in cogs_val.all()))

        layers_query = db.query(models.InventoryCostLayer).filter(
            models.InventoryCostLayer.remaining_quantity != 0,
            models.InventoryCostLayer.is_deleted == False
        )
        if tenant_id:
            layers_query = layers_query.filter(models.InventoryCostLayer.tenant_id == tenant_id)
        current_value = sum(l.remaining_quantity * l.unit_cost for l in layers_query.all())

        turnover_ratio = float(cogs / current_value) if current_value > 0 else 0.0
        turnover_days = 365.0 / turnover_ratio if turnover_ratio > 0 else 365.0

        items = db.query(models.Item).filter_by(is_deleted=False).all()
        slow_moving = []
        dead_stock = []
        obsolete_stock = []
        exposure_items = []
        
        from sqlalchemy import func
        last_issues = db.query(
            models.InventoryValuationEntry.item_id,
            func.max(models.InventoryValuationEntry.created_at).label("last_date")
        ).filter(
            models.InventoryValuationEntry.transaction_type == "CONSUMPTION",
            models.InventoryValuationEntry.is_deleted == False
        )
        if tenant_id:
            last_issues = last_issues.filter(models.InventoryValuationEntry.tenant_id == tenant_id)
        last_issues = last_issues.group_by(models.InventoryValuationEntry.item_id).all()
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

        snapshots = db.query(models.InventorySnapshot).filter_by(is_deleted=False).order_by(models.InventorySnapshot.snapshot_date.asc()).all()
        warehouses = db.query(models.Warehouse).all()
        wh_name_map = {wh.id: wh.name for wh in warehouses}
        
        trends = {}
        for sn in snapshots:
            date_str = sn.snapshot_date.strftime("%Y-%m-%d")
            wh_name = wh_name_map.get(sn.warehouse_id) if sn.warehouse_id else "All Warehouses"
            trends.setdefault(date_str, {})[wh_name] = float(sn.inventory_value)

        formatted_trends = []
        for d, wh_vals in trends.items():
            formatted_trends.append({
                "date": d,
                **wh_vals
            })

        return {
            "turnover_ratio": round(turnover_ratio, 2),
            "turnover_days": round(turnover_days, 1),
            "slow_moving": slow_moving,
            "dead_stock": dead_stock,
            "obsolete_stock": obsolete_stock,
            "exposure": sorted(exposure_items, key=lambda x: x["total_exposure"], reverse=True)[:10],
            "trends": formatted_trends
        }

    @staticmethod
    def get_adjustments(
        db: Session,
        status: Optional[str] = None,
        warehouse_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[models.InventoryAdjustment]:
        query = db.query(models.InventoryAdjustment)
        if status:
            query = query.filter(models.InventoryAdjustment.status == status)
        if warehouse_id:
            query = query.filter(models.InventoryAdjustment.warehouse_id == warehouse_id)
        return query.order_by(models.InventoryAdjustment.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def propose_adjustment(
        db: Session,
        payload: schemas.InventoryAdjustmentCreate,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID
    ) -> models.InventoryAdjustment:
        item = db.query(models.Item).filter_by(id=payload.item_id, is_deleted=False).first()
        if not item:
            raise EntityNotFoundException("Item not found.")
        if payload.warehouse_id:
            wh = db.query(models.Warehouse).filter_by(id=payload.warehouse_id).first()
            if not wh:
                raise EntityNotFoundException("Warehouse not found.")

        adj = models.InventoryAdjustment(
            item_id=payload.item_id,
            warehouse_id=payload.warehouse_id,
            qty_change=payload.qty_change,
            unit_cost=payload.unit_cost,
            reason_code=payload.reason_code,
            remarks=payload.remarks,
            status="DRAFT",
            created_by_id=user_id,
            tenant_id=tenant_id
        )
        db.add(adj)
        db.commit()
        db.refresh(adj)
        return adj

    @staticmethod
    def submit_adjustment(db: Session, adj_id: uuid.UUID) -> models.InventoryAdjustment:
        adj = db.query(models.InventoryAdjustment).filter_by(id=adj_id).first()
        if not adj:
            raise EntityNotFoundException("Adjustment not found.")
        if adj.status != "DRAFT":
            raise ValueError("Only DRAFT adjustments can be submitted.")
        adj.status = "SUBMITTED"
        db.commit()
        db.refresh(adj)
        return adj

    @staticmethod
    def approve_adjustment(db: Session, adj_id: uuid.UUID, user_id: uuid.UUID) -> models.InventoryAdjustment:
        adj = db.query(models.InventoryAdjustment).filter_by(id=adj_id).first()
        if not adj:
            raise EntityNotFoundException("Adjustment not found.")
        if adj.status == "APPROVED":
            return adj
        if adj.status != "SUBMITTED":
            raise ValueError("Only SUBMITTED adjustments can be approved.")

        try:
            # 1. Execute stock adjustment
            ledger_entry = inventory_engine.record_adjustment(
                db=db,
                item_id=adj.item_id,
                warehouse_id=adj.warehouse_id,
                qty_change=int(adj.qty_change),
                unit_cost=adj.unit_cost,
                reference_id=adj.id,
                user_id=user_id,
                remarks=adj.remarks
            )
            
            # 2. Write operational audit log
            after_qty, after_val = inventory_engine.get_current_totals(db, adj.item_id, adj.tenant_id)
            before_qty = after_qty - adj.qty_change
            if before_qty == 0:
                before_val = Decimal("0.0")
            elif adj.qty_change > 0:
                before_val = after_val - (adj.qty_change * adj.unit_cost)
            else:
                before_val = after_val - (adj.qty_change * ledger_entry.valuation_unit_cost)

            inventory_engine.create_audit_log(
                db=db,
                item_id=adj.item_id,
                warehouse_id=adj.warehouse_id,
                action_type="ADJUSTMENT",
                before_qty=before_qty,
                after_qty=after_qty,
                before_val=before_val,
                after_val=after_val,
                reference_type="ADJUSTMENT",
                reference_id=adj.id,
                performed_by=user_id,
                tenant_id=adj.tenant_id
            )

            adj.status = "APPROVED"
            adj.approved_by = user_id
            adj.approved_at = datetime.utcnow()
            db.flush()

            # 3. Post G/L entries
            from backend.services.posting_engine import PostingEngine
            PostingEngine.post_inventory_adjustment(db, adj, commit=False)

            db.commit()
            db.refresh(adj)
            return adj
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to approve stock adjustment: {str(e)}")
            raise e

    @staticmethod
    def reject_adjustment(db: Session, adj_id: uuid.UUID) -> models.InventoryAdjustment:
        adj = db.query(models.InventoryAdjustment).filter_by(id=adj_id).first()
        if not adj:
            raise EntityNotFoundException("Adjustment not found.")
        if adj.status != "SUBMITTED":
            raise ValueError("Only SUBMITTED adjustments can be rejected.")
        adj.status = "REJECTED"
        db.commit()
        db.refresh(adj)
        return adj

    @staticmethod
    def get_transfers(
        db: Session,
        status: Optional[str] = None,
        source_warehouse_id: Optional[uuid.UUID] = None,
        destination_warehouse_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[models.InventoryTransfer]:
        query = db.query(models.InventoryTransfer)
        if status:
            query = query.filter(models.InventoryTransfer.status == status)
        if source_warehouse_id:
            query = query.filter(models.InventoryTransfer.source_warehouse_id == source_warehouse_id)
        if destination_warehouse_id:
            query = query.filter(models.InventoryTransfer.destination_warehouse_id == destination_warehouse_id)
        return query.order_by(models.InventoryTransfer.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def create_transfer(
        db: Session,
        payload: schemas.InventoryTransferCreate,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID
    ) -> models.InventoryTransfer:
        if payload.source_warehouse_id == payload.destination_warehouse_id:
            raise ValueError("Source and destination warehouses must be different.")

        src_wh = db.query(models.Warehouse).filter_by(id=payload.source_warehouse_id).first()
        dest_wh = db.query(models.Warehouse).filter_by(id=payload.destination_warehouse_id).first()
        if not src_wh or not dest_wh:
            raise EntityNotFoundException("One or both warehouses not found.")

        trf_num = f"TRF-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        
        transfer = models.InventoryTransfer(
            transfer_number=trf_num,
            source_warehouse_id=payload.source_warehouse_id,
            destination_warehouse_id=payload.destination_warehouse_id,
            status="DRAFT",
            remarks=payload.remarks,
            created_by_id=user_id,
            tenant_id=tenant_id
        )
        db.add(transfer)
        db.flush()

        for line_data in payload.line_items:
            item = db.query(models.Item).filter_by(id=line_data.item_id, is_deleted=False).first()
            if not item:
                raise EntityNotFoundException(f"Item ID {line_data.item_id} not found.")
            
            line = models.InventoryTransferLine(
                transfer_id=transfer.id,
                item_id=line_data.item_id,
                qty_requested=line_data.qty_requested,
                tenant_id=tenant_id
            )
            db.add(line)

        db.commit()
        db.refresh(transfer)
        return transfer

    @staticmethod
    def submit_transfer(db: Session, transfer_id: uuid.UUID) -> models.InventoryTransfer:
        transfer = db.query(models.InventoryTransfer).filter_by(id=transfer_id).first()
        if not transfer:
            raise EntityNotFoundException("Transfer not found.")
        if transfer.status != "DRAFT":
            raise ValueError("Only DRAFT transfers can be submitted.")
        transfer.status = "PENDING_APPROVAL"
        db.commit()
        db.refresh(transfer)
        return transfer

    @staticmethod
    def approve_transfer(db: Session, transfer_id: uuid.UUID, user_id: uuid.UUID) -> models.InventoryTransfer:
        transfer = db.query(models.InventoryTransfer).filter_by(id=transfer_id).first()
        if not transfer:
            raise EntityNotFoundException("Transfer not found.")
        if transfer.status != "PENDING_APPROVAL":
            raise ValueError("Only PENDING_APPROVAL transfers can be approved.")
        transfer.status = "APPROVED"
        transfer.approved_by_id = user_id
        transfer.approved_at = datetime.utcnow()
        db.commit()
        db.refresh(transfer)
        return transfer

    @staticmethod
    def dispatch_transfer(db: Session, transfer_id: uuid.UUID, user_id: uuid.UUID) -> models.InventoryTransfer:
        transfer = db.query(models.InventoryTransfer).filter_by(id=transfer_id).first()
        if not transfer:
            raise EntityNotFoundException("Transfer not found.")
        if transfer.status != "APPROVED":
            raise ValueError("Only APPROVED transfers can be dispatched.")

        try:
            for line in transfer.lines:
                # 1. Issue stock from source warehouse
                ledger_entry = inventory_engine.record_issue(
                    db=db,
                    item_id=line.item_id,
                    warehouse_id=transfer.source_warehouse_id,
                    qty=line.qty_requested,
                    reference_type="STOCK_TRANSFER",
                    reference_id=transfer.id,
                    user_id=user_id,
                    remarks=f"Transfer dispatch {transfer.transfer_number} to WH {transfer.destination_warehouse_id}"
                )
                
                # Capture the unit cost resolved by FIFO depletion
                line.unit_cost = ledger_entry.valuation_unit_cost
                line.qty_transferred = line.qty_requested

                # 2. Add to destination in-transit quantity
                dest_stock = db.query(models.WarehouseStock).filter_by(
                    warehouse_id=transfer.destination_warehouse_id,
                    item_id=line.item_id,
                    batch_id=None
                ).first()
                if not dest_stock:
                    dest_stock = models.WarehouseStock(
                        warehouse_id=transfer.destination_warehouse_id,
                        item_id=line.item_id,
                        batch_id=None,
                        quantity_on_hand=0,
                        quantity_reserved=0,
                        quantity_damaged=0,
                        quantity_transit=0,
                        valuation_unit_cost=line.unit_cost,
                        tenant_id=transfer.tenant_id
                    )
                    db.add(dest_stock)
                    db.flush()

                dest_stock.quantity_transit += line.qty_requested

            transfer.status = "IN_TRANSIT"
            
            # Post GL entry for dispatch
            from backend.services.posting_engine import PostingEngine
            PostingEngine.post_transfer_dispatch(db, transfer, user_id, commit=False)

            db.commit()
            db.refresh(transfer)
            return transfer
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to dispatch transfer: {str(e)}")
            raise e

    @staticmethod
    def receive_transfer(db: Session, transfer_id: uuid.UUID, received_qtys: dict, user_id: uuid.UUID) -> models.InventoryTransfer:
        transfer = db.query(models.InventoryTransfer).filter_by(id=transfer_id).first()
        if not transfer:
            raise EntityNotFoundException("Transfer not found.")
        if transfer.status != "IN_TRANSIT":
            raise ValueError("Only IN_TRANSIT transfers can be received.")

        try:
            for line in transfer.lines:
                qty_rec = received_qtys.get(str(line.id)) or received_qtys.get(line.id)
                if qty_rec is None:
                    qty_rec = line.qty_transferred
                else:
                    qty_rec = int(qty_rec)

                if qty_rec > line.qty_transferred:
                    raise ValueError(f"Received quantity {qty_rec} cannot exceed transferred quantity {line.qty_transferred}.")

                # 1. Deduct from destination transit quantity
                dest_stock = db.query(models.WarehouseStock).filter_by(
                    warehouse_id=transfer.destination_warehouse_id,
                    item_id=line.item_id,
                    batch_id=None
                ).first()
                if not dest_stock or dest_stock.quantity_transit < qty_rec:
                    raise ValueError(f"Insufficient transit quantity tracking for item {line.item_id}.")
                dest_stock.quantity_transit -= qty_rec

                # 2. Add to destination warehouse actual stock
                inventory_engine.record_receipt(
                    db=db,
                    item_id=line.item_id,
                    warehouse_id=transfer.destination_warehouse_id,
                    qty=qty_rec,
                    unit_cost=line.unit_cost,
                    reference_type="STOCK_TRANSFER",
                    reference_id=transfer.id,
                    user_id=user_id,
                    remarks=f"Transfer receipt {transfer.transfer_number} from WH {transfer.source_warehouse_id}"
                )
                line.qty_received = qty_rec

            transfer.status = "COMPLETED"

            # Post GL entry for receipt
            from backend.services.posting_engine import PostingEngine
            PostingEngine.post_transfer_receipt(db, transfer, user_id, commit=False)

            db.commit()
            db.refresh(transfer)
            return transfer
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to receive transfer: {str(e)}")
            raise e

    @staticmethod
    def cancel_transfer(db: Session, transfer_id: uuid.UUID, user_id: uuid.UUID) -> models.InventoryTransfer:
        transfer = db.query(models.InventoryTransfer).filter_by(id=transfer_id).first()
        if not transfer:
            raise EntityNotFoundException("Transfer not found.")
        
        if transfer.status in ["COMPLETED", "CANCELLED"]:
            raise ValueError(f"Cannot cancel a transfer in status {transfer.status}.")

        original_status = transfer.status
        try:
            if transfer.status == "IN_TRANSIT":
                # Restore in-transit stock back to source warehouse
                for line in transfer.lines:
                    dest_stock = db.query(models.WarehouseStock).filter_by(
                        warehouse_id=transfer.destination_warehouse_id,
                        item_id=line.item_id,
                        batch_id=None
                    ).first()
                    if dest_stock and dest_stock.quantity_transit >= line.qty_transferred:
                        dest_stock.quantity_transit -= line.qty_transferred

                    inventory_engine.record_receipt(
                        db=db,
                        item_id=line.item_id,
                        warehouse_id=transfer.source_warehouse_id,
                        qty=line.qty_transferred,
                        unit_cost=line.unit_cost,
                        reference_type="STOCK_TRANSFER",
                        reference_id=transfer.id,
                        user_id=user_id,
                        remarks=f"Transfer cancellation restore to WH {transfer.source_warehouse_id}"
                    )
            
            transfer.status = "CANCELLED"

            # Post reversal GL entry if cancelled while IN_TRANSIT
            if original_status == "IN_TRANSIT":
                from backend.services.posting_engine import PostingEngine
                # Reversing dispatch is equivalent to receipt posting
                PostingEngine.post_transfer_receipt(db, transfer, user_id, commit=False)

            db.commit()
            db.refresh(transfer)
            return transfer
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to cancel transfer: {str(e)}")
            raise e

    @staticmethod
    def get_cycle_counts(
        db: Session,
        status: Optional[str] = None,
        warehouse_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[models.CycleCount]:
        query = db.query(models.CycleCount)
        if status:
            query = query.filter(models.CycleCount.status == status)
        if warehouse_id:
            query = query.filter(models.CycleCount.warehouse_id == warehouse_id)
        return query.order_by(models.CycleCount.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def create_cycle_count(
        db: Session,
        warehouse_id: uuid.UUID,
        count_date: datetime,
        remarks: Optional[str],
        user_id: uuid.UUID,
        tenant_id: uuid.UUID
    ) -> models.CycleCount:
        wh = db.query(models.Warehouse).filter_by(id=warehouse_id).first()
        if not wh:
            raise EntityNotFoundException("Warehouse not found.")

        count_num = f"CC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        cc = models.CycleCount(
            count_number=count_num,
            warehouse_id=warehouse_id,
            status="DRAFT",
            count_date=count_date,
            remarks=remarks,
            created_by_id=user_id,
            tenant_id=tenant_id
        )
        db.add(cc)
        db.flush()

        stocks = db.query(models.WarehouseStock).filter_by(
            warehouse_id=warehouse_id,
            is_deleted=False
        ).all()

        for stock in stocks:
            if stock.quantity_on_hand <= 0:
                continue
            
            line = models.CycleCountLine(
                cycle_count_id=cc.id,
                item_id=stock.item_id,
                system_qty=stock.quantity_on_hand,
                unit_cost=stock.valuation_unit_cost,
                tenant_id=tenant_id
            )
            db.add(line)

        db.commit()
        db.refresh(cc)
        return cc

    @staticmethod
    def submit_cycle_count(
        db: Session,
        count_id: uuid.UUID,
        lines_data: List[dict],
        counted_by_id: uuid.UUID
    ) -> models.CycleCount:
        cc = db.query(models.CycleCount).filter_by(id=count_id).first()
        if not cc:
            raise EntityNotFoundException("Cycle count not found.")
        if cc.status != "DRAFT":
            raise ValueError("Only DRAFT counts can be submitted.")

        lines_map = {str(l.id): l for l in cc.lines}
        for l_data in lines_data:
            line_id = l_data.get("id")
            line = lines_map.get(str(line_id)) or lines_map.get(line_id)
            if line:
                phys_qty = int(l_data["physical_qty"])
                line.physical_qty = phys_qty
                line.variance_qty = phys_qty - line.system_qty

        cc.status = "PENDING_APPROVAL"
        cc.counted_by_id = counted_by_id
        db.commit()
        db.refresh(cc)
        return cc

    @staticmethod
    def approve_cycle_count(
        db: Session,
        count_id: uuid.UUID,
        verified_by_id: uuid.UUID,
        approved_by_id: uuid.UUID
    ) -> models.CycleCount:
        cc = db.query(models.CycleCount).filter_by(id=count_id).first()
        if not cc:
            raise EntityNotFoundException("Cycle count not found.")
        if cc.status != "PENDING_APPROVAL":
            raise ValueError("Only PENDING_APPROVAL counts can be approved.")

        try:
            for line in cc.lines:
                if line.variance_qty is not None and line.variance_qty != 0:
                    adj_payload = schemas.InventoryAdjustmentCreate(
                        item_id=line.item_id,
                        warehouse_id=cc.warehouse_id,
                        qty_change=line.variance_qty,
                        unit_cost=line.unit_cost,
                        reason_code="CYCLE_COUNT_VARIANCE",
                        remarks=f"Auto-generated for Cycle Count {cc.count_number}"
                    )
                    
                    adj = InventoryService.propose_adjustment(
                        db=db,
                        payload=adj_payload,
                        user_id=approved_by_id,
                        tenant_id=cc.tenant_id
                    )
                    
                    adj.status = "SUBMITTED"
                    db.flush()
                    
                    InventoryService.approve_adjustment(db, adj.id, approved_by_id)

            cc.status = "COMPLETED"
            cc.verified_by_id = verified_by_id
            cc.approved_by_id = approved_by_id
            cc.approved_at = datetime.utcnow()
            
            db.commit()
            db.refresh(cc)
            return cc
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to approve cycle count: {str(e)}")
            raise e

    @staticmethod
    def reject_cycle_count(db: Session, count_id: uuid.UUID) -> models.CycleCount:
        cc = db.query(models.CycleCount).filter_by(id=count_id).first()
        if not cc:
            raise EntityNotFoundException("Cycle count not found.")
        if cc.status != "PENDING_APPROVAL":
            raise ValueError("Only PENDING_APPROVAL counts can be rejected.")
        cc.status = "CANCELLED"
        db.commit()
        db.refresh(cc)
        return cc

    @staticmethod
    def get_movement_ledger(
        db: Session,
        item_id: Optional[uuid.UUID] = None,
        warehouse_id: Optional[uuid.UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> dict:
        query = db.query(models.InventoryValuationEntry).filter(
            models.InventoryValuationEntry.is_deleted == False
        )
        
        if item_id:
            query = query.filter(models.InventoryValuationEntry.item_id == item_id)
        if warehouse_id:
            query = query.filter(models.InventoryValuationEntry.warehouse_id == warehouse_id)
        if start_date:
            query = query.filter(models.InventoryValuationEntry.created_at >= start_date)
        if end_date:
            query = query.filter(models.InventoryValuationEntry.created_at <= end_date)
            
        all_entries = query.order_by(models.InventoryValuationEntry.created_at.asc()).all()
        
        ledger_items = []
        running_qty = Decimal("0.0")
        running_val = Decimal("0.0")
        
        for entry in all_entries:
            running_qty += entry.quantity
            running_val += entry.total_value
            
            ledger_items.append({
                "id": str(entry.id),
                "item_id": str(entry.item_id),
                "sku": entry.item.sku if entry.item else "",
                "item_name": entry.item.name if entry.item else "",
                "warehouse_id": str(entry.warehouse_id) if entry.warehouse_id else "",
                "warehouse_name": entry.warehouse.name if entry.warehouse else "",
                "transaction_type": entry.transaction_type,
                "quantity_change": float(entry.quantity),
                "unit_cost": float(entry.unit_cost),
                "total_value": float(entry.total_value),
                "running_quantity_balance": float(running_qty),
                "running_valuation_balance": float(running_val),
                "reference_type": entry.reference_type,
                "reference_id": str(entry.reference_id) if entry.reference_id else "",
                "created_at": entry.created_at
            })
            
        ledger_items.reverse()
        total_count = len(ledger_items)
        paginated_items = ledger_items[skip : skip + limit]
        
        return {
            "total_count": total_count,
            "items": paginated_items
        }

    @staticmethod
    def close_inventory_period(db: Session, period_id: uuid.UUID, user_id: uuid.UUID) -> models.AccountingPeriod:
        """
        Executes period-end closure certification validations and locks the period if all pass.
        """
        from sqlalchemy import func
        period = db.query(models.AccountingPeriod).filter(
            models.AccountingPeriod.id == period_id,
            models.AccountingPeriod.is_deleted == False
        ).first()
        if not period:
            raise EntityNotFoundException(f"Accounting Period with ID {period_id} not found.")

        if period.status.upper() in ["CLOSED", "LOCKED"]:
            raise ValueError(f"Accounting period '{period.period_name}' is already {period.status}.")

        # Validation A: No negative inventory balances
        neg_stocks = db.query(models.WarehouseStock).filter(
            models.WarehouseStock.quantity_on_hand < 0,
            models.WarehouseStock.is_deleted == False
        ).all()
        if neg_stocks:
            raise ValueError("Validation A Failed: Negative stock balances exist.")

        # Validation B: Inventory ↔ GL variance = 0
        subledger_total = db.query(
            func.sum(models.InventoryCostLayer.remaining_quantity * models.InventoryCostLayer.unit_cost)
        ).filter(
            models.InventoryCostLayer.is_deleted == False
        ).scalar() or Decimal("0.0")

        account_1200 = db.query(models.Account).filter(models.Account.code == "1200", models.Account.is_deleted == False).first()
        if not account_1200:
            raise ValueError("Validation B Failed: Inventory Control account (1200) not found.")

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
        if variance > Decimal("0.001"):
            raise ValueError(f"Validation B Failed: Inventory Subledger vs GL variance ({variance}) is not zero.")

        # Validation C: No open adjustments
        open_adj = db.query(models.InventoryAdjustment).filter(
            models.InventoryAdjustment.status.in_(["DRAFT", "SUBMITTED"]),
            models.InventoryAdjustment.created_at >= period.start_date,
            models.InventoryAdjustment.created_at <= period.end_date,
            models.InventoryAdjustment.is_deleted == False
        ).first()
        if open_adj:
            raise ValueError(f"Validation C Failed: Open inventory adjustment exists in status {open_adj.status}.")

        # Validation D: No open cycle counts
        open_cc = db.query(models.CycleCount).filter(
            models.CycleCount.status.in_(["DRAFT", "PENDING_APPROVAL"]),
            models.CycleCount.count_date >= period.start_date,
            models.CycleCount.count_date <= period.end_date,
            models.CycleCount.is_deleted == False
        ).first()
        if open_cc:
            raise ValueError(f"Validation D Failed: Open cycle count exists in status {open_cc.status}.")

        # Validation E: No IN_TRANSIT transfers
        open_trf = db.query(models.InventoryTransfer).filter(
            models.InventoryTransfer.status == "IN_TRANSIT",
            models.InventoryTransfer.created_at >= period.start_date,
            models.InventoryTransfer.created_at <= period.end_date,
            models.InventoryTransfer.is_deleted == False
        ).first()
        if open_trf:
            raise ValueError("Validation E Failed: Open transfers in transit exist in the period.")

        # Validation F: All required snapshots exist
        from datetime import timedelta
        curr_date = period.start_date.date()
        end_date = period.end_date.date()
        while curr_date <= end_date:
            snapshot_exists = db.query(models.InventorySnapshot).filter(
                func.date(models.InventorySnapshot.snapshot_date) == curr_date,
                models.InventorySnapshot.is_deleted == False
            ).first()
            if not snapshot_exists:
                raise ValueError(f"Validation F Failed: Missing inventory snapshot for date {curr_date}")
            curr_date += timedelta(days=1)

        # Validation G: Trial Balance remains balanced
        from backend.services.accounting_service import AccountingService
        try:
            AccountingService.validate_trial_balance(db)
        except Exception as e:
            raise ValueError(f"Validation G Failed: Trial balance is unbalanced: {str(e)}")

        # Validation H: All Inventory Issues are POSTED
        unposted_issues = db.query(models.InventoryIssue).filter(
            models.InventoryIssue.status.in_(["DRAFT", "SUBMITTED", "APPROVED"]),
            models.InventoryIssue.issue_date >= period.start_date,
            models.InventoryIssue.issue_date <= period.end_date,
            models.InventoryIssue.is_deleted == False
        ).first()
        if unposted_issues:
            raise ValueError(f"Validation H Failed: Unposted inventory issues exist in status {unposted_issues.status}.")

        # Lock the period
        period.status = "CLOSED"
        db.commit()
        db.refresh(period)
        return period
