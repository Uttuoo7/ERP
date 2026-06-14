import sys
import os
import json
from decimal import Decimal

# Add root folder to sys.path so we can import backend packages
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend import models, database

def run_analysis():
    db = database.SessionLocal()
    
    # 1. Fetch Inventory Control Account (1200)
    acc = db.query(models.Account).filter_by(code='1200').first()
    if not acc:
        print("ERROR: Inventory Control Account 1200 not found in database.")
        db.close()
        sys.exit(1)
        
    print("=" * 80)
    print("HISTORICAL GRN DISCOVERY & BACKFILL ANALYSIS")
    print("=" * 80)
    print(f"{'GRN Number':<18} | {'Receipt Date':<19} | {'Item SKU':<18} | {'Quantity':<10} | {'Unit Cost':<10} | {'Total Value':<12} | {'Cost Layer?':<11}")
    print("-" * 105)

    grns = db.query(models.GoodsReceiptNote).filter(
        models.GoodsReceiptNote.status == "APPROVED",
        models.GoodsReceiptNote.is_deleted == False
    ).order_by(models.GoodsReceiptNote.receipt_date.asc()).all()

    analysis_results = []

    for grn in grns:
        # Find JournalEntry for this GRN
        je = db.query(models.JournalEntry).filter(
            models.JournalEntry.reference_type == "GRN",
            models.JournalEntry.reference_id == grn.id,
            models.JournalEntry.is_deleted == False
        ).first()

        gl_value = Decimal("0.0")
        if je:
            lines = db.query(models.JournalLine).filter(
                models.JournalLine.journal_entry_id == je.id,
                models.JournalLine.account_id == acc.id,
                models.JournalLine.debit_amount > 0,
                models.JournalLine.is_deleted == False
            ).all()
            gl_value = sum(l.debit_amount for l in lines)

        # Query existing cost layers
        layer_exists = db.query(models.InventoryCostLayer).filter_by(
            source_grn_id=grn.id,
            is_deleted=False
        ).count() > 0

        # Query lines
        grn_lines = db.query(models.GRNLineItem).filter_by(
            grn_id=grn.id,
            is_deleted=False
        ).all()

        if gl_value > 0 or len(grn_lines) > 0:
            if len(grn_lines) > 0:
                for line in grn_lines:
                    item = db.query(models.Item).filter_by(id=line.item_id).first()
                    sku = item.sku if item else "UNKNOWN"
                    qty = float(line.accepted_qty)
                    unit_cost = float(line.unit_price)
                    total = qty * unit_cost
                    
                    analysis_results.append({
                        "grn_number": grn.grn_number,
                        "receipt_date": str(grn.receipt_date),
                        "item_sku": sku,
                        "quantity": qty,
                        "unit_cost": unit_cost,
                        "total_value": total,
                        "existing_layer": "Yes" if layer_exists else "No"
                    })
                    print(f"{grn.grn_number:<18} | {str(grn.receipt_date)[:19]:<19} | {sku:<18} | {qty:<10.2f} | {unit_cost:<10.2f} | {total:<12.2f} | {'Yes' if layer_exists else 'No':<11}")
            else:
                # Fallback for when there are no lines in the database but GL posted
                # Use default historical item
                sku = "HISTORICAL-ITEM"
                unit_cost = 10.00
                qty = float(gl_value) / unit_cost
                total = float(gl_value)
                
                analysis_results.append({
                    "grn_number": grn.grn_number,
                    "receipt_date": str(grn.receipt_date),
                    "item_sku": sku,
                    "quantity": qty,
                    "unit_cost": unit_cost,
                    "total_value": total,
                    "existing_layer": "Yes" if layer_exists else "No"
                })
                print(f"{grn.grn_number:<18} | {str(grn.receipt_date)[:19]:<19} | {sku:<18} | {qty:<10.2f} | {unit_cost:<10.2f} | {total:<12.2f} | {'Yes' if layer_exists else 'No':<11}")

    print("=" * 80)
    db.close()

if __name__ == "__main__":
    run_analysis()
