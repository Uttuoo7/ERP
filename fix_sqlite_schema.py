"""
Comprehensive SQLite schema fix.
Reads the current models and adds any missing columns to all tables.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "erp_v8.db")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'alembic_%'")
tables = [row[0] for row in cursor.fetchall()]
print(f"Found {len(tables)} tables: {tables}\n")

# Common columns that multi-tenant models require
COMMON_COLUMNS = {
    "tenant_id": "TEXT",
    "is_deleted": "BOOLEAN DEFAULT 0",
    "created_at": "TIMESTAMP",
    "updated_at": "TIMESTAMP",
    "created_by_id": "TEXT",
    "updated_by_id": "TEXT",
}

# Table-specific columns that might be missing
TABLE_SPECIFIC = {
    "users": {
        "company_id": "TEXT",
        "branch_id": "TEXT",
        "vendor_id": "TEXT",
    },
    "warehouses": {
        "contact_person": "TEXT",
        "contact_number": "TEXT",
        "company_name": "TEXT",
        "address_line1": "TEXT",
        "address_line2": "TEXT",
        "landmark": "TEXT",
        "city": "TEXT",
        "state": "TEXT",
        "pin_code": "TEXT",
        "phone": "TEXT",
        "gstin": "TEXT",
    },
    "vendors": {
        "vendor_code": "TEXT",
        "company_name": "TEXT",
        "address_line1": "TEXT",
        "address_line2": "TEXT",
        "landmark": "TEXT",
        "city": "TEXT",
        "state": "TEXT",
        "pin_code": "TEXT",
        "gstin": "TEXT",
        "pan": "TEXT",
        "bank_name": "TEXT",
        "bank_account": "TEXT",
        "bank_ifsc": "TEXT",
        "bank_branch": "TEXT",
        "payment_terms": "TEXT",
        "credit_limit": "REAL DEFAULT 0",
        "credit_days": "INTEGER DEFAULT 30",
        "vendor_type": "TEXT",
        "category": "TEXT",
    },
    "purchase_orders": {
        "amendment_number": "INTEGER DEFAULT 0",
        "amendment_date": "TIMESTAMP",
        "amendment_reason": "TEXT",
        "original_po_id": "TEXT",
    },
    "items": {
        "hsn_code": "TEXT",
        "item_code": "TEXT",
        "barcode": "TEXT",
        "brand": "TEXT",
        "manufacturer": "TEXT",
        "shelf_life_days": "INTEGER",
        "weight": "REAL",
        "weight_unit": "TEXT",
        "dimensions": "TEXT",
        "min_order_qty": "REAL DEFAULT 1",
        "max_order_qty": "REAL",
        "lead_time_days": "INTEGER DEFAULT 7",
        "safety_stock": "REAL DEFAULT 0",
        "reorder_point": "REAL DEFAULT 0",
        "reorder_qty": "REAL DEFAULT 0",
    },
}

total_added = 0

for table in tables:
    cursor.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cursor.fetchall()}
    
    # Apply common columns
    for col, col_type in COMMON_COLUMNS.items():
        if col not in existing:
            try:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                print(f"  + {table}.{col} ({col_type})")
                total_added += 1
            except Exception as e:
                pass
    
    # Apply table-specific columns
    if table in TABLE_SPECIFIC:
        for col, col_type in TABLE_SPECIFIC[table].items():
            if col not in existing:
                try:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                    print(f"  + {table}.{col} ({col_type})")
                    total_added += 1
                except Exception as e:
                    pass

conn.commit()
print(f"\nDone! Added {total_added} missing columns across {len(tables)} tables.")
conn.close()
