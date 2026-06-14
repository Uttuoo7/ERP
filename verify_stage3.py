import os
import sys
import uuid
import random
from decimal import Decimal
from datetime import datetime, timedelta

# Configure environment for testing/verification
os.environ["ENABLE_AUTO_POSTING_GRN"] = "true"
os.environ["ENABLE_AUTO_POSTING_INVOICE"] = "true"
os.environ["ENABLE_AUTO_POSTING_PAYMENT"] = "true"

# Add current directory to path to ensure imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend import models, schemas
from backend.services.posting_engine import PostingEngine
from backend.services.accounting_service import AccountingService
from backend.services.ledger_service import LedgerService
from backend import event_dispatcher
from backend.finance_engine import record_vendor_payment
from tests.factories.entity_factories import UserFactory, VendorFactory, ItemFactory, WarehouseFactory, POFactory, GRNFactory, InvoiceFactory

def run_verification():
    db = SessionLocal()
    try:
        print("="*60)
        print("STAGE 3 AUTO-POSTING VERIFICATION (payment_allocated)")
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
            {"event_key": "BANK_CONTROL", "account_code": "1000"},
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
        bank_acc_id = accounts_by_code["1000"].id
        ap_acc_id = accounts_by_code["2000"].id
        
        initial_bank_tb = LedgerService.get_account_ledger(db, bank_acc_id)
        initial_bank_bal = initial_bank_tb["lines"][0]["running_balance"] if initial_bank_tb["lines"] else 0.0
        
        initial_ap_tb = LedgerService.get_account_ledger(db, ap_acc_id)
        initial_ap_bal = initial_ap_tb["lines"][0]["running_balance"] if initial_ap_tb["lines"] else 0.0

        print(f"\nInitial Account Ledger Balances:")
        print(f" - Accounts Payable (2000): {initial_ap_bal:.2f} (Credit)")
        print(f" - Bank / Cash (1000): {initial_bank_bal:.2f} (Debit)")

        # 3. Create fresh PO -> GRN -> Invoice chain
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
            po_number=f"PO-STG3-{rand_suffix}", total_amount=Decimal("15000.00"), status=models.POStatus.ISSUED
        )
        grn = GRNFactory.create(
            db, po=po, warehouse=warehouse, received_by=user,
            grn_number=f"GRN-STG3-{rand_suffix}", subtotal=Decimal("15000.00"), total_amount=Decimal("17700.00"), status="APPROVED"
        )
        db.commit()
        print(f"PO created: {po.po_number}, GRN created: {grn.grn_number}")

        # Post GRN
        print("Dispatching 'goods_received' event for GRN...")
        event_dispatcher.dispatch(
            "goods_received",
            {"grn_id": grn.id, "grn_number": grn.grn_number, "po_number": po.po_number, "total_accepted": 10},
            db
        )
        db.commit()
        
        # Create Invoice
        invoice = InvoiceFactory.create(
            db, vendor=vendor, po=po, grn=grn, created_by=user,
            invoice_number=f"INV-STG3-{rand_suffix}",
            total_amount=Decimal("17550.00"),  # Net liability (base 15000 + GST 2700 - TDS 150)
            gst_amount=Decimal("2700.00"),
            tds_deducted=Decimal("150.00"),
            status=models.InvoiceStatus.PENDING_MATCHING
        )
        db.commit()
        print(f"Invoice created: {invoice.invoice_number}")

        # Post Invoice
        print("Dispatching 'invoice_approved' event for Invoice...")
        event_dispatcher.dispatch(
            "invoice_approved",
            {"invoice_id": invoice.id, "invoice_number": invoice.invoice_number, "liability_id": uuid.uuid4(), "total_amount": float(invoice.total_amount)},
            db
        )
        db.commit()

        # Let's create the VendorLiability record manually so we can pay against it
        print("Creating VendorLiability record...")
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

        # Check AP balance before payment
        after_inv_ap_tb = LedgerService.get_account_ledger(db, ap_acc_id)
        after_inv_ap_bal = after_inv_ap_tb["lines"][0]["running_balance"] if after_inv_ap_tb["lines"] else 0.0
        print(f"Accounts Payable Balance before payment: {after_inv_ap_bal:.2f} (Credit)")

        # 4. Perform Payment Allocation
        print("\nRecording Vendor Payment Allocation...")
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
            ref_no=f"PAY-STG3-{rand_suffix}",
            invoice_allocations=allocations,
            user_id=user.id
        )
        db.commit()
        print(f"Payment transaction recorded: {tx.transaction_number}")

        print("\n" + "="*50)
        print("STAGE 3 POSTING VALIDATIONS:")
        print("="*50)

        # Validation 1: Verify Journal Entry created automatically for Payment
        je = db.query(models.JournalEntry).filter_by(
            reference_type="PAYMENT", reference_id=tx.id
        ).first()
        if not je:
            print("[FAIL] Validation 1: No Journal Entry created for Payment allocation.")
            return
        print(f"[PASS] Validation 1: Journal Entry auto-posted successfully (ID: {je.id})")

        # Validation 2: Verify sequential JV numbering sequence
        print(f"Journal Entry Number: {je.entry_number}")
        if not je.entry_number.startswith("JV-2026-"):
            print("[FAIL] Validation 2: Journal numbering sequence invalid.")
            return
        print("[PASS] Validation 2: Sequential JV numbering matches 'JV-YYYY-XXXXXX'.")

        # Validation 3: Verify source_module and source_event populated
        print(f"Source Module: {je.source_module}, Source Event: {je.source_event}")
        if je.source_module != "FINANCE" or je.source_event != "payment_allocated":
            print("[FAIL] Validation 3: Source tracking module/event mismatch.")
            return
        print("[PASS] Validation 3: Source tracking attributes successfully recorded.")

        # Validation 4: Verify AP Control Account balance decreases (Debited)
        after_pay_ap_tb = LedgerService.get_account_ledger(db, ap_acc_id)
        after_pay_ap_bal = after_pay_ap_tb["lines"][0]["running_balance"] if after_pay_ap_tb["lines"] else 0.0
        print(f"AP Running Balance: {after_pay_ap_bal:.2f} (Credit)")
        # Expected: AP balance should have gone down by 17,550.00 from after_inv_ap_bal
        actual_ap_decrease = Decimal(str(after_inv_ap_bal - after_pay_ap_bal))
        if abs(actual_ap_decrease - Decimal("17550.00")) > Decimal("0.01"):
            print(f"[FAIL] Validation 4: AP Balance decrease mismatch. Expected 17550.00, got: {actual_ap_decrease}")
            return
        print("[PASS] Validation 4: Accounts Payable Control Account balance decreased correctly.")

        # Validation 5: Verify Bank / Cash Account balance decreases (Credited)
        after_pay_bank_tb = LedgerService.get_account_ledger(db, bank_acc_id)
        after_pay_bank_bal = after_pay_bank_tb["lines"][0]["running_balance"] if after_pay_bank_tb["lines"] else 0.0
        print(f"Bank Running Balance: {after_pay_bank_bal:.2f} (Debit)")
        # Expected: Bank balance should decrease by 17,550.00 from initial_bank_bal
        actual_bank_decrease = Decimal(str(initial_bank_bal - after_pay_bank_bal))
        if abs(actual_bank_decrease - Decimal("17550.00")) > Decimal("0.01"):
            print(f"[FAIL] Validation 5: Bank Balance decrease mismatch. Expected 17550.00, got: {actual_bank_decrease}")
            return
        print("[PASS] Validation 5: Bank / Cash Account balance decreased correctly.")

        # Validation 6: Verify Trial Balance remains balanced
        tb = LedgerService.get_trial_balance(db)
        print(f"Trial Balance Parity Check - Debit: {tb['total_debit']:.2f}, Credit: {tb['total_credit']:.2f}, Balanced: {tb['is_balanced']}")
        if not tb['is_balanced']:
            print("[FAIL] Validation 6: Trial Balance is out of balance!")
            return
        print("[PASS] Validation 6: Trial Balance remains balanced.")

        # Validation 7: Verify entry appears in GL, AL, TB
        gl = LedgerService.get_general_ledger(db)
        found_in_gl = False
        for entry in gl:
            if entry["entry_id"] == str(je.id):
                found_in_gl = True
                print(f"Found Payment Voucher in General Ledger: {entry['entry_number']}")
                for l in entry["lines"]:
                    print(f"   Line: Code={l['account_code']}, Debit={l['debit']:.2f}, Credit={l['credit']:.2f}, Narration={l['narration']}")
                break
        if not found_in_gl:
            print("[FAIL] Validation 7: Payment voucher entry missing from General Ledger.")
            return
        print("[PASS] Validation 7: General Ledger correctly displays the payment entry.")
        
        print("="*60)
        print("STAGE 3 COMPLETED SUCCESSFULLY!")
        print("="*60)

    except Exception as e:
        print(f"[ERROR] Error during verification: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_verification()
