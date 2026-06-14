import sqlite3
import os
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), "erp_v8.db")

def migrate():
    print("Connecting to database:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys=OFF") # Turn off temporarily to allow table recreation

    # 1. Add columns to tenant_configs
    cursor.execute("PRAGMA table_info(tenant_configs)")
    cols = {row[1] for row in cursor.fetchall()}
    
    new_config_cols = {
        "inventory_control_account_id": "VARCHAR(36)",
        "inventory_adjustment_gain_account_id": "VARCHAR(36)",
        "inventory_adjustment_loss_account_id": "VARCHAR(36)",
        "inventory_variance_account_id": "VARCHAR(36)"
    }
    
    for col_name, col_type in new_config_cols.items():
        if col_name not in cols:
            cursor.execute(f"ALTER TABLE tenant_configs ADD COLUMN {col_name} {col_type}")
            print(f"Added {col_name} column to tenant_configs")

    # Seed default accounts in tenant_configs
    # Find account IDs by their codes
    account_mapping = {}
    for code in ['1200', '4100', '5100', '5000']:
        cursor.execute("SELECT id FROM accounts WHERE code = ?", (code,))
        row = cursor.fetchone()
        if row:
            account_mapping[code] = row[0]
            
    control_acc_id = account_mapping.get('1200')
    gain_acc_id = account_mapping.get('4100') or account_mapping.get('5100')
    loss_acc_id = account_mapping.get('5100')
    variance_acc_id = account_mapping.get('5000')

    print(f"Resolved default accounts: Control={control_acc_id}, Gain={gain_acc_id}, Loss={loss_acc_id}, Variance={variance_acc_id}")

    cursor.execute("UPDATE tenant_configs SET inventory_control_account_id = ?, inventory_adjustment_gain_account_id = ?, inventory_adjustment_loss_account_id = ?, inventory_variance_account_id = ?",
                   (control_acc_id, gain_acc_id, loss_acc_id, variance_acc_id))
    print("Seeded default configurable accounts in tenant_configs table")

    # 2. Add columns to inventory_adjustments
    cursor.execute("PRAGMA table_info(inventory_adjustments)")
    cols = {row[1] for row in cursor.fetchall()}
    if "reason_code" not in cols:
        cursor.execute("ALTER TABLE inventory_adjustments ADD COLUMN reason_code VARCHAR(50)")
        print("Added reason_code column to inventory_adjustments")
    if "created_by_id" not in cols:
        cursor.execute("ALTER TABLE inventory_adjustments ADD COLUMN created_by_id VARCHAR(36)")
        print("Added created_by_id column to inventory_adjustments")

    # 3. Recreate inventory_transactions table to follow header-line pattern
    cursor.execute("PRAGMA table_info(inventory_transactions)")
    cols = {row[1] for row in cursor.fetchall()}
    if "transaction_number" not in cols:
        print("Recreating inventory_transactions table for header-line schema compatibility...")
        # Rename old table
        cursor.execute("ALTER TABLE inventory_transactions RENAME TO inventory_transactions_old")
        
        # Create new table
        cursor.execute("""
        CREATE TABLE inventory_transactions (
            id VARCHAR(36) PRIMARY KEY,
            transaction_number VARCHAR(50) UNIQUE,
            transaction_type VARCHAR(50) NOT NULL,
            reference_type VARCHAR(50),
            reference_id VARCHAR(36),
            remarks VARCHAR(255),
            created_at DATETIME NOT NULL,
            created_by_id VARCHAR(36),
            tenant_id VARCHAR(36),
            item_id VARCHAR(36),
            warehouse_id VARCHAR(36),
            batch_id VARCHAR(36),
            quantity INTEGER,
            valuation_unit_cost DECIMAL(15, 2),
            FOREIGN KEY(created_by_id) REFERENCES users(id)
        );
        """)
        
        # Copy data
        cursor.execute("""
        INSERT INTO inventory_transactions (
            id, transaction_type, reference_id, remarks, created_at, created_by_id,
            item_id, warehouse_id, batch_id, quantity, valuation_unit_cost
        )
        SELECT 
            id, transaction_type, reference_id, remarks, created_at, created_by_id,
            item_id, warehouse_id, batch_id, quantity, valuation_unit_cost
        FROM inventory_transactions_old
        """)
        
        # Update transaction numbers for legacy rows
        cursor.execute("SELECT id FROM inventory_transactions")
        rows = cursor.fetchall()
        for idx, r in enumerate(rows):
            legacy_num = f"TX-LEGACY-{idx+1:05d}"
            cursor.execute("UPDATE inventory_transactions SET transaction_number = ? WHERE id = ?", (legacy_num, r[0]))
            
        cursor.execute("DROP TABLE inventory_transactions_old")
        print("Successfully recreated inventory_transactions table.")

    # 4. Create inventory_transaction_lines table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_transaction_lines (
        id VARCHAR(36) PRIMARY KEY,
        transaction_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36),
        batch_id VARCHAR(36),
        quantity INTEGER NOT NULL,
        valuation_unit_cost DECIMAL(18, 4) NOT NULL,
        remarks VARCHAR(255),
        tenant_id VARCHAR(36),
        FOREIGN KEY(transaction_id) REFERENCES inventory_transactions(id),
        FOREIGN KEY(item_id) REFERENCES items(id),
        FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY(batch_id) REFERENCES inventory_batches(id)
    );
    """)
    print("Created inventory_transaction_lines table")

    # 5. Create inventory_transfers table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_transfers (
        id VARCHAR(36) PRIMARY KEY,
        transfer_number VARCHAR(50) UNIQUE NOT NULL,
        source_warehouse_id VARCHAR(36) NOT NULL,
        destination_warehouse_id VARCHAR(36) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        remarks VARCHAR(500),
        created_by_id VARCHAR(36) NOT NULL,
        created_at DATETIME NOT NULL,
        approved_by_id VARCHAR(36),
        approved_at DATETIME,
        tenant_id VARCHAR(36),
        FOREIGN KEY(source_warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY(destination_warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY(created_by_id) REFERENCES users(id),
        FOREIGN KEY(approved_by_id) REFERENCES users(id)
    );
    """)
    print("Created inventory_transfers table")

    # 6. Create inventory_transfer_lines table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_transfer_lines (
        id VARCHAR(36) PRIMARY KEY,
        transfer_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        qty_requested INTEGER NOT NULL,
        qty_transferred INTEGER NOT NULL DEFAULT 0,
        qty_received INTEGER NOT NULL DEFAULT 0,
        unit_cost DECIMAL(18, 4) NOT NULL DEFAULT 0,
        tenant_id VARCHAR(36),
        FOREIGN KEY(transfer_id) REFERENCES inventory_transfers(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
    );
    """)
    print("Created inventory_transfer_lines table")

    # 7. Create cycle_counts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cycle_counts (
        id VARCHAR(36) PRIMARY KEY,
        count_number VARCHAR(50) UNIQUE NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        count_date DATETIME NOT NULL,
        remarks VARCHAR(500),
        created_by_id VARCHAR(36) NOT NULL,
        created_at DATETIME NOT NULL,
        counted_by_id VARCHAR(36),
        verified_by_id VARCHAR(36),
        approved_by_id VARCHAR(36),
        approved_at DATETIME,
        tenant_id VARCHAR(36),
        FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY(created_by_id) REFERENCES users(id),
        FOREIGN KEY(counted_by_id) REFERENCES users(id),
        FOREIGN KEY(verified_by_id) REFERENCES users(id),
        FOREIGN KEY(approved_by_id) REFERENCES users(id)
    );
    """)
    print("Created cycle_counts table")

    # 8. Create cycle_count_lines table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cycle_count_lines (
        id VARCHAR(36) PRIMARY KEY,
        cycle_count_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        system_qty INTEGER NOT NULL,
        physical_qty INTEGER,
        variance_qty INTEGER,
        unit_cost DECIMAL(18, 4) NOT NULL DEFAULT 0,
        tenant_id VARCHAR(36),
        FOREIGN KEY(cycle_count_id) REFERENCES cycle_counts(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
    );
    """)
    print("Created cycle_count_lines table")

    conn.commit()
    conn.close()
    print("Database migrations applied successfully.")

if __name__ == "__main__":
    migrate()
