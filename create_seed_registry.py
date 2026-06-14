import sys
import os
import json
import uuid

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import SessionLocal
import backend.models as models

def classify_records():
    db = SessionLocal()
    registry = {
        "factory_seed": {
            "journal_entries": [],
            "grns": [],
            "invoices": [],
            "payments": [],
            "vendor_liabilities": []
        },
        "test": {
            "journal_entries": [],
            "grns": [],
            "invoices": [],
            "payments": [],
            "vendor_liabilities": []
        },
        "audit": {
            "journal_entries": [],
            "grns": [],
            "invoices": [],
            "payments": [],
            "vendor_liabilities": []
        },
        "production": {
            "journal_entries": [],
            "grns": [],
            "invoices": [],
            "payments": [],
            "vendor_liabilities": []
        }
    }
    
    try:
        # Load all documents first to make categorization dictionary mapping
        inv_cat = {}
        grn_cat = {}
        pmt_cat = {}
        vl_cat = {}
        
        # 1. Classify Invoices
        invs = db.query(models.Invoice).all()
        for i in invs:
            num = i.invoice_number or ""
            cat = "production"
            if "FACT" in num:
                cat = "factory_seed"
            elif "TEST" in num or "STG" in num:
                cat = "test"
            elif "AUD" in num:
                cat = "audit"
            inv_cat[i.id] = cat
            registry[cat]["invoices"].append(str(i.id))
            
        # 2. Classify GRNs
        grns = db.query(models.GoodsReceiptNote).all()
        for g in grns:
            num = g.grn_number or ""
            cat = "production"
            if "FACT" in num:
                cat = "factory_seed"
            elif "TEST" in num or "STG" in num:
                cat = "test"
            elif "AUD" in num:
                cat = "audit"
            grn_cat[g.id] = cat
            registry[cat]["grns"].append(str(g.id))
            
        # 3. Classify Payments (Financial Transactions)
        pmts = db.query(models.FinancialTransaction).all()
        for p in pmts:
            num = p.transaction_number or ""
            cat = "production"
            # Trace allocations
            if p.reference_type == "INVOICE" and p.reference_id in inv_cat:
                cat = inv_cat[p.reference_id]
            else:
                # check allocation records if any
                alloc = db.query(models.PaymentAllocation).filter(models.PaymentAllocation.financial_transaction_id == p.id).first()
                if alloc and alloc.vendor_liability and alloc.vendor_liability.invoice_id in inv_cat:
                    cat = inv_cat[alloc.vendor_liability.invoice_id]
                elif "FACT" in num:
                    cat = "factory_seed"
                elif "TEST" in num or "STG" in num:
                    cat = "test"
                elif "AUD" in num:
                    cat = "audit"
            pmt_cat[p.id] = cat
            registry[cat]["payments"].append(str(p.id))
            
        # 4. Classify Vendor Liabilities
        vls = db.query(models.VendorLiability).all()
        for vl in vls:
            cat = "production"
            if vl.invoice_id in inv_cat:
                cat = inv_cat[vl.invoice_id]
            vl_cat[vl.id] = cat
            registry[cat]["vendor_liabilities"].append(str(vl.id))
            
        # 5. Classify Journal Entries using trace
        jes = db.query(models.JournalEntry).all()
        for je in jes:
            num = je.entry_number or ""
            narr = je.narration or ""
            cat = "production"
            
            # Trace reference relations
            if je.reference_type == "INVOICE" and je.reference_id in inv_cat:
                cat = inv_cat[je.reference_id]
            elif je.reference_type == "GRN" and je.reference_id in grn_cat:
                cat = grn_cat[je.reference_id]
            elif je.reference_type == "PAYMENT" and je.reference_id in pmt_cat:
                cat = pmt_cat[je.reference_id]
            else:
                # Fallback to string check
                if "FACT" in num or "FACT" in narr:
                    cat = "factory_seed"
                elif "TEST" in num or "TEST" in narr or "STG" in num or "STG" in narr:
                    cat = "test"
                elif "AUD" in num or "AUD" in narr:
                    cat = "audit"
            
            registry[cat]["journal_entries"].append(str(je.id))
            
        # Save registry
        with open("seed_data_registry.json", "w") as f:
            json.dump(registry, f, indent=2)
            
        print("[PASS] seed_data_registry.json generated successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    classify_records()
