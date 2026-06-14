import logging
import uuid
import os
from decimal import Decimal
from datetime import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session

from backend import models
from backend.services.accounting_service import AccountingService

logger = logging.getLogger(__name__)

class PostingEngine:
    """
    Consumes procurement events and auto-posts balanced general ledger entries
    by dynamically resolving accounts from PostingConfiguration.
    """

    @staticmethod
    def resolve_account_id(db: Session, event_key: str) -> uuid.UUID:
        cfg = db.query(models.PostingConfiguration).filter(
            models.PostingConfiguration.event_key == event_key,
            models.PostingConfiguration.is_deleted == False
        ).first()
        if not cfg:
            raise ValueError(f"Required GL Posting Configuration missing for '{event_key}'. Please check configurations.")
        return cfg.account_id

    @classmethod
    def register_listeners(cls, force: bool = False):
        """Register listeners to event dispatcher channels depending on rollout stage."""
        enable_grn = force or os.getenv("ENABLE_AUTO_POSTING_GRN", "false").lower() in ("true", "1", "yes")
        enable_invoice = force or os.getenv("ENABLE_AUTO_POSTING_INVOICE", "false").lower() in ("true", "1", "yes")
        enable_payment = force or os.getenv("ENABLE_AUTO_POSTING_PAYMENT", "false").lower() in ("true", "1", "yes")

        from backend import event_dispatcher
        
        if enable_grn:
            event_dispatcher.subscribe("goods_received", cls.handle_goods_received)
            logger.info("GL Auto-Posting Engine: registered listener for 'goods_received'.")
        else:
            logger.info("GL Auto-Posting Engine: 'goods_received' posting is disabled.")

        if enable_invoice:
            event_dispatcher.subscribe("invoice_approved", cls.handle_invoice_approved)
            logger.info("GL Auto-Posting Engine: registered listener for 'invoice_approved'.")
        else:
            logger.info("GL Auto-Posting Engine: 'invoice_approved' posting is disabled.")

        if enable_payment:
            event_dispatcher.subscribe("payment_allocated", cls.handle_payment_allocated)
            logger.info("GL Auto-Posting Engine: registered listener for 'payment_allocated'.")
        else:
            logger.info("GL Auto-Posting Engine: 'payment_allocated' posting is disabled.")

        # Phase 12C: Inventory Issues, Scrap, and Returns observers
        event_dispatcher.subscribe("inventory_issue_posted", cls.handle_inventory_issue_posted)
        event_dispatcher.subscribe("inventory_return_posted", cls.handle_inventory_return_posted)
        event_dispatcher.subscribe("inventory_scrap_posted", cls.handle_inventory_scrap_posted)
        logger.info("GL Auto-Posting Engine: registered listeners for Phase 12C inventory events.")

    @classmethod
    def handle_goods_received(cls, payload: Dict[str, Any], db: Session):
        grn_id = payload.get("grn_id")
        if not grn_id:
            return

        grn = db.query(models.GoodsReceiptNote).filter(models.GoodsReceiptNote.id == grn_id).first()
        if not grn:
            logger.error(f"[Posting Engine]: GRN '{grn_id}' not found for auto-posting.")
            return

        # Prevent duplicates
        existing = db.query(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "GRN",
            models.JournalEntry.reference_id == grn.id
        ).first()
        if existing:
            logger.info(f"[Posting Engine]: GRN '{grn.grn_number}' already posted to GL.")
            return

        posting_date = grn.receipt_date or datetime.utcnow()
        # Period status validation
        AccountingService.validate_period_for_posting(db, posting_date)

        # Resolve configuration-driven accounts
        inventory_acc_id = cls.resolve_account_id(db, "INVENTORY_RECEIPT")
        grni_acc_id = cls.resolve_account_id(db, "GRNI_ACCRUAL")

        # Get costing method and resolve costs
        from backend.inventory_engine import get_inventory_costing_method
        costing_method = get_inventory_costing_method(db, grn.tenant_id)
        
        actual_cost = grn.subtotal
        if actual_cost <= 0:
            logger.warning(f"[Posting Engine]: GRN '{grn.grn_number}' has zero or negative subtotal. Skipping posting.")
            return

        standard_cost = Decimal("0.0")
        if costing_method == "STANDARD":
            grn_lines = db.query(models.GRNLineItem).filter_by(grn_id=grn.id, is_deleted=False).all()
            if grn_lines:
                for line in grn_lines:
                    item = db.query(models.Item).filter_by(id=line.item_id).first()
                    std_rate = item.standard_rate if item and item.standard_rate is not None else line.unit_price
                    standard_cost += Decimal(str(line.accepted_qty)) * std_rate
            else:
                standard_cost = actual_cost
        else:
            standard_cost = actual_cost

        # Use sequential JV number
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="GRN",
            reference_id=grn.id,
            source_module="PROCUREMENT",
            source_event="goods_received",
            narration=f"Inventory receipt accrual for GRN {grn.grn_number} (PO {grn.purchase_order.po_number})",
            status="POSTED"
        )
        db.add(je)
        db.flush()

        # Double-entry lines
        # Debit inventory stock asset for standard_cost
        l1 = models.JournalLine(
            journal_entry=je,
            account_id=inventory_acc_id,
            debit_amount=standard_cost,
            credit_amount=Decimal("0.0"),
            narration=f"Debit inventory stock asset for GRN {grn.grn_number}"
        )
        db.add(l1)

        # Credit GRNI accruals liability for actual_cost
        l2 = models.JournalLine(
            journal_entry=je,
            account_id=grni_acc_id,
            debit_amount=Decimal("0.0"),
            credit_amount=actual_cost,
            narration=f"Credit GRNI accruals liability for GRN {grn.grn_number}"
        )
        db.add(l2)

        # Handle PPV if costing is standard and there is a variance
        if costing_method == "STANDARD" and standard_cost != actual_cost:
            try:
                ppv_acc_id = cls.resolve_account_id(db, "PURCHASE_PRICE_VARIANCE")
            except ValueError:
                # Fallback to Cost of Goods Sold account (5000)
                ppv_acc = db.query(models.Account).filter_by(code='5000', is_deleted=False).first()
                if not ppv_acc:
                    raise ValueError("Purchase Price Variance account or Cost of Goods Sold (5000) must be defined.")
                ppv_acc_id = ppv_acc.id

            if standard_cost > actual_cost:
                # Favorable variance: Credit PPV
                l_ppv = models.JournalLine(
                    journal_entry=je,
                    account_id=ppv_acc_id,
                    debit_amount=Decimal("0.0"),
                    credit_amount=standard_cost - actual_cost,
                    narration=f"Credit Purchase Price Variance (Favorable) for GRN {grn.grn_number}"
                )
                db.add(l_ppv)
            else:
                # Unfavorable variance: Debit PPV
                l_ppv = models.JournalLine(
                    journal_entry=je,
                    account_id=ppv_acc_id,
                    debit_amount=actual_cost - standard_cost,
                    credit_amount=Decimal("0.0"),
                    narration=f"Debit Purchase Price Variance (Unfavorable) for GRN {grn.grn_number}"
                )
                db.add(l_ppv)
        
        # Certify Trial Balance before commit
        AccountingService.validate_trial_balance(db)
        db.commit()
        logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for GRN accruals.")

    @classmethod
    def handle_invoice_approved(cls, payload: Dict[str, Any], db: Session):
        inv_id = payload.get("invoice_id")
        if not inv_id:
            return

        invoice = db.query(models.Invoice).filter(models.Invoice.id == inv_id).first()
        if not invoice:
            logger.error(f"[Posting Engine]: Invoice '{inv_id}' not found for auto-posting.")
            return

        # Prevent duplicates
        existing = db.query(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "INVOICE",
            models.JournalEntry.reference_id == invoice.id
        ).first()
        if existing:
            logger.info(f"[Posting Engine]: Invoice '{invoice.invoice_number}' already posted to GL.")
            return

        posting_date = invoice.invoice_date or datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)

        # Resolve configuration-driven accounts
        grni_acc_id = cls.resolve_account_id(db, "GRNI_ACCRUAL")
        gst_acc_id = cls.resolve_account_id(db, "GST_RECEIVABLE")
        tds_acc_id = cls.resolve_account_id(db, "TDS_PAYABLE")
        ap_acc_id = cls.resolve_account_id(db, "AP_CONTROL")

        gst_val = Decimal(str(invoice.gst_amount or 0))
        tds_val = Decimal(str(getattr(invoice, "tds_deducted", 0) or 0))
        net_liability = Decimal(str(invoice.total_amount or 0))
        taxable_base = net_liability - gst_val + tds_val

        # Use sequential JV number
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="INVOICE",
            reference_id=invoice.id,
            source_module="PROCUREMENT",
            source_event="invoice_approved",
            narration=f"AP accrual journal for invoice {invoice.invoice_number} / PO {invoice.purchase_order.po_number}",
            status="POSTED"
        )
        db.add(je)
        db.flush()

        # Debit GRNI (reversing the receipt accrual)
        l1 = models.JournalLine(
            journal_entry=je,
            account_id=grni_acc_id,
            debit_amount=taxable_base,
            credit_amount=Decimal("0.0"),
            narration=f"Debit GRNI to reverse receipt accrual for invoice {invoice.invoice_number}"
        )
        db.add(l1)

        # Debit GST Receivable
        if gst_val > 0:
            l2 = models.JournalLine(
                journal_entry=je,
                account_id=gst_acc_id,
                debit_amount=gst_val,
                credit_amount=Decimal("0.0"),
                narration=f"Debit GST Input Receivable for invoice {invoice.invoice_number}"
            )
            db.add(l2)

        # Credit TDS Payable
        if tds_val > 0:
            l3 = models.JournalLine(
                journal_entry=je,
                account_id=tds_acc_id,
                debit_amount=Decimal("0.0"),
                credit_amount=tds_val,
                narration=f"Credit TDS payable offset for invoice {invoice.invoice_number}"
            )
            db.add(l3)

        # Credit Accounts Payable Control Account
        l4 = models.JournalLine(
            journal_entry=je,
            account_id=ap_acc_id,
            debit_amount=Decimal("0.0"),
            credit_amount=net_liability,
            narration=f"Credit Accounts Payable for vendor liability under invoice {invoice.invoice_number}"
        )
        db.add(l4)

        # Certify Trial Balance before commit
        AccountingService.validate_trial_balance(db)
        db.commit()
        logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for Invoice AP Accruals.")

    @classmethod
    def handle_payment_allocated(cls, payload: Dict[str, Any], db: Session):
        payment_id = payload.get("payment_id")
        if not payment_id:
            return

        tx = db.query(models.FinancialTransaction).filter(models.FinancialTransaction.id == payment_id).first()
        if not tx:
            logger.error(f"[Posting Engine]: Payment transaction '{payment_id}' not found for auto-posting.")
            return

        # Prevent duplicates
        existing = db.query(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "PAYMENT",
            models.JournalEntry.reference_id == tx.id
        ).first()
        if existing:
            logger.info(f"[Posting Engine]: Payment '{tx.transaction_number}' already posted to GL.")
            return

        posting_date = tx.transaction_date or datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)

        # Resolve configuration-driven accounts
        ap_acc_id = cls.resolve_account_id(db, "AP_CONTROL")
        bank_acc_id = cls.resolve_account_id(db, "BANK_CONTROL")

        amount = Decimal(str(tx.total_amount))
        if amount <= 0:
            logger.warning(f"[Posting Engine]: Payment '{tx.transaction_number}' has zero or negative amount. Skipping posting.")
            return

        # Use sequential JV number
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="PAYMENT",
            reference_id=tx.id,
            source_module="FINANCE",
            source_event="payment_allocated",
            narration=f"Vendor disbursement cash outflow clear for ref {tx.transaction_number}",
            status="POSTED"
        )
        db.add(je)
        db.flush()

        # Debit Accounts Payable (reducing liability)
        l1 = models.JournalLine(
            journal_entry=je,
            account_id=ap_acc_id,
            debit_amount=amount,
            credit_amount=Decimal("0.0"),
            narration=f"Debit Accounts Payable to clear liability for payment {tx.transaction_number}"
        )
        # Credit Bank
        l2 = models.JournalLine(
            journal_entry=je,
            account_id=bank_acc_id,
            debit_amount=Decimal("0.0"),
            credit_amount=amount,
            narration=f"Credit Bank Control for payment disbursement {tx.transaction_number}"
        )
        db.add(l1)
        db.add(l2)

        # Certify Trial Balance before commit
        AccountingService.validate_trial_balance(db)
        db.commit()
        logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for Payment disbursement.")

    @classmethod
    def get_inventory_accounts(cls, db: Session, tenant_id: Any) -> tuple:
        """
        Retrieves configurable inventory account IDs from TenantConfig.
        Raises ValueError if any required setting is missing.
        """
        cfg = db.query(models.TenantConfig).filter(
            models.TenantConfig.tenant_uuid == tenant_id
        ).first()
        if not cfg:
            cfg = db.query(models.TenantConfig).first()
            
        if not cfg or not cfg.inventory_control_account_id or not cfg.inventory_adjustment_gain_account_id or not cfg.inventory_adjustment_loss_account_id or not cfg.inventory_variance_account_id:
            # Fallbacks to prevent failure if it is not seeded yet
            fallback_map = {}
            for code in ['1200', '4100', '5100', '5000']:
                acc = db.query(models.Account).filter_by(code=code, is_deleted=False).first()
                if acc:
                    fallback_map[code] = acc.id
            
            control_id = cfg.inventory_control_account_id if cfg else None
            control_id = control_id or fallback_map.get('1200')
            
            gain_id = cfg.inventory_adjustment_gain_account_id if cfg else None
            gain_id = gain_id or fallback_map.get('4100') or fallback_map.get('5100')
            
            loss_id = cfg.inventory_adjustment_loss_account_id if cfg else None
            loss_id = loss_id or fallback_map.get('5100')
            
            variance_id = cfg.inventory_variance_account_id if cfg else None
            variance_id = variance_id or fallback_map.get('5000')
            
            if not control_id or not gain_id or not loss_id or not variance_id:
                raise ValueError("Required inventory GL account configuration is missing.")
            return control_id, gain_id, loss_id, variance_id
            
        return (
            cfg.inventory_control_account_id,
            cfg.inventory_adjustment_gain_account_id,
            cfg.inventory_adjustment_loss_account_id,
            cfg.inventory_variance_account_id
        )

    @classmethod
    def post_inventory_revaluation(cls, db: Session, reval: Any, commit: bool = False):
        """
        Auto-posts G/L entry adjustments for approved inventory revaluations.
        Updates G/L Control Account and posts offsetting variance to Variance Account.
        """
        val_diff = Decimal(str(reval.value_difference))
        if val_diff == 0:
            return

        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)

        # Resolve configurable accounts
        control_acc_id, _, _, variance_acc_id = cls.get_inventory_accounts(db, reval.tenant_id)

        # Use sequential JV number
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="REVALUATION",
            reference_id=reval.id,
            source_module="INVENTORY",
            source_event="revaluation_approved",
            narration=f"Inventory revaluation adjustment for item ID {reval.item_id}: {reval.reason or ''}",
            status="POSTED"
        )
        db.add(je)
        db.flush()

        abs_diff = abs(val_diff)
        if val_diff > 0:
            # Positive adjustment (Asset value increased): Debit Inventory Control, Credit Variance
            l1 = models.JournalLine(
                journal_entry=je,
                account_id=control_acc_id,
                debit_amount=abs_diff,
                credit_amount=Decimal("0.0"),
                narration=f"Debit Inventory Control for revaluation gain"
            )
            l2 = models.JournalLine(
                journal_entry=je,
                account_id=variance_acc_id,
                debit_amount=Decimal("0.0"),
                credit_amount=abs_diff,
                narration=f"Credit Inventory Variance for revaluation gain offset"
            )
        else:
            # Negative adjustment (Asset value decreased): Credit Inventory Control, Debit Variance
            l1 = models.JournalLine(
                journal_entry=je,
                account_id=control_acc_id,
                debit_amount=Decimal("0.0"),
                credit_amount=abs_diff,
                narration=f"Credit Inventory Control for revaluation loss"
            )
            l2 = models.JournalLine(
                journal_entry=je,
                account_id=variance_acc_id,
                debit_amount=abs_diff,
                credit_amount=Decimal("0.0"),
                narration=f"Debit Inventory Variance for revaluation loss offset"
            )

        db.add(l1)
        db.add(l2)

        # Certify Trial Balance before commit
        AccountingService.validate_trial_balance(db)
        if commit:
            db.commit()
            logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for Inventory Revaluation.")
        else:
            db.flush()
            logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for Inventory Revaluation (flushed).")

    @classmethod
    def post_inventory_adjustment(cls, db: Session, adjustment: Any, commit: bool = False):
        """
        Auto-posts G/L entry adjustments for approved standalone or cycle-count stock adjustments.
        """
        val_diff = Decimal(str(adjustment.qty_change)) * Decimal(str(adjustment.unit_cost))
        if val_diff == 0:
            return

        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)

        # Resolve configurable accounts
        control_acc_id, gain_acc_id, loss_acc_id, _ = cls.get_inventory_accounts(db, adjustment.tenant_id)

        # Use sequential JV number
        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="ADJUSTMENT",
            reference_id=adjustment.id,
            source_module="INVENTORY",
            source_event="adjustment_approved",
            narration=f"Stock adjustment for item ID {adjustment.item_id}: {adjustment.remarks or ''}",
            status="POSTED"
        )
        db.add(je)
        db.flush()

        abs_diff = abs(val_diff)
        if val_diff > 0:
            # Positive adjustment (Asset value increased): Debit Inventory Control, Credit Gain
            l1 = models.JournalLine(
                journal_entry=je,
                account_id=control_acc_id,
                debit_amount=abs_diff,
                credit_amount=Decimal("0.0"),
                narration=f"Debit Inventory Control for adjustment gain"
            )
            l2 = models.JournalLine(
                journal_entry=je,
                account_id=gain_acc_id,
                debit_amount=Decimal("0.0"),
                credit_amount=abs_diff,
                narration=f"Credit Adjustment Gain for stock gain offset"
            )
        else:
            # Negative adjustment (Asset value decreased): Credit Inventory Control, Debit Loss
            l1 = models.JournalLine(
                journal_entry=je,
                account_id=control_acc_id,
                debit_amount=Decimal("0.0"),
                credit_amount=abs_diff,
                narration=f"Credit Inventory Control for adjustment loss"
            )
            l2 = models.JournalLine(
                journal_entry=je,
                account_id=loss_acc_id,
                debit_amount=abs_diff,
                credit_amount=Decimal("0.0"),
                narration=f"Debit Adjustment Loss for stock loss offset"
            )

        db.add(l1)
        db.add(l2)

        # Certify Trial Balance before commit
        AccountingService.validate_trial_balance(db)
        if commit:
            db.commit()
            logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for Inventory Adjustment.")
        else:
            db.flush()
            logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for Inventory Adjustment (flushed).")

    @classmethod
    def resolve_account_id_with_fallback(cls, db: Session, event_key: str, fallback_code: str) -> uuid.UUID:
        try:
            return cls.resolve_account_id(db, event_key)
        except ValueError:
            acc = db.query(models.Account).filter_by(code=fallback_code, is_deleted=False).first()
            if acc:
                return acc.id
            raise ValueError(f"Required GL Posting Configuration or fallback Account '{fallback_code}' missing for '{event_key}'.")

    @classmethod
    def handle_inventory_issue_posted(cls, payload: Dict[str, Any], db: Session):
        issue_id = payload.get("issue_id")
        if not issue_id:
            return
        
        issue = db.query(models.InventoryIssue).filter_by(id=issue_id).first()
        if not issue or issue.status != "APPROVED":
            logger.warning(f"[Posting Engine]: InventoryIssue {issue_id} not found or not in APPROVED status.")
            return

        total_cost = sum(line.total_cost for line in issue.lines)
        if total_cost <= 0:
            logger.info(f"[Posting Engine]: InventoryIssue {issue.issue_number} has zero value. Status updated to POSTED.")
            issue.status = "POSTED"
            db.flush()
            return

        posting_date = issue.issue_date or datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)

        control_acc_id = cls.resolve_account_id_with_fallback(db, "INVENTORY_CONTROL", "1200")
        cogs_acc_id = cls.resolve_account_id_with_fallback(db, "COGS_CONTROL", "5000")

        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="ISSUE",
            reference_id=issue.id,
            source_module="INVENTORY",
            source_event="inventory_issue_posted",
            narration=f"Material issue consumption journal for issue {issue.issue_number}",
            status="POSTED"
        )
        db.add(je)
        db.flush()

        l1 = models.JournalLine(
            journal_entry=je,
            account_id=cogs_acc_id,
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration=f"Debit COGS for material issue {issue.issue_number}"
        )
        l2 = models.JournalLine(
            journal_entry=je,
            account_id=control_acc_id,
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration=f"Credit Inventory Control for material issue {issue.issue_number}"
        )
        db.add(l1)
        db.add(l2)

        issue.status = "POSTED"

        AccountingService.validate_trial_balance(db)
        db.flush()
        logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for Inventory Issue {issue.issue_number}.")

    @classmethod
    def handle_inventory_scrap_posted(cls, payload: Dict[str, Any], db: Session):
        issue_id = payload.get("issue_id")
        if not issue_id:
            return
        
        issue = db.query(models.InventoryIssue).filter_by(id=issue_id).first()
        if not issue or issue.status != "APPROVED":
            logger.warning(f"[Posting Engine]: InventoryIssue {issue_id} not found or not in APPROVED status.")
            return

        total_cost = sum(line.total_cost for line in issue.lines)
        if total_cost <= 0:
            issue.status = "POSTED"
            db.flush()
            return

        posting_date = issue.issue_date or datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)

        control_acc_id = cls.resolve_account_id_with_fallback(db, "INVENTORY_CONTROL", "1200")
        scrap_acc_id = cls.resolve_account_id_with_fallback(db, "SCRAP_EXPENSE", "5100")

        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="ISSUE",
            reference_id=issue.id,
            source_module="INVENTORY",
            source_event="inventory_scrap_posted",
            narration=f"Material scrap expense journal for issue {issue.issue_number}",
            status="POSTED"
        )
        db.add(je)
        db.flush()

        l1 = models.JournalLine(
            journal_entry=je,
            account_id=scrap_acc_id,
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration=f"Debit Scrap Expense for issue {issue.issue_number}"
        )
        l2 = models.JournalLine(
            journal_entry=je,
            account_id=control_acc_id,
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration=f"Credit Inventory Control for issue {issue.issue_number}"
        )
        db.add(l1)
        db.add(l2)

        issue.status = "POSTED"

        AccountingService.validate_trial_balance(db)
        db.flush()
        logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for Inventory Scrap {issue.issue_number}.")

    @classmethod
    def handle_inventory_return_posted(cls, payload: Dict[str, Any], db: Session):
        issue_id = payload.get("issue_id")
        if not issue_id:
            return
        
        issue = db.query(models.InventoryIssue).filter_by(id=issue_id).first()
        if not issue or issue.status != "APPROVED":
            logger.warning(f"[Posting Engine]: InventoryIssue {issue_id} not found or not in APPROVED status.")
            return

        total_cost = sum(line.total_cost for line in issue.lines)
        if total_cost <= 0:
            issue.status = "POSTED"
            db.flush()
            return

        posting_date = issue.issue_date or datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)

        control_acc_id = cls.resolve_account_id_with_fallback(db, "INVENTORY_CONTROL", "1200")
        cogs_acc_id = cls.resolve_account_id_with_fallback(db, "COGS_CONTROL", "5000")

        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="ISSUE",
            reference_id=issue.id,
            source_module="INVENTORY",
            source_event="inventory_return_posted",
            narration=f"Material return reversal journal for issue {issue.issue_number}",
            status="POSTED"
        )
        db.add(je)
        db.flush()

        l1 = models.JournalLine(
            journal_entry=je,
            account_id=control_acc_id,
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration=f"Debit Inventory Control for return {issue.issue_number}"
        )
        l2 = models.JournalLine(
            journal_entry=je,
            account_id=cogs_acc_id,
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration=f"Credit COGS reversal for return {issue.issue_number}"
        )
        db.add(l1)
        db.add(l2)

        issue.status = "POSTED"

        AccountingService.validate_trial_balance(db)
        db.flush()
        logger.info(f"[Posting Engine]: Auto-posted GL journal '{entry_num}' for Inventory Return {issue.issue_number}.")

    @classmethod
    def post_transfer_dispatch(cls, db: Session, transfer: Any, user_id: uuid.UUID, commit: bool = False):
        """
        Auto-posts G/L entry adjustments for transfer dispatch (Debit In Transit, Credit Inventory Control).
        """
        total_cost = Decimal("0.0")
        for line in transfer.lines:
            total_cost += Decimal(str(line.qty_transferred)) * Decimal(str(line.unit_cost))

        if total_cost <= 0:
            return

        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)

        control_acc_id = cls.resolve_account_id_with_fallback(db, "INVENTORY_CONTROL", "1200")
        in_transit_acc_id = cls.resolve_account_id_with_fallback(db, "INVENTORY_IN_TRANSIT", "1250")

        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="TRANSFER",
            reference_id=transfer.id,
            source_module="INVENTORY",
            source_event="warehouse_transfer_dispatched",
            narration=f"GL entry for dispatch of transfer {transfer.transfer_number}",
            status="POSTED",
            created_by_id=user_id
        )
        db.add(je)
        db.flush()

        l1 = models.JournalLine(
            journal_entry=je,
            account_id=in_transit_acc_id,
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration=f"Debit Inventory In Transit for transfer {transfer.transfer_number}"
        )
        l2 = models.JournalLine(
            journal_entry=je,
            account_id=control_acc_id,
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration=f"Credit Inventory Control for transfer {transfer.transfer_number}"
        )
        db.add(l1)
        db.add(l2)

        AccountingService.validate_trial_balance(db)
        if commit:
            db.commit()
        else:
            db.flush()

    @classmethod
    def post_transfer_receipt(cls, db: Session, transfer: Any, user_id: uuid.UUID, commit: bool = False):
        """
        Auto-posts G/L entry adjustments for transfer receipt (Debit Inventory Control, Credit In Transit).
        """
        total_cost = Decimal("0.0")
        for line in transfer.lines:
            total_cost += Decimal(str(line.qty_received)) * Decimal(str(line.unit_cost))

        if total_cost <= 0:
            return

        posting_date = datetime.utcnow()
        AccountingService.validate_period_for_posting(db, posting_date)

        control_acc_id = cls.resolve_account_id_with_fallback(db, "INVENTORY_CONTROL", "1200")
        in_transit_acc_id = cls.resolve_account_id_with_fallback(db, "INVENTORY_IN_TRANSIT", "1250")

        entry_num = AccountingService.generate_journal_number(db, posting_date)
        je = models.JournalEntry(
            entry_number=entry_num,
            entry_date=posting_date,
            reference_type="TRANSFER",
            reference_id=transfer.id,
            source_module="INVENTORY",
            source_event="warehouse_transfer_received",
            narration=f"GL entry for receipt of transfer {transfer.transfer_number}",
            status="POSTED",
            created_by_id=user_id
        )
        db.add(je)
        db.flush()

        l1 = models.JournalLine(
            journal_entry=je,
            account_id=control_acc_id,
            debit_amount=total_cost,
            credit_amount=Decimal("0.0"),
            narration=f"Debit Inventory Control for transfer {transfer.transfer_number} receipt"
        )
        l2 = models.JournalLine(
            journal_entry=je,
            account_id=in_transit_acc_id,
            debit_amount=Decimal("0.0"),
            credit_amount=total_cost,
            narration=f"Credit Inventory In Transit for transfer {transfer.transfer_number} receipt"
        )
        db.add(l1)
        db.add(l2)

        AccountingService.validate_trial_balance(db)
        if commit:
            db.commit()
        else:
            db.flush()
