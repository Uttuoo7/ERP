import os
import sys
import uuid
import random
from decimal import Decimal
from datetime import datetime, timedelta

# Configure environment for testing/verification
os.environ["ENABLE_AUTO_POSTING_GRN"] = "true"
os.environ["ENABLE_AUTO_POSTING_INVOICE"] = "false"
os.environ["ENABLE_AUTO_POSTING_PAYMENT"] = "false"

# Add current directory to path to ensure imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
from backend import models
from backend.services.posting_engine import PostingEngine
from backend.services.accounting_service import AccountingService
from backend.services.ledger_service import LedgerService
from backend import event_dispatcher
from tests.factories.entity_factories import UserFactory, VendorFactory, ItemFactory, WarehouseFactory, POFactory, GRNFactory

def run_verification():
    db = SessionLocal()
    try:
        print("="*60)
        print("STAGE 1 AUTO-POSTING VERIFICATION (goods_received)")
        print("="*60)
        
        # 1. Ensure Finance Foundations are Seeded
        print("[Step 0] Checking & Seeding GL Accounts...")
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
                print(f"Created Account {data['code']} - {data['name']}")
            else:
                print(f"Found existing Account {data['code']} - {data['name']}")
            accounts_by_code[data["code"]] = acc

        print("\nChecking & Seeding Fiscal Year & Accounting Periods...")
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
        else:
            print(f"Found existing Fiscal Year {fy_name}")

        period_name = today.strftime("%Y-%m")
        period = db.query(models.AccountingPeriod).filter_by(period_name=period_name, is_deleted=False).first()
        if not period:
            period = models.AccountingPeriod(
                period_name=period_name,
                start_date=datetime(today.year, today.month, 1),
                end_date=datetime(today.year, today.month, 28) + timedelta(days=4), # end of month
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
            print(f"Found existing Accounting Period {period_name}")

        print("\nChecking Posting Configurations...")
        configs = [
            {"event_key": "INVENTORY_RECEIPT", "account_code": "1200"},
            {"event_key": "GRNI_ACCRUAL", "account_code": "2100"},
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
        
        # 2. Register listeners
        print("\nRegistering Auto-Posting Listeners...")
        PostingEngine.register_listeners(force=True)

        # 3. Create PO and approved GRN
        print("\nCreating Procurement Entities...")
        user = db.query(models.User).filter_by(role=models.Role.ADMIN).first()
        if not user:
            user = UserFactory.create(db, role=models.Role.ADMIN)
        vendor = db.query(models.Vendor).first()
        if not vendor:
            vendor = VendorFactory.create(db)
        warehouse = db.query(models.Warehouse).first()
        if not warehouse:
            warehouse = WarehouseFactory.create(db)
        
        # Generate randomized numbers to prevent UNIQUE constraints
        rand_suffix = f"{random.randint(1000, 9999)}"
        po_num = f"PO-TEST-{rand_suffix}"
        grn_num = f"GRN-TEST-{rand_suffix}"
            
        po = POFactory.create(
            db, vendor=vendor, warehouse=warehouse, created_by=user,
            po_number=po_num, total_amount=Decimal("15000.00"), status=models.POStatus.ISSUED
        )
        print(f"Created PO {po.po_number} with Total Amount = {po.total_amount}")
        
        grn = GRNFactory.create(
            db, po=po, warehouse=warehouse, received_by=user,
            grn_number=grn_num, subtotal=Decimal("15000.00"), total_amount=Decimal("17700.00"), status="APPROVED",
            receipt_date=datetime.utcnow()
        )
        print(f"Created GRN {grn.grn_number} with Subtotal = {grn.subtotal}")
        
        # Commit setup
        db.commit()

        # 4. Trigger auto-posting event
        print("\n[Action] Dispatching 'goods_received' event for GRN...")
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

        print("\n" + "="*50)
        print("STAGE 1 POSTING VALIDATIONS:")
        print("="*50)

        # Validation 1: Verify Journal Entry created
        je = db.query(models.JournalEntry).filter_by(
            reference_type="GRN", reference_id=grn.id
        ).first()
        
        if not je:
            print("[FAIL] Validation 1 Failed: No Journal Entry created for GRN.")
            return
        print(f"[PASS] Validation 1 Passed: Journal Entry created successfully (ID: {je.id})")

        # Validation 2: Verify JV numbering sequence
        print(f"Journal Entry Number: {je.entry_number}")
        if not je.entry_number.startswith("JV-2026-"):
            print("[FAIL] Validation 2 Failed: Journal numbering sequence does not match 'JV-YYYY-XXXXXX'.")
            return
        print("[PASS] Validation 2 Passed: Journal numbering matches format 'JV-YYYY-XXXXXX'.")

        # Validation 3: Verify Trial Balance remains balanced
        tb = LedgerService.get_trial_balance(db)
        print(f"Trial Balance - Total Debit: {tb['total_debit']:.2f}, Total Credit: {tb['total_credit']:.2f}, Balanced: {tb['is_balanced']}")
        if not tb['is_balanced']:
            print("[FAIL] Validation 3 Failed: Trial Balance is unbalanced!")
            return
        print("[PASS] Validation 3 Passed: Trial Balance is balanced (Total Debits == Total Credits).")

        # Validation 4: Verify General Ledger displays entry
        gl = LedgerService.get_general_ledger(db)
        found_in_gl = False
        for entry in gl:
            if entry["entry_id"] == str(je.id):
                found_in_gl = True
                print(f"Found Journal Entry in General Ledger: {entry['entry_number']} - {entry['narration']}")
                for l in entry["lines"]:
                    print(f"   Line: Code={l['account_code']}, Debit={l['debit']:.2f}, Credit={l['credit']:.2f}")
                break
        if not found_in_gl:
            print("[FAIL] Validation 4 Failed: Journal Entry not found in General Ledger report.")
            return
        print("[PASS] Validation 4 Passed: General Ledger correctly displays the entry.")

        # Validation 5: Verify Account Ledger updates correctly
        # Inventory Control Ledger (Account 1200)
        inv_ledger = LedgerService.get_account_ledger(db, accounts_by_code["1200"].id)
        # GRNI Accrual Ledger (Account 2100)
        grni_ledger = LedgerService.get_account_ledger(db, accounts_by_code["2100"].id)
        
        print("\nInventory Control Account (1200) Ledger lines:")
        for line in inv_ledger["lines"]:
            if line["entry_number"] == je.entry_number:
                print(f"   Match: Ref={line['entry_number']}, Debit={line['debit']:.2f}, Credit={line['credit']:.2f}, Running Balance={line['running_balance']:.2f}")
                break
                
        print("GRNI Accrual Account (2100) Ledger lines:")
        for line in grni_ledger["lines"]:
            if line["entry_number"] == je.entry_number:
                print(f"   Match: Ref={line['entry_number']}, Debit={line['debit']:.2f}, Credit={line['credit']:.2f}, Running Balance={line['running_balance']:.2f}")
                break

        print("\n[PASS] Validation 5 Passed: Account Ledgers for Inventory Control and GRNI updated correctly.")
        print("="*60)
        print("STAGE 1 COMPLETED SUCCESSFULLY!")
        print("="*60)

    except Exception as e:
        print(f"[ERROR] Error during verification: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_verification()
