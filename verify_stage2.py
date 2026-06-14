import os
import sys
import uuid
import random
from decimal import Decimal
from datetime import datetime, timedelta

# Configure environment for testing/verification
os.environ["ENABLE_AUTO_POSTING_GRN"] = "true"
os.environ["ENABLE_AUTO_POSTING_INVOICE"] = "true"
os.environ["ENABLE_AUTO_POSTING_PAYMENT"] = "false"

# Add current directory to path to ensure imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend import models
from backend.services.posting_engine import PostingEngine
from backend.services.accounting_service import AccountingService
from backend.services.ledger_service import LedgerService
from backend import event_dispatcher
from tests.factories.entity_factories import UserFactory, VendorFactory, ItemFactory, WarehouseFactory, POFactory, GRNFactory, InvoiceFactory

def run_verification():
    db = SessionLocal()
    try:
        print("="*60)
        print("STAGE 2 AUTO-POSTING VERIFICATION (invoice_approved)")
        print("="*60)
        
        # 1. Ensure GL Accounts exist
        print("[Step 0] Verifying GL Accounts...")
        accounts_data = [
            {"code": "1000", "name": "Bank / Cash Account", "account_type": "ASSET"},
            {"code": "1200", "name": "Inventory Control Account", "account_type": "ASSET"},
            {"code": "1300", "name": "GST Input Receivable Account", "account_type": "ASSET"},
            {"code": "2000", "name": "Accounts Payable Control Account", "account_type": "LIABILITY"},
            {"code": "2100", "name": "GRNI Control Account (Accrual)", "account_type": "LIABILITY"},
            {"code": "2200", "name": "TDS Payable Control Account", "account_type": "LIABILITY"},
        ]
        accounts_by_code = {}
        for data in accounts_data:
            acc = db.query(models.Account).filter_by(code=data["code"], is_deleted=False).first()
            if not acc:
                acc = models.Account(
                    code=data["code"],
                    name=data["name"],
                    account_type=data["account_type"],
                    is_active=True
                )
                db.add(acc)
                db.flush()
                print(f"Created Account {data['code']}")
            else:
                print(f"Found existing Account {data['code']}")
            accounts_by_code[data["code"]] = acc

        print("\nVerifying Fiscal Year & Accounting Periods...")
        today = datetime.utcnow()
        fy_name = f"FY {today.year}"
        fy = db.query(models.FiscalYear).filter_by(name=fy_name, is_deleted=False).first()
        if not fy:
            fy = models.FiscalYear(
                name=fy_name,
                start_date=datetime(today.year, 1, 1),
                end_date=datetime(today.year, 12, 31, 23, 59, 59),
                status="OPEN"
            )
            db.add(fy)
            db.flush()
            print(f"Created Fiscal Year {fy_name}")
        
        period_name = today.strftime("%Y-%m")
        period = db.query(models.AccountingPeriod).filter_by(period_name=period_name, is_deleted=False).first()
        if not period:
            period = models.AccountingPeriod(
                period_name=period_name,
                start_date=datetime(today.year, today.month, 1),
                end_date=datetime(today.year, today.month, 28) + timedelta(days=4),
                status="OPEN",
                fiscal_year_id=fy.id
            )
            db.add(period)
            db.flush()
            print(f"Created Accounting Period {period_name}")
        else:
            if period.fiscal_year_id is None:
                period.fiscal_year_id = fy.id
                db.flush()

        print("\nVerifying Posting Configurations...")
        configs = [
            {"event_key": "INVENTORY_RECEIPT", "account_code": "1200"},
            {"event_key": "GRNI_ACCRUAL", "account_code": "2100"},
            {"event_key": "GST_RECEIVABLE", "account_code": "1300"},
            {"event_key": "TDS_PAYABLE", "account_code": "2200"},
            {"event_key": "AP_CONTROL", "account_code": "2000"},
        ]
        for cfg in configs:
            existing = db.query(models.PostingConfiguration).filter_by(event_key=cfg["event_key"], is_deleted=False).first()
            if not existing:
                p_cfg = models.PostingConfiguration(
                    event_key=cfg["event_key"],
                    account_id=accounts_by_code[cfg["account_code"]].id
                )
                db.add(p_cfg)
                db.flush()
                print(f"Mapped {cfg['event_key']} -> Account {cfg['account_code']}")
            else:
                print(f"Posting Configuration exists for {cfg['event_key']}")

        # Register listeners
        PostingEngine.register_listeners(force=True)

        # 2. Get initial balances
        grni_acc_id = accounts_by_code["2100"].id
        ap_acc_id = accounts_by_code["2000"].id
        gst_acc_id = accounts_by_code["1300"].id
        
        initial_grni_tb = LedgerService.get_account_ledger(db, grni_acc_id)
        initial_grni_bal = initial_grni_tb["lines"][0]["running_balance"] if initial_grni_tb["lines"] else 0.0
        
        initial_ap_tb = LedgerService.get_account_ledger(db, ap_acc_id)
        initial_ap_bal = initial_ap_tb["lines"][0]["running_balance"] if initial_ap_tb["lines"] else 0.0

        initial_gst_tb = LedgerService.get_account_ledger(db, gst_acc_id)
        initial_gst_bal = initial_gst_tb["lines"][0]["running_balance"] if initial_gst_tb["lines"] else 0.0

        print(f"\nInitial Account Ledger Balances:")
        print(f" - GRNI (2100): {initial_grni_bal:.2f} (Credit)")
        print(f" - Accounts Payable (2000): {initial_ap_bal:.2f} (Credit)")
        print(f" - GST Input Receivable (1300): {initial_gst_bal:.2f} (Debit)")

        # 3. Create fresh PO -> GRN chain
        print("\nCreating Procurement Chain...")
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
        po = POFactory.create(
            db, vendor=vendor, warehouse=warehouse, created_by=user,
            po_number=f"PO-STG2-{rand_suffix}", total_amount=Decimal("15000.00"), status=models.POStatus.ISSUED
        )
        grn = GRNFactory.create(
            db, po=po, warehouse=warehouse, received_by=user,
            grn_number=f"GRN-STG2-{rand_suffix}", subtotal=Decimal("15000.00"), total_amount=Decimal("17700.00"), status="APPROVED"
        )
        db.commit()
        print(f"PO created: {po.po_number}, GRN created: {grn.grn_number}")

        # Post GRN
        print("Dispatching 'goods_received' event for GRN...")
        event_dispatcher.dispatch(
            "goods_received",
            {
                "grn_id": grn.id,
                "grn_number": grn.grn_number,
                "po_number": po.po_number,
                "total_accepted": 10
            },
            db
        )
        db.commit()
        
        # Verify GRN balance updates
        after_grn_tb = LedgerService.get_account_ledger(db, grni_acc_id)
        after_grn_bal = after_grn_tb["lines"][0]["running_balance"] if after_grn_tb["lines"] else 0.0
        print(f"GRNI Balance after GRN posting: {after_grn_bal:.2f} (Credit)")

        # 4. Create Invoice from GRN
        print("\nCreating Invoice from GRN...")
        invoice = InvoiceFactory.create(
            db, vendor=vendor, po=po, grn=grn, created_by=user,
            invoice_number=f"INV-STG2-{rand_suffix}",
            total_amount=Decimal("17550.00"),  # Net liability (base 15000 + GST 2700 - TDS 150)
            gst_amount=Decimal("2700.00"),      # 18% of 15000
            tds_deducted=Decimal("150.00"),     # 1% of 15000
            status=models.InvoiceStatus.PENDING_MATCHING
        )
        db.commit()
        print(f"Invoice created: {invoice.invoice_number}")

        # 5. Dispatch invoice_approved event
        print("\n[Action] Dispatching 'invoice_approved' event for Invoice...")
        event_dispatcher.dispatch(
            "invoice_approved",
            {
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "liability_id": uuid.uuid4(),
                "total_amount": float(invoice.total_amount)
            },
            db
        )
        db.commit()

        print("\n" + "="*50)
        print("STAGE 2 POSTING VALIDATIONS:")
        print("="*50)

        # Validation 1: Verify Journal Entry created automatically
        je = db.query(models.JournalEntry).filter_by(
            reference_type="INVOICE", reference_id=invoice.id
        ).first()
        if not je:
            print("[FAIL] Validation 1: No Journal Entry created for Invoice approval.")
            return
        print(f"[PASS] Validation 1: Journal Entry auto-posted successfully (ID: {je.id})")

        # Validation 2: Verify sequential JV numbering sequence and source tracking
        print(f"Journal Entry Number: {je.entry_number}")
        if not je.entry_number.startswith("JV-2026-"):
            print("[FAIL] Validation 2: Journal numbering sequence invalid.")
            return
        print("[PASS] Validation 2: Sequential JV numbering matches 'JV-YYYY-XXXXXX'.")

        # Validation 3: Verify source_module and source_event populated
        print(f"Source Module: {je.source_module}, Source Event: {je.source_event}")
        if je.source_module != "PROCUREMENT" or je.source_event != "invoice_approved":
            print("[FAIL] Validation 3: Source tracking module/event mismatch.")
            return
        print("[PASS] Validation 3: Source tracking attributes successfully recorded.")

        # Validation 4: Verify GRNI Clearance (Credit balance decreases)
        after_inv_grn_tb = LedgerService.get_account_ledger(db, grni_acc_id)
        after_inv_grn_bal = after_inv_grn_tb["lines"][0]["running_balance"] if after_inv_grn_tb["lines"] else 0.0
        print(f"GRNI Running Balance: {after_inv_grn_bal:.2f} (Credit)")
        # Expected: GRNI should have cleared back to initial_grni_bal (since GRN credited 15k and Invoice debited 15k)
        if abs(after_inv_grn_bal - initial_grni_bal) > 0.01:
            print(f"[FAIL] Validation 4: GRNI Account was not cleared correctly. Balance: {after_inv_grn_bal:.2f}")
            return
        print("[PASS] Validation 4: GRNI Control Account balance cleared correctly (moved toward zero/initial).")

        # Validation 5: Verify AP Recognition
        after_inv_ap_tb = LedgerService.get_account_ledger(db, ap_acc_id)
        after_inv_ap_bal = after_inv_ap_tb["lines"][0]["running_balance"] if after_inv_ap_tb["lines"] else 0.0
        print(f"Accounts Payable Balance: {after_inv_ap_bal:.2f} (Credit)")
        # Expected: AP should increase by 17,550.00
        expected_ap_change = Decimal("17550.00")
        actual_ap_change = Decimal(str(after_inv_ap_bal - initial_ap_bal))
        if abs(actual_ap_change - expected_ap_change) > Decimal("0.01"):
            print(f"[FAIL] Validation 5: AP Balance mismatch. Expected change: {expected_ap_change}, Actual change: {actual_ap_change}")
            return
        print("[PASS] Validation 5: Accounts Payable Control Account balance increased correctly.")

        # Validation 6: Verify GST Recognition
        after_inv_gst_tb = LedgerService.get_account_ledger(db, gst_acc_id)
        after_inv_gst_bal = after_inv_gst_tb["lines"][0]["running_balance"] if after_inv_gst_tb["lines"] else 0.0
        print(f"GST Input Receivable Balance: {after_inv_gst_bal:.2f} (Debit)")
        # Expected: GST should increase by 2,700.00
        expected_gst_change = Decimal("2700.00")
        actual_gst_change = Decimal(str(after_inv_gst_bal - initial_gst_bal))
        if abs(actual_gst_change - expected_gst_change) > Decimal("0.01"):
            print(f"[FAIL] Validation 6: GST Balance mismatch. Expected change: {expected_gst_change}, Actual: {actual_gst_change}")
            return
        print("[PASS] Validation 6: GST Input Receivable Account successfully debited.")

        # Validation 7: Verify Trial Balance remains balanced
        tb = LedgerService.get_trial_balance(db)
        print(f"Trial Balance Parity Check - Debit: {tb['total_debit']:.2f}, Credit: {tb['total_credit']:.2f}, Balanced: {tb['is_balanced']}")
        if not tb['is_balanced']:
            print("[FAIL] Validation 7: Trial Balance is out of balance!")
            return
        print("[PASS] Validation 7: Trial Balance remains balanced.")

        # Validation 8: Verify entry appears in GL, AL, TB
        gl = LedgerService.get_general_ledger(db)
        found_in_gl = False
        for entry in gl:
            if entry["entry_id"] == str(je.id):
                found_in_gl = True
                print(f"Found Invoice Voucher in General Ledger: {entry['entry_number']}")
                for l in entry["lines"]:
                    print(f"   Line: Code={l['account_code']}, Debit={l['debit']:.2f}, Credit={l['credit']:.2f}, Narration={l['narration']}")
                break
        if not found_in_gl:
            print("[FAIL] Validation 8: Invoice voucher entry missing from General Ledger.")
            return
        print("[PASS] Validation 8: General Ledger correctly displays the invoice entry.")
        
        print("="*60)
        print("STAGE 2 COMPLETED SUCCESSFULLY!")
        print("="*60)

    except Exception as e:
        print(f"[ERROR] Error during verification: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_verification()
