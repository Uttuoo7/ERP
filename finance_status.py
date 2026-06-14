import os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from decimal import Decimal
from backend.database import SessionLocal
from backend import models
from backend.services.ledger_service import LedgerService

db = SessionLocal()

print("=" * 70)
print("FINANCE CORE STATUS DASHBOARD")
print("=" * 70)

# 1. Trial Balance Status
print("\n--- 1. TRIAL BALANCE STATUS ---")
tb = LedgerService.get_trial_balance(db)
print(f"  Total Debits:  {tb['total_debit']:>15,.2f}")
print(f"  Total Credits: {tb['total_credit']:>15,.2f}")
diff = abs(tb['total_debit'] - tb['total_credit'])
print(f"  Difference:    {diff:>15,.2f}")
print(f"  Status:        {'✅ BALANCED' if diff == 0 else '❌ IMBALANCED'}")

# 2. AP vs Vendor Liabilities
print("\n--- 2. AP CONTROL vs VENDOR LIABILITIES ---")
ap_acc = db.query(models.Account).filter_by(code="2000").first()
if ap_acc:
    ap_ledger = LedgerService.get_account_ledger(db, ap_acc.id)
    # Get net balance from all lines
    ap_lines = ap_ledger.get("lines", [])
    if ap_lines:
        # Running balance of the last line is the current balance
        ap_gl_balance = ap_lines[-1]["running_balance"]
    else:
        ap_gl_balance = 0.0
    print(f"  AP GL Balance (Account 2000):     {ap_gl_balance:>12,.2f}")
else:
    print("  AP Account not found!")
    ap_gl_balance = 0

all_liabs = db.query(models.VendorLiability).all()
unpaid_liabs = [l for l in all_liabs if l.status == "UNPAID"]
partial_liabs = [l for l in all_liabs if l.status == "PARTIALLY_PAID"]
paid_liabs = [l for l in all_liabs if l.status == "PAID"]

total_outstanding = sum(l.outstanding_amount for l in all_liabs)
unpaid_total = sum(l.outstanding_amount for l in unpaid_liabs)
partial_total = sum(l.outstanding_amount for l in partial_liabs)

print(f"  Total Vendor Liabilities:         {len(all_liabs):>6} records")
print(f"    UNPAID:                         {len(unpaid_liabs):>6} (₹{unpaid_total:,.2f})")
print(f"    PARTIALLY_PAID:                 {len(partial_liabs):>6} (₹{partial_total:,.2f})")
print(f"    PAID:                           {len(paid_liabs):>6}")
print(f"  Total Outstanding Amount:         {float(total_outstanding):>12,.2f}")
print(f"  Difference (GL - Subledger):      {float(ap_gl_balance) - float(total_outstanding):>12,.2f}")

# 3. GRNI vs Uninvoiced GRNs
print("\n--- 3. GRNI CONTROL vs UNINVOICED GRNs ---")
grni_acc = db.query(models.Account).filter_by(code="2100").first()
if grni_acc:
    grni_ledger = LedgerService.get_account_ledger(db, grni_acc.id)
    grni_lines = grni_ledger.get("lines", [])
    if grni_lines:
        grni_gl_balance = grni_lines[-1]["running_balance"]
    else:
        grni_gl_balance = 0.0
    print(f"  GRNI GL Balance (Account 2100):   {grni_gl_balance:>12,.2f}")
else:
    print("  GRNI Account not found!")
    grni_gl_balance = 0

all_grns = db.query(models.GoodsReceiptNote).filter(
    models.GoodsReceiptNote.status.in_(["APPROVED", "COMPLETED"])
).all()
uninvoiced_grns = []
invoiced_grns = []
for g in all_grns:
    inv = db.query(models.Invoice).filter_by(grn_id=g.id).first()
    if not inv:
        uninvoiced_grns.append(g)
    else:
        invoiced_grns.append(g)

uninvoiced_value = sum(g.subtotal for g in uninvoiced_grns)
print(f"  Total GRNs (Approved/Completed):  {len(all_grns):>6}")
print(f"    Invoiced:                       {len(invoiced_grns):>6}")
print(f"    Uninvoiced:                     {len(uninvoiced_grns):>6}")
print(f"  Uninvoiced GRN Value (Subtotal):  {float(uninvoiced_value):>12,.2f}")
if uninvoiced_grns:
    print(f"  Uninvoiced GRN Numbers:")
    for g in uninvoiced_grns:
        print(f"    - {g.grn_number} (Subtotal: ₹{g.subtotal:,.2f})")

# 4. Open Fiscal Periods
print("\n--- 4. OPEN FISCAL PERIODS ---")
fiscal_years = db.query(models.FiscalYear).filter_by(is_deleted=False).order_by(models.FiscalYear.start_date.desc()).all()
for fy in fiscal_years:
    print(f"  Fiscal Year: {fy.name} | Status: {fy.status} | {fy.start_date.strftime('%Y-%m-%d')} to {fy.end_date.strftime('%Y-%m-%d')}")
    periods = db.query(models.AccountingPeriod).filter_by(
        fiscal_year_id=fy.id, is_deleted=False
    ).order_by(models.AccountingPeriod.start_date.asc()).all()
    for p in periods:
        marker = "→" if p.status == "OPEN" else " "
        print(f"    {marker} {p.period_name} | {p.status:>8} | {p.start_date.strftime('%Y-%m-%d')} to {p.end_date.strftime('%Y-%m-%d')}")

