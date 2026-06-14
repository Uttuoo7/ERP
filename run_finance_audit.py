import os
import sys
import uuid
import random
import time
from decimal import Decimal
from datetime import datetime, timedelta

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend import models, schemas
from backend.services.posting_engine import PostingEngine
from backend.services.accounting_service import AccountingService
from backend.services.ledger_service import LedgerService
from backend import event_dispatcher
from backend.finance_engine import record_vendor_payment
from tests.factories.entity_factories import UserFactory, VendorFactory, ItemFactory, WarehouseFactory, POFactory, GRNFactory, InvoiceFactory

def run_audit():
    db = SessionLocal()
    try:
        print("Starting Finance Core Audit...")

        # -------------------------------------------------------------
        # 0. Set up Stage 3 active posting in environment
        # -------------------------------------------------------------
        os.environ["ENABLE_AUTO_POSTING_GRN"] = "true"
        os.environ["ENABLE_AUTO_POSTING_INVOICE"] = "true"
        os.environ["ENABLE_AUTO_POSTING_PAYMENT"] = "true"
        PostingEngine.register_listeners(force=True)

        user = db.query(models.User).filter_by(role=models.Role.ADMIN).first()
        if not user:
            user = UserFactory.create(db, role=models.Role.ADMIN)
        vendor = db.query(models.Vendor).first()
        if not vendor:
            vendor = VendorFactory.create(db)
        warehouse = db.query(models.Warehouse).first()
        if not warehouse:
            warehouse = WarehouseFactory.create(db)
            
        rand_suffix = f"{random.randint(1000, 9999)}"
        today = datetime.utcnow()

        # -------------------------------------------------------------
        # 1. Create E2E Procure-to-Pay Chain for audit evidence
        # -------------------------------------------------------------
        print("Creating PR -> RFQ -> PO -> GRN -> Invoice -> Payment...")
        # Requisition
        pr = models.PurchaseRequisition(
            id=uuid.uuid4(),
            pr_number=f"PR-AUD-{rand_suffix}",
            requester_id=user.id,
            status="APPROVED",
            required_date=datetime.utcnow() + timedelta(days=30),
            remarks="Audit verification replenishment",
        )
        db.add(pr)
        db.flush()

        # RFQ
        rfq = models.RequestForQuotation(
            id=uuid.uuid4(),
            rfq_number=f"RFQ-AUD-{rand_suffix}",
            buyer_id=user.id,
            due_date=datetime.utcnow() + timedelta(days=7),
            status="QUOTED",
            created_by_id=user.id,
        )
        db.add(rfq)
        db.flush()

        # PO
        po = POFactory.create(
            db, vendor=vendor, warehouse=warehouse, created_by=user,
            po_number=f"PO-AUD-{rand_suffix}", total_amount=Decimal("15000.00"),
            linked_rfq_id=rfq.id, status=models.POStatus.ISSUED
        )

        # GRN
        grn = GRNFactory.create(
            db, po=po, warehouse=warehouse, received_by=user,
            grn_number=f"GRN-AUD-{rand_suffix}", subtotal=Decimal("15000.00"),
            total_amount=Decimal("17700.00"), status="APPROVED"
        )
        db.commit()

        # Post GRN
        event_dispatcher.dispatch(
            "goods_received",
            {"grn_id": grn.id, "grn_number": grn.grn_number, "po_number": po.po_number, "total_accepted": 10},
            db
        )
        db.commit()

        # Invoice
        invoice = InvoiceFactory.create(
            db, vendor=vendor, po=po, grn=grn, created_by=user,
            invoice_number=f"INV-AUD-{rand_suffix}",
            total_amount=Decimal("17550.00"),
            gst_amount=Decimal("2700.00"),
            tds_deducted=Decimal("150.00"),
            status=models.InvoiceStatus.PENDING_MATCHING
        )
        db.commit()

        # Post Invoice
        event_dispatcher.dispatch(
            "invoice_approved",
            {"invoice_id": invoice.id, "invoice_number": invoice.invoice_number, "liability_id": uuid.uuid4(), "total_amount": float(invoice.total_amount)},
            db
        )
        db.commit()

        # Liability
        liability = models.VendorLiability(
            vendor_id=vendor.id,
            invoice_id=invoice.id,
            original_amount=Decimal("17550.00"),
            outstanding_amount=Decimal("17550.00"),
            due_date=datetime.utcnow() + timedelta(days=30),
            status="UNPAID"
        )
        db.add(liability)
        db.flush()
        db.commit()

        # Payment
        allocations = [
            schemas.InvoiceAllocationCreate(
                vendor_liability_id=liability.id,
                allocated_amount=Decimal("17550.00")
            )
        ]
        tx = record_vendor_payment(
            db=db,
            vendor_id=vendor.id,
            amount=Decimal("17550.00"),
            payment_method="BANK_TRANSFER",
            ref_no=f"PAY-AUD-{rand_suffix}",
            invoice_allocations=allocations,
            user_id=user.id
        )
        db.commit()

        # -------------------------------------------------------------
        # Audit Item 1: General Ledger Integrity
        # -------------------------------------------------------------
        all_je = db.query(models.JournalEntry).order_by(models.JournalEntry.entry_number.asc()).all()
        total_je_count = len(all_je)
        total_lines_count = db.query(models.JournalLine).count()
        first_jv = all_je[0].entry_number if all_je else "N/A"
        latest_jv = all_je[-1].entry_number if all_je else "N/A"

        # Check gaps & duplicates & orphans
        jv_numbers = [je.entry_number for je in all_je]
        duplicates = [x for x in set(jv_numbers) if jv_numbers.count(x) > 1]
        
        gaps = []
        numbers_by_year = {}
        for num in jv_numbers:
            try:
                parts = num.split("-")
                year = int(parts[1])
                seq = int(parts[2])
                numbers_by_year.setdefault(year, []).append(seq)
            except Exception:
                continue

        for year, seqs in numbers_by_year.items():
            seqs.sort()
            if seqs:
                for idx in range(seqs[0], seqs[-1] + 1):
                    if idx not in seqs:
                        gaps.append(f"JV-{year}-{idx:06d}")

        orphans = db.query(models.JournalLine).filter(
            ~models.JournalLine.journal_entry_id.in_([je.id for je in all_je])
        ).all()

        print(f"Total Journal Entries: {total_je_count}")
        print(f"Total Journal Lines: {total_lines_count}")
        print(f"First JV Number: {first_jv}")
        print(f"Latest JV Number: {latest_jv}")
        print(f"Duplicates: {duplicates}")
        print(f"Gaps: {gaps}")
        print(f"Orphans count: {len(orphans)}")

        # -------------------------------------------------------------
        # Audit Item 2: Trial Balance Certification
        # -------------------------------------------------------------
        tb = LedgerService.get_trial_balance(db)
        tb_diff = abs(tb["total_debit"] - tb["total_credit"])
        print(f"TB Debit: {tb['total_debit']}, Credit: {tb['total_credit']}, Diff: {tb_diff}")

        # -------------------------------------------------------------
        # Audit Item 3: P2P Vouchers Details
        # -------------------------------------------------------------
        # GRN Voucher
        je_grn = db.query(models.JournalEntry).filter_by(reference_type="GRN", reference_id=grn.id).first()
        # Invoice Voucher
        je_inv = db.query(models.JournalEntry).filter_by(reference_type="INVOICE", reference_id=invoice.id).first()
        # Payment Voucher
        je_pay = db.query(models.JournalEntry).filter_by(reference_type="PAYMENT", reference_id=tx.id).first()

        def format_voucher(je):
            if not je: return "Not Found"
            lines_str = []
            for l in je.journal_lines:
                lines_str.append(f"      Code: {l.account.code} ({l.account.name}), Dr: {l.debit_amount:.2f}, Cr: {l.credit_amount:.2f}")
            return {
                "number": je.entry_number,
                "event": je.source_event,
                "module": je.source_module,
                "lines": "\n".join(lines_str),
                "total_amount": sum(l.debit_amount for l in je.journal_lines)
            }

        v_grn = format_voucher(je_grn)
        v_inv = format_voucher(je_inv)
        v_pay = format_voucher(je_pay)

        # -------------------------------------------------------------
        # Audit Item 4: AP Reconciliation
        # -------------------------------------------------------------
        ap_acc = db.query(models.Account).filter_by(code="2000").first()
        ap_tb = LedgerService.get_account_ledger(db, ap_acc.id)
        ap_bal = ap_tb["lines"][0]["running_balance"] if ap_tb["lines"] else 0.0

        all_liabs = db.query(models.VendorLiability).all()
        liab_total = sum(l.outstanding_amount for l in all_liabs)
        print(f"AP Control Account Balance: {ap_bal:.2f}")
        print(f"Total Outstanding Liabilities: {liab_total:.2f}")

        # -------------------------------------------------------------
        # Audit Item 5: GRNI Reconciliation
        # -------------------------------------------------------------
        grni_acc = db.query(models.Account).filter_by(code="2100").first()
        grni_tb = LedgerService.get_account_ledger(db, grni_acc.id)
        grni_bal = grni_tb["lines"][0]["running_balance"] if grni_tb["lines"] else 0.0

        all_grns = db.query(models.GoodsReceiptNote).all()
        uninvoiced_grn_val = Decimal("0.0")
        for g in all_grns:
            # check if invoice exists
            inv = db.query(models.Invoice).filter_by(grn_id=g.id).first()
            if not inv:
                uninvoiced_grn_val += g.subtotal
            else:
                # If partial, but here we assume full matching
                pass

        print(f"GRNI Control Account Balance: {grni_bal:.2f}")
        print(f"Uninvoiced GRN Value: {uninvoiced_grn_val:.2f}")

        # -------------------------------------------------------------
        # Audit Item 6: Reversal Verification
        # -------------------------------------------------------------
        # Create manual journal
        acc_bank = db.query(models.Account).filter_by(code="1000").first()
        acc_inventory = db.query(models.Account).filter_by(code="1200").first()

        je_man_num = AccountingService.generate_journal_number(db, datetime.utcnow())
        je_man = models.JournalEntry(
            entry_number=je_man_num,
            entry_date=datetime.utcnow(),
            reference_type="MANUAL",
            reference_id=uuid.uuid4(),
            source_module="FINANCE",
            source_event="manual_journal",
            narration="Audit manual journal reversal check",
            status="POSTED"
        )
        db.add(je_man)
        db.flush()
        db.add(models.JournalLine(journal_entry=je_man, account_id=acc_bank.id, debit_amount=Decimal("100.00"), credit_amount=Decimal("0.0")))
        db.add(models.JournalLine(journal_entry=je_man, account_id=acc_inventory.id, debit_amount=Decimal("0.0"), credit_amount=Decimal("100.00")))
        db.commit()

        # Reversal
        je_rev = AccountingService.reverse_journal_entry(db, je_man.id)
        db.commit()

        print(f"Original JV: {je_man.entry_number} (ID: {je_man.id})")
        print(f"Reversal JV: {je_rev.entry_number} (ID: {je_rev.id})")
        print(f"Reversal points to: {je_rev.reversal_of_journal_entry_id}")

        # -------------------------------------------------------------
        # Audit Item 7: Closed Period Verification
        # -------------------------------------------------------------
        # Attempt to post in CLOSED year
        fy_closed = db.query(models.FiscalYear).filter_by(name="FY CLOSED TEST", is_deleted=False).first()
        if not fy_closed:
            fy_closed = models.FiscalYear(
                name="FY CLOSED TEST",
                start_date=datetime(2020, 1, 1),
                end_date=datetime(2020, 12, 31),
                status="CLOSED"
            )
            db.add(fy_closed)
            db.flush()
            
        period_closed = db.query(models.AccountingPeriod).filter_by(period_name="2020-06", is_deleted=False).first()
        if not period_closed:
            period_closed = models.AccountingPeriod(
                period_name="2020-06",
                start_date=datetime(2020, 6, 1),
                end_date=datetime(2020, 6, 30),
                status="OPEN",
                fiscal_year_id=fy_closed.id
            )
            db.add(period_closed)
            db.flush()
        else:
            period_closed.fiscal_year_id = fy_closed.id
            db.flush()
        db.commit()

        closed_fy_err = "No error"
        try:
            AccountingService.validate_period_for_posting(db, datetime(2020, 6, 15))
        except Exception as e:
            closed_fy_err = str(e)
            print(f"Closed FY rejection validation PASS: {closed_fy_err}")

        # Attempt to post in LOCKED period
        fy = db.query(models.FiscalYear).filter_by(name=f"FY {today.year}").first()
        period_locked = db.query(models.AccountingPeriod).filter_by(period_name="2026-01", is_deleted=False).first()
        if not period_locked:
            period_locked = models.AccountingPeriod(
                period_name="2026-01",
                start_date=datetime(today.year, 1, 1),
                end_date=datetime(today.year, 1, 31),
                status="LOCKED",
                fiscal_year_id=fy.id
            )
            db.add(period_locked)
            db.flush()
        else:
            period_locked.status = "LOCKED"
            db.flush()
        db.commit()

        locked_period_err = "No error"
        try:
            AccountingService.validate_period_for_posting(db, datetime(today.year, 1, 15))
        except Exception as e:
            locked_period_err = str(e)
            print(f"Locked period rejection validation PASS: {locked_period_err}")

        # -------------------------------------------------------------
        # Audit Item 8: Dashboard KPIs
        # -------------------------------------------------------------
        cash_pos = LedgerService.get_account_ledger(db, db.query(models.Account).filter_by(code="1000").first().id)
        cash_val = cash_pos["lines"][0]["running_balance"] if cash_pos["lines"] else 0.0

        ap_val = ap_bal
        grni_val = grni_bal
        tds_acc = db.query(models.Account).filter_by(code="2200").first()
        tds_tb = LedgerService.get_account_ledger(db, tds_acc.id)
        tds_val = tds_tb["lines"][0]["running_balance"] if tds_tb["lines"] else 0.0

        total_liab = ap_val + grni_val + tds_val

        # -------------------------------------------------------------
        # Audit Item 9: Performance Validation
        # -------------------------------------------------------------
        # Manual journal creation performance
        t0 = time.time()
        je_p_num = AccountingService.generate_journal_number(db, datetime.utcnow())
        je_p = models.JournalEntry(
            entry_number=je_p_num, 
            entry_date=datetime.utcnow(), 
            reference_type="MANUAL", 
            reference_id=uuid.uuid4(), 
            source_module="FINANCE",
            source_event="manual_journal",
            status="POSTED"
        )
        db.add(je_p)
        db.flush()
        db.add(models.JournalLine(journal_entry=je_p, account_id=acc_bank.id, debit_amount=Decimal("10.00"), credit_amount=Decimal("0.0")))
        db.add(models.JournalLine(journal_entry=je_p, account_id=acc_inventory.id, debit_amount=Decimal("0.0"), credit_amount=Decimal("10.00")))
        db.commit()
        time_create = (time.time() - t0) * 1000

        # Reversal performance
        t0 = time.time()
        AccountingService.reverse_journal_entry(db, je_p.id)
        db.commit()
        time_reverse = (time.time() - t0) * 1000

        # Trial balance performance
        t0 = time.time()
        LedgerService.get_trial_balance(db)
        time_tb = (time.time() - t0) * 1000

        # General Ledger performance
        t0 = time.time()
        LedgerService.get_general_ledger(db)
        time_gl = (time.time() - t0) * 1000

        print(f"Time to create manual journal: {time_create:.2f} ms")
        print(f"Time to reverse journal: {time_reverse:.2f} ms")
        print(f"Time to run Trial Balance: {time_tb:.2f} ms")
        print(f"Time to run General Ledger report: {time_gl:.2f} ms")

        # -------------------------------------------------------------
        # Write Output Data
        # -------------------------------------------------------------
        print("\n\n=== EXPORTING AUDIT METRICS ===")
        print(f"METRIC:total_je={total_je_count}")
        print(f"METRIC:total_jl={total_lines_count}")
        print(f"METRIC:first_jv={first_jv}")
        print(f"METRIC:latest_jv={latest_jv}")
        print(f"METRIC:tb_debit={tb['total_debit']}")
        print(f"METRIC:tb_credit={tb['total_credit']}")
        print(f"METRIC:tb_diff={tb_diff}")
        print(f"METRIC:ap_bal={ap_bal}")
        print(f"METRIC:liab_total={liab_total}")
        print(f"METRIC:grni_bal={grni_bal}")
        print(f"METRIC:uninvoiced_grn={uninvoiced_grn_val}")
        print(f"METRIC:time_create={time_create:.2f}")
        print(f"METRIC:time_reverse={time_reverse:.2f}")
        print(f"METRIC:time_tb={time_tb:.2f}")
        print(f"METRIC:time_gl={time_gl:.2f}")
        print(f"METRIC:closed_fy_err={closed_fy_err}")
        print(f"METRIC:locked_period_err={locked_period_err}")
        print(f"METRIC:pr_num={pr.pr_number}")
        print(f"METRIC:rfq_num={rfq.rfq_number}")
        print(f"METRIC:po_num={po.po_number}")
        print(f"METRIC:grn_num={grn.grn_number}")
        print(f"METRIC:invoice_num={invoice.invoice_number}")
        print(f"METRIC:pay_num={tx.transaction_number}")
        
        print(f"METRIC:v_grn_num={v_grn['number']}")
        print(f"METRIC:v_grn_event={v_grn['event']}")
        print(f"METRIC:v_grn_lines={v_grn['lines']}")
        print(f"METRIC:v_grn_total={v_grn['total_amount']:.2f}")

        print(f"METRIC:v_inv_num={v_inv['number']}")
        print(f"METRIC:v_inv_event={v_inv['event']}")
        print(f"METRIC:v_inv_lines={v_inv['lines']}")
        print(f"METRIC:v_inv_total={v_inv['total_amount']:.2f}")

        print(f"METRIC:v_pay_num={v_pay['number']}")
        print(f"METRIC:v_pay_event={v_pay['event']}")
        print(f"METRIC:v_pay_lines={v_pay['lines']}")
        print(f"METRIC:v_pay_total={v_pay['total_amount']:.2f}")
        
        print(f"METRIC:je_man_num={je_man.entry_number}")
        print(f"METRIC:je_man_id={je_man.id}")
        print(f"METRIC:je_rev_num={je_rev.entry_number}")
        print(f"METRIC:je_rev_id={je_rev.id}")
        
        print(f"METRIC:kpi_cash={cash_val:.2f}")
        print(f"METRIC:kpi_ap={ap_val:.2f}")
        print(f"METRIC:kpi_grni={grni_val:.2f}")
        print(f"METRIC:kpi_total_liab={total_liab:.2f}")

    finally:
        db.close()

if __name__ == "__main__":
    run_audit()
