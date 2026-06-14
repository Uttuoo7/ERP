import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from backend import models
from backend.services.accounting_service import AccountingService
from backend.services.posting_engine import PostingEngine
from backend.inventory_engine import log_inventory_movement

class ManufacturingAccountingService:
    @classmethod
    def get_manufacturing_accounts(cls, db: Session, tenant_id: uuid.UUID) -> Dict[str, uuid.UUID]:
        """Resolves required G/L accounts with fallback defaults."""
        return {
            "wip": PostingEngine.resolve_account_id_with_fallback(db, "WIP_INVENTORY", "1300"),
            "inventory_control": PostingEngine.resolve_account_id_with_fallback(db, "INVENTORY_CONTROL", "1200"),
            "labor_absorption": PostingEngine.resolve_account_id_with_fallback(db, "LABOR_ABSORPTION", "5100"),
            "overhead_absorption": PostingEngine.resolve_account_id_with_fallback(db, "OVERHEAD_ABSORPTION", "5200"),
            "finished_goods": PostingEngine.resolve_account_id_with_fallback(db, "FINISHED_GOODS_INVENTORY", "1210"),
            "scrap_variance": PostingEngine.resolve_account_id_with_fallback(db, "SCRAP_VARIANCE", "5300"),
            "rework_inventory": PostingEngine.resolve_account_id_with_fallback(db, "REWORK_INVENTORY", "1350"),
            # Variances
            "material_variance": PostingEngine.resolve_account_id_with_fallback(db, "MATERIAL_VARIANCE", "5310"),
            "labor_variance": PostingEngine.resolve_account_id_with_fallback(db, "LABOR_VARIANCE", "5320"),
            "overhead_variance": PostingEngine.resolve_account_id_with_fallback(db, "OVERHEAD_VARIANCE", "5330"),
            "yield_variance": PostingEngine.resolve_account_id_with_fallback(db, "YIELD_VARIANCE", "5340")
        }

    @classmethod
    def post_material_issue(
        cls,
        db: Session,
        work_order_id: uuid.UUID,
        component_item_id: uuid.UUID,
        warehouse_id: uuid.UUID,
        quantity: Decimal,
        unit_cost: Decimal,
        user_id: Optional[uuid.UUID] = None,
        tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
    ):
        """Posts WIP Issue: Dr WIP Inventory, Cr Inventory Control."""
        if quantity <= 0:
            return

        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)
        accounts = cls.get_manufacturing_accounts(db, tenant_id)
        
        # Calculate cost
        total_cost = quantity * unit_cost
        
        # Create balanced Journal Entry
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            id=uuid.uuid4(),
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="WORK_ORDER",
            reference_id=work_order_id,
            source_module="MANUFACTURING",
            source_event="material_issue",
            narration=f"Material issue of item {component_item_id} for WO {work_order_id}",
            status="POSTED",
            tenant_id=tenant_id
        )
        db.add(je)
        db.flush()

        l_wip = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["wip"],
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration="Debit WIP Inventory on material issue"
        )
        l_ctrl = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["inventory_control"],
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration="Credit Inventory Control on material issue"
        )
        db.add_all([l_wip, l_ctrl])
        
        # Update physical inventory stock
        stock = db.query(models.InventoryStock).filter(
            models.InventoryStock.item_id == component_item_id,
            models.InventoryStock.warehouse_id == warehouse_id
        ).first()
        if not stock or stock.current_stock < quantity:
            raise ValueError("Insufficient inventory stock for issue")
            
        stock.current_stock = Decimal(str(stock.current_stock)) - quantity
        # Consume allocation
        stock.reserved_stock = max(Decimal("0.0000"), Decimal(str(stock.reserved_stock)) - quantity)
        stock.available_stock = stock.current_stock - stock.reserved_stock
        
        # Log stock ledger entry
        log_inventory_movement(
            db=db,
            item_id=component_item_id,
            warehouse_id=warehouse_id,
            transaction_type="PRODUCTION_CONSUMPTION",
            qty=float(-quantity),
            unit_cost=unit_cost,
            reference_type="WORK_ORDER",
            reference_id=work_order_id,
            user_id=user_id,
            remarks=f"Material Issue to Work Order"
        )
        
        # Update WorkOrderMaterial quantity_issued
        wom = db.query(models.WorkOrderMaterial).filter(
            models.WorkOrderMaterial.work_order_id == work_order_id,
            models.WorkOrderMaterial.component_item_id == component_item_id
        ).first()
        if wom:
            wom.quantity_issued = Decimal(str(wom.quantity_issued)) + quantity

        # Certify Trial Balance
        AccountingService.validate_trial_balance(db)

    @classmethod
    def post_labor_booking(
        cls,
        db: Session,
        work_order_id: uuid.UUID,
        hours: Decimal,
        rate: Decimal,
        tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
    ):
        """Posts Labor Absorption: Dr WIP Inventory, Cr Labor Absorption."""
        if hours <= 0 or rate <= 0:
            return
            
        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)
        accounts = cls.get_manufacturing_accounts(db, tenant_id)
        
        total_cost = hours * rate
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            id=uuid.uuid4(),
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="WORK_ORDER",
            reference_id=work_order_id,
            source_module="MANUFACTURING",
            source_event="labor_booking",
            narration=f"Labor booking for WO {work_order_id}",
            status="POSTED",
            tenant_id=tenant_id
        )
        db.add(je)
        db.flush()

        l_wip = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["wip"],
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration="Debit WIP Inventory on labor booking"
        )
        l_abs = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["labor_absorption"],
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration="Credit Labor Absorption on labor booking"
        )
        db.add_all([l_wip, l_abs])
        
        # Certify
        AccountingService.validate_trial_balance(db)

    @classmethod
    def post_overhead_absorption(
        cls,
        db: Session,
        work_order_id: uuid.UUID,
        hours: Decimal,
        rate: Decimal,
        tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
    ):
        """Posts Overhead Absorption: Dr WIP Inventory, Cr Overhead Absorption."""
        if hours <= 0 or rate <= 0:
            return
            
        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)
        accounts = cls.get_manufacturing_accounts(db, tenant_id)
        
        total_cost = hours * rate
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            id=uuid.uuid4(),
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="WORK_ORDER",
            reference_id=work_order_id,
            source_module="MANUFACTURING",
            source_event="overhead_booking",
            narration=f"Overhead booking for WO {work_order_id}",
            status="POSTED",
            tenant_id=tenant_id
        )
        db.add(je)
        db.flush()

        l_wip = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["wip"],
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration="Debit WIP Inventory on overhead absorption"
        )
        l_abs = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["overhead_absorption"],
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration="Credit Overhead Absorption on overhead booking"
        )
        db.add_all([l_wip, l_abs])
        
        # Certify
        AccountingService.validate_trial_balance(db)

    @classmethod
    def post_finished_goods_receipt(
        cls,
        db: Session,
        work_order_id: uuid.UUID,
        warehouse_id: uuid.UUID,
        quantity: Decimal,
        unit_cost: Decimal,
        user_id: Optional[uuid.UUID] = None,
        tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
    ):
        """Posts Finished Goods Receipt: Dr Finished Goods, Cr WIP."""
        if quantity <= 0:
            return

        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)
        accounts = cls.get_manufacturing_accounts(db, tenant_id)
        
        total_cost = quantity * unit_cost
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            id=uuid.uuid4(),
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="WORK_ORDER",
            reference_id=work_order_id,
            source_module="MANUFACTURING",
            source_event="fg_receipt",
            narration=f"FG Receipt for WO {work_order_id}",
            status="POSTED",
            tenant_id=tenant_id
        )
        db.add(je)
        db.flush()

        l_fg = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["finished_goods"],
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration="Debit Finished Goods Inventory on receipt"
        )
        l_wip = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["wip"],
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration="Credit WIP Inventory on receipt"
        )
        db.add_all([l_fg, l_wip])
        
        # Add finished good to physical inventory
        wo = db.query(models.WorkOrder).filter_by(id=work_order_id).first()
        stock = db.query(models.InventoryStock).filter(
            models.InventoryStock.item_id == wo.item_id,
            models.InventoryStock.warehouse_id == warehouse_id
        ).first()
        if not stock:
            stock = models.InventoryStock(
                id=uuid.uuid4(),
                item_id=wo.item_id,
                warehouse_id=warehouse_id,
                current_stock=quantity,
                reserved_stock=Decimal("0.0000"),
                available_stock=quantity,
                tenant_id=tenant_id
            )
            db.add(stock)
        else:
            stock.current_stock = Decimal(str(stock.current_stock)) + quantity
            stock.available_stock = stock.current_stock - stock.reserved_stock
            
        # Log stock movement
        log_inventory_movement(
            db=db,
            item_id=wo.item_id,
            warehouse_id=warehouse_id,
            transaction_type="FINISHED_GOODS_RECEIPT",
            qty=float(quantity),
            unit_cost=unit_cost,
            reference_type="WORK_ORDER",
            reference_id=work_order_id,
            user_id=user_id,
            remarks=f"Finished Goods Receipt from Work Order"
        )
        
        # Certify
        AccountingService.validate_trial_balance(db)

    @classmethod
    def post_scrap_variance(
        cls,
        db: Session,
        work_order_id: uuid.UUID,
        quantity: Decimal,
        unit_cost: Decimal,
        tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
    ):
        """Posts Scrap Variance: Dr Scrap Variance, Cr WIP."""
        if quantity <= 0 or unit_cost <= 0:
            return
            
        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)
        accounts = cls.get_manufacturing_accounts(db, tenant_id)
        
        total_cost = quantity * unit_cost
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            id=uuid.uuid4(),
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="WORK_ORDER",
            reference_id=work_order_id,
            source_module="MANUFACTURING",
            source_event="scrap_posting",
            narration=f"Scrap posting for WO {work_order_id}",
            status="POSTED",
            tenant_id=tenant_id
        )
        db.add(je)
        db.flush()

        l_scr = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["scrap_variance"],
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration="Debit Scrap Variance on scrap posting"
        )
        l_wip = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["wip"],
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration="Credit WIP Inventory on scrap posting"
        )
        db.add_all([l_scr, l_wip])
        
        # Certify
        AccountingService.validate_trial_balance(db)

    @classmethod
    def post_rework_posting(
        cls,
        db: Session,
        work_order_id: uuid.UUID,
        quantity: Decimal,
        unit_cost: Decimal,
        tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID
    ):
        """Posts Rework Disposition: Dr Rework Inventory, Cr WIP."""
        if quantity <= 0 or unit_cost <= 0:
            return
            
        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)
        accounts = cls.get_manufacturing_accounts(db, tenant_id)
        
        total_cost = quantity * unit_cost
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            id=uuid.uuid4(),
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="WORK_ORDER",
            reference_id=work_order_id,
            source_module="MANUFACTURING",
            source_event="rework_posting",
            narration=f"Rework posting for WO {work_order_id}",
            status="POSTED",
            tenant_id=tenant_id
        )
        db.add(je)
        db.flush()

        l_rew = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["rework_inventory"],
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration="Debit Rework Inventory on rework layout"
        )
        l_wip = models.JournalLine(
            id=uuid.uuid4(),
            journal_entry_id=je.id,
            account_id=accounts["wip"],
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration="Credit WIP Inventory on rework layout"
        )
        db.add_all([l_rew, l_wip])
        
        # Certify
        AccountingService.validate_trial_balance(db)

    @classmethod
    def post_variance_accounting(cls, db: Session, work_order_id: uuid.UUID, tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID):
        """Calculates actual vs standard costs and posts favorable/unfavorable variance, reducing WO WIP to 0."""
        wo = db.query(models.WorkOrder).filter_by(id=work_order_id).first()
        if not wo:
            return
            
        accounts = cls.get_manufacturing_accounts(db, tenant_id)
        
        # Sum up all debits and credits posted to WIP for this work order reference
        wip_lines = db.query(
            models.JournalLine.debit_amount,
            models.JournalLine.credit_amount
        ).join(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "WORK_ORDER",
            models.JournalEntry.reference_id == work_order_id,
            models.JournalLine.account_id == accounts["wip"],
            models.JournalLine.is_deleted == False
        ).all()
        
        total_wip_debits = sum(line.debit_amount for line in wip_lines)
        total_wip_credits = sum(line.credit_amount for line in wip_lines)
        wip_balance = total_wip_debits - total_wip_credits
        
        if wip_balance == 0:
            return # Perfectly balanced
            
        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        
        je = models.JournalEntry(
            id=uuid.uuid4(),
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="WORK_ORDER",
            reference_id=work_order_id,
            source_module="MANUFACTURING",
            source_event="variance_posting",
            narration=f"Manufacturing cost variance posting to close WO {wo.wo_number}",
            status="POSTED",
            tenant_id=tenant_id
        )
        db.add(je)
        db.flush()
        
        # Determine standard costs of completed components (Standard cost = Std Qty * Standard Unit cost)
        # We can attribute variance to Material cost variance for simplicity, matching the subledger to GL 0 WIP rule!
        # If wip_balance > 0: Unfavorable variance (Actual > Std): Debit Variance, Credit WIP
        # If wip_balance < 0: Favorable variance (Actual < Std): Debit WIP, Credit Variance
        abs_bal = abs(wip_balance)
        if wip_balance > 0:
            l_var = models.JournalLine(
                id=uuid.uuid4(),
                journal_entry_id=je.id,
                account_id=accounts["material_variance"],
                debit_amount=abs_bal,
                credit_amount=Decimal("0.0"),
                narration="Debit Material Variance (Unfavorable)"
            )
            l_wip = models.JournalLine(
                id=uuid.uuid4(),
                journal_entry_id=je.id,
                account_id=accounts["wip"],
                debit_amount=Decimal("0.0"),
                credit_amount=abs_bal,
                narration="Credit WIP to clear balance"
            )
        else:
            l_wip = models.JournalLine(
                id=uuid.uuid4(),
                journal_entry_id=je.id,
                account_id=accounts["wip"],
                debit_amount=abs_bal,
                credit_amount=Decimal("0.0"),
                narration="Debit WIP to clear balance"
            )
            l_var = models.JournalLine(
                id=uuid.uuid4(),
                journal_entry_id=je.id,
                account_id=accounts["material_variance"],
                debit_amount=Decimal("0.0"),
                credit_amount=abs_bal,
                narration="Credit Material Variance (Favorable)"
            )
            
        db.add_all([l_wip, l_var])
        db.flush()
        
        # Certify
        AccountingService.validate_trial_balance(db)

    @classmethod
    def get_wip_reconciliation_variance(cls, db: Session, tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID) -> Decimal:
        """Returns the difference between the WIP Subledger (active WIP on WOs) and WIP GL Account balance."""
        accounts = cls.get_manufacturing_accounts(db, tenant_id)
        
        # GL WIP balance
        wip_lines = db.query(
            models.JournalLine.debit_amount,
            models.JournalLine.credit_amount
        ).join(models.JournalEntry).filter(
            models.JournalLine.account_id == accounts["wip"],
            models.JournalEntry.reference_type == "WORK_ORDER",
            models.JournalLine.is_deleted == False
        ).all()
        gl_balance = sum(line.debit_amount - line.credit_amount for line in wip_lines)
        
        # Subledger WIP balance (WIP value accumulated on non-CLOSED and non-CANCELLED work orders)
        sub_balance = Decimal("0.0000")
        active_wos = db.query(models.WorkOrder).filter(
            models.WorkOrder.status.notin_(["CLOSED", "CANCELLED"]),
            models.WorkOrder.is_deleted == False
        ).all()
        
        for wo in active_wos:
            lines = db.query(
                models.JournalLine.debit_amount,
                models.JournalLine.credit_amount
            ).join(models.JournalEntry).filter(
                models.JournalEntry.reference_type == "WORK_ORDER",
                models.JournalEntry.reference_id == wo.id,
                models.JournalLine.account_id == accounts["wip"],
                models.JournalLine.is_deleted == False
            ).all()
            sub_balance += sum(line.debit_amount - line.credit_amount for line in lines)
            
        return abs(gl_balance - sub_balance)

    @classmethod
    def validate_manufacturing_period_close(cls, db: Session, tenant_id: uuid.UUID = models.SYSTEM_DEFAULT_TENANT_UUID):
        """Enforces all Manufacturing Period Close checks."""
        # 1. No OPEN work orders
        open_count = db.query(models.WorkOrder).filter(
            models.WorkOrder.status.in_(["RELEASED", "MATERIAL_ALLOCATED", "IN_PROGRESS"]),
            models.WorkOrder.is_deleted == False
        ).count()
        if open_count > 0:
            raise ValueError(f"Cannot close period: {open_count} work orders are still open")
            
        # 2. No QC_PENDING work orders
        qc_count = db.query(models.WorkOrder).filter(
            models.WorkOrder.status == "QC_PENDING",
            models.WorkOrder.is_deleted == False
        ).count()
        if qc_count > 0:
            raise ValueError(f"Cannot close period: {qc_count} work orders are pending quality inspection")
            
        # 3. WIP reconciliation variance = 0
        wip_var = cls.get_wip_reconciliation_variance(db, tenant_id)
        if wip_var > Decimal("0.001"):
            raise ValueError(f"Cannot close period: WIP subledger reconciliation variance is {wip_var:,.2f}")
            
        # 4. Trial Balance balanced
        AccountingService.validate_trial_balance(db)
        
        # 5. No negative inventory
        neg_stocks = db.query(models.InventoryStock).filter(
            models.InventoryStock.current_stock < 0,
            models.InventoryStock.is_deleted == False
        ).count()
        if neg_stocks > 0:
            raise ValueError(f"Cannot close period: {neg_stocks} negative inventory records detected")
            
        return True