# 5. Last Posted JV
print("\n--- 5. LAST POSTED JOURNAL VOUCHER ---")
last_je = db.query(models.JournalEntry).order_by(models.JournalEntry.created_at.desc()).first()
if last_je:
    print(f"  Voucher Number:   {last_je.entry_number}")
    print(f"  Entry Date:       {last_je.entry_date.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Reference Type:   {last_je.reference_type}")
    print(f"  Source Module:    {last_je.source_module}")
    print(f"  Source Event:     {last_je.source_event}")
    print(f"  Status:           {last_je.status}")
    print(f"  Narration:        {last_je.narration or 'N/A'}")
    total_dr = sum(l.debit_amount for l in last_je.journal_lines)
    total_cr = sum(l.credit_amount for l in last_je.journal_lines)
    print(f"  Total Debit:      ₹{total_dr:,.2f}")
    print(f"  Total Credit:     ₹{total_cr:,.2f}")
    print(f"  Lines:")
    for l in last_je.journal_lines:
        side = f"Dr ₹{l.debit_amount:,.2f}" if l.debit_amount > 0 else f"Cr ₹{l.credit_amount:,.2f}"
        print(f"    {l.account.code} ({l.account.name}): {side}")
else:
    print("  No journal entries found.")

# JV number sequence check
print("\n  --- JV Sequence Summary ---")
all_jes = db.query(models.JournalEntry).order_by(models.JournalEntry.entry_number.asc()).all()
print(f"  Total JVs:        {len(all_jes)}")
if all_jes:
    print(f"  First:            {all_jes[0].entry_number}")
    print(f"  Last:             {all_jes[-1].entry_number}")
    # Check sequence from JournalSequence table
    js = db.query(models.JournalSequence).all()
    for s in js:
        fy = db.query(models.FiscalYear).filter_by(id=s.fiscal_year_id).first()
        print(f"  Sequence Counter: {s.current_number} (FY: {fy.name if fy else 'Unknown'})")

# 6. Unposted Transactions
print("\n--- 6. UNPOSTED TRANSACTIONS ---")

# Check GRNs without journal entries
grns_all = db.query(models.GoodsReceiptNote).filter(
    models.GoodsReceiptNote.status.in_(["APPROVED", "COMPLETED"])
).all()
unposted_grns = []
for g in grns_all:
    je = db.query(models.JournalEntry).filter_by(reference_type="GRN", reference_id=g.id).first()
    if not je:
        unposted_grns.append(g)

print(f"  Unposted GRNs (Approved but no JE):    {len(unposted_grns)}")
for g in unposted_grns:
    print(f"    - {g.grn_number} | Subtotal: ₹{g.subtotal:,.2f}")

# Check Invoices without journal entries
invoices_approved = db.query(models.Invoice).filter(
    models.Invoice.status.in_([models.InvoiceStatus.APPROVED, models.InvoiceStatus.PENDING_MATCHING, models.InvoiceStatus.MATCHED])
).all()
unposted_invoices = []
for inv in invoices_approved:
    je = db.query(models.JournalEntry).filter_by(reference_type="INVOICE", reference_id=inv.id).first()
    if not je:
        unposted_invoices.append(inv)

print(f"  Unposted Invoices (Approved but no JE): {len(unposted_invoices)}")
for inv in unposted_invoices:
    print(f"    - {inv.invoice_number} | Amount: ₹{inv.total_amount:,.2f} | Status: {inv.status.value}")

# Check Payments without journal entries
from backend.models import FinancialTransaction
payments = db.query(FinancialTransaction).filter(
    FinancialTransaction.transaction_type == "PAYMENT"
).all()
unposted_payments = []
for p in payments:
    je = db.query(models.JournalEntry).filter_by(reference_type="PAYMENT", reference_id=p.id).first()
    if not je:
        unposted_payments.append(p)

print(f"  Unposted Payments (no JE):              {len(unposted_payments)}")
for p in unposted_payments:
    print(f"    - {p.transaction_number} | Amount: ₹{p.amount:,.2f}")

total_unposted = len(unposted_grns) + len(unposted_invoices) + len(unposted_payments)
print(f"\n  TOTAL UNPOSTED TRANSACTIONS:            {total_unposted}")
if total_unposted == 0:
    print(f"  Status: ✅ ALL TRANSACTIONS POSTED")
else:
    print(f"  Status: ⚠️  {total_unposted} TRANSACTION(S) REQUIRE ATTENTION")

print("\n" + "=" * 70)
print("END OF STATUS REPORT")
print("=" * 70)

db.close()
