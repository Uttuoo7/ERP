import sys
import os
import json
from decimal import Decimal

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
import backend.models as models

def inspect():
    db = SessionLocal()
    try:
        print("=== ACCOUNTS PAYABLE JOURNAL ENTRIES (Account 2000) ===")
        ap_acc = db.query(models.Account).filter(models.Account.code == "2000").first()
        if ap_acc:
            ap_lines = db.query(models.JournalLine).join(models.JournalEntry).filter(
                models.JournalLine.account_id == ap_acc.id,
                models.JournalEntry.status != "DRAFT",
                models.JournalLine.is_deleted == False
            ).order_by(models.JournalEntry.entry_date).all()
            for line in ap_lines:
                print(f"JV: {line.journal_entry.entry_number} | Date: {line.journal_entry.entry_date} | RefType: {line.journal_entry.reference_type} | RefId: {line.journal_entry.reference_id} | Dr: {line.debit_amount} | Cr: {line.credit_amount} | Narration: {line.narration}")
        
        print("\n=== VENDOR LIABILITIES SUBLEDGER ===")
        liabs = db.query(models.VendorLiability).all()
        for l in liabs:
            print(f"Vendor: {l.vendor.name} | InvNum: {l.invoice.invoice_number} | Status: {l.status} | Original: {l.original_amount} | Outstanding: {l.outstanding_amount} | Created: {l.created_at}")

        print("\n=== GOODS RECEIPT NOTES (GRNs) ===")
        grns = db.query(models.GoodsReceiptNote).all()
        for g in grns:
            # Check if has invoice
            inv = db.query(models.Invoice).filter(models.Invoice.grn_id == g.id).first()
            inv_num = inv.invoice_number if inv else "NONE"
            je = db.query(models.JournalEntry).filter(
                models.JournalEntry.reference_type == "GRN",
                models.JournalEntry.reference_id == g.id
            ).first()
            je_num = je.entry_number if je else "NONE"
            print(f"GRN: {g.grn_number} | Status: {g.status} | Subtotal: {g.subtotal} | Invoice: {inv_num} | Journal: {je_num} | Date: {g.receipt_date}")

    finally:
        db.close()

if __name__ == "__main__":
    inspect()
