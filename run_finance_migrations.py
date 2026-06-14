import sqlite3
import os
import uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "erp_v8.db")

def migrate():
    print("Connecting to database:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Create fiscal_years table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fiscal_years (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        is_deleted BOOLEAN DEFAULT 0,
        tenant_id VARCHAR(36)
    );
    """)
    print("Created fiscal_years table if not exists")
    
    # 2. Create journal_sequences table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS journal_sequences (
        id VARCHAR(36) PRIMARY KEY,
        fiscal_year_id VARCHAR(36) NOT NULL UNIQUE,
        current_number INTEGER DEFAULT 0,
        is_deleted BOOLEAN DEFAULT 0,
        tenant_id VARCHAR(36),
        FOREIGN KEY(fiscal_year_id) REFERENCES fiscal_years(id)
    );
    """)
    print("Created journal_sequences table if not exists")
    
    # 3. Add parent_account_id to accounts
    cursor.execute("PRAGMA table_info(accounts)")
    cols = {row[1] for row in cursor.fetchall()}
    if "parent_account_id" not in cols:
        cursor.execute("ALTER TABLE accounts ADD COLUMN parent_account_id VARCHAR(36)")
        print("Added parent_account_id column to accounts table")
        
    # 4. Add fiscal_year_id to accounting_periods
    cursor.execute("PRAGMA table_info(accounting_periods)")
    cols = {row[1] for row in cursor.fetchall()}
    if "fiscal_year_id" not in cols:
        cursor.execute("ALTER TABLE accounting_periods ADD COLUMN fiscal_year_id VARCHAR(36)")
        print("Added fiscal_year_id column to accounting_periods table")

    # 5. Add reversal_of_journal_entry_id to journal_entries
    cursor.execute("PRAGMA table_info(journal_entries)")
    cols_je = [row[1] for row in cursor.fetchall()]
    if "reversal_of_journal_entry_id" not in cols_je:
        cursor.execute("ALTER TABLE journal_entries ADD COLUMN reversal_of_journal_entry_id VARCHAR(36)")
        print("Added reversal_of_journal_entry_id column to journal_entries table")
        # Copy values from reversed_entry_id if exists
        if "reversed_entry_id" in cols_je:
            cursor.execute("UPDATE journal_entries SET reversal_of_journal_entry_id = reversed_entry_id")
            print("Copied reversed_entry_id values to reversal_of_journal_entry_id")
            
    # 5b. Add tds_deducted to invoices if missing
    cursor.execute("PRAGMA table_info(invoices)")
    cols_inv = {row[1] for row in cursor.fetchall()}
    if "tds_deducted" not in cols_inv:
        cursor.execute("ALTER TABLE invoices ADD COLUMN tds_deducted DECIMAL DEFAULT 0")
        print("Added tds_deducted column to invoices table")
            
    # 6. Seed default FY 2026
    cursor.execute("SELECT id FROM fiscal_years WHERE name = 'FY 2026'")
    fy_row = cursor.fetchone()
    
    if not fy_row:
        fy_id = uuid.uuid4().hex
        cursor.execute("""
        INSERT INTO fiscal_years (id, name, start_date, end_date, status, is_deleted)
        VALUES (?, 'FY 2026', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'OPEN', 0)
        """, (fy_id,))
        print("Seeded 'FY 2026' Fiscal Year")
    else:
        fy_id = fy_row[0].replace("-", "")
        cursor.execute("UPDATE fiscal_years SET id = ? WHERE id = ?;", (fy_id, fy_row[0]))
        cursor.execute("UPDATE accounting_periods SET fiscal_year_id = ? WHERE fiscal_year_id = ?;", (fy_id, fy_row[0]))
        
    # Link all 2026 periods to the seeded FY 2026
    cursor.execute("""
    UPDATE accounting_periods
    SET fiscal_year_id = ?
    WHERE period_name LIKE '2026-%' AND fiscal_year_id IS NULL
    """, (fy_id,))
    print("Linked 2026 periods to FY 2026")
    
    conn.commit()
    conn.close()
    print("Migrations run successfully.")

if __name__ == "__main__":
    migrate()
