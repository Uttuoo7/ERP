import sys
import os
from decimal import Decimal

# Add root folder to sys.path so we can import backend packages
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend import models, database

def run_certification():
    db = database.SessionLocal()
    
    # 1. Fetch Inventory Control Account (1200)
    acc = db.query(models.Account).filter_by(code='1200').first()
    if not acc:
        print("ERROR: Inventory Control Account 1200 not found in database.")
        db.close()
        sys.exit(1)

    # 2. Sum Inventory Subledger Value from cost layers
    layers = db.query(models.InventoryCostLayer).filter_by(is_deleted=False).all()
    subledger_value = sum(l.remaining_quantity * l.unit_cost for l in layers)
    total_qty = sum(l.remaining_quantity for l in layers)
    
    # 3. Calculate GL Account 1200 Balance
    lines = db.query(models.JournalLine).filter_by(account_id=acc.id, is_deleted=False).all()
    debits = sum(l.debit_amount for l in lines)
    credits = sum(l.credit_amount for l in lines)
    gl_balance = debits - credits
    
    # 4. Compute Variance
    variance = subledger_value - gl_balance
    
    status = "CERTIFIED" if variance == Decimal("0.00") else "FAILED"
    
    print("=" * 60)
    print("INVENTORY SUBLEDGER OPENING BALANCE CERTIFICATE")
    print("=" * 60)
    print(f"Total Cost Layers Found : {len(layers)}")
    print(f"Total Quantity On Hand  : {total_qty:.2f}")
    print(f"Inventory Subledger Val : INR {subledger_value:.2f}")
    print(f"GL Account 1200 Balance : INR {gl_balance:.2f}")
    print(f"Reconciliation Variance : INR {variance:.2f}")
    print(f"Reconciliation Status   : {status}")
    print("=" * 60)
    
    db.close()
    
    if status == "CERTIFIED":
        print("SUCCESS: Subledger reconciles perfectly with G/L Account 1200.")
        sys.exit(0)
    else:
        print("ERROR: Reconciliation failed. G/L variance still exists.")
        sys.exit(1)

if __name__ == "__main__":
    run_certification()
