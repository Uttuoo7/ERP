import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
import backend.models as models

db = SessionLocal()
try:
    ap_acc = db.query(models.Account).filter(models.Account.code == "2000").first()
    lines = db.query(models.JournalLine).join(models.JournalEntry).filter(
        models.JournalLine.account_id == ap_acc.id,
        models.JournalEntry.status != "DRAFT",
        models.JournalLine.is_deleted == False
    ).order_by(models.JournalEntry.entry_date, models.JournalLine.id).all()
    
    bal = 0.0
    for l in lines:
        if l.debit_amount > 0:
            bal -= float(l.debit_amount)
        if l.credit_amount > 0:
            bal += float(l.credit_amount)
        print(f"JV: {l.journal_entry.entry_number} | Dr: {l.debit_amount} | Cr: {l.credit_amount} | RunBal: {bal} | Narration: {l.narration}")
finally:
    db.close()
