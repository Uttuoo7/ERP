import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "erp_v8.db")

def migrate():
    print("Connecting to database:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Add columns to tenant_configs
    cursor.execute("PRAGMA table_info(tenant_configs)")
    cols = {row[1] for row in cursor.fetchall()}
    if "inventory_costing_method" not in cols:
        cursor.execute("ALTER TABLE tenant_configs ADD COLUMN inventory_costing_method VARCHAR(20) DEFAULT 'FIFO'")
        print("Added inventory_costing_method column to tenant_configs")
    if "allow_negative_inventory" not in cols:
        cursor.execute("ALTER TABLE tenant_configs ADD COLUMN allow_negative_inventory BOOLEAN DEFAULT 0")
        print("Added allow_negative_inventory column to tenant_configs")

    # 2. Create inventory_cost_layers table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_cost_layers (
        id VARCHAR(36) PRIMARY KEY,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36),
        original_quantity DECIMAL(18, 4) NOT NULL,
        remaining_quantity DECIMAL(18, 4) NOT NULL,
        unit_cost DECIMAL(18, 4) NOT NULL,
        total_cost DECIMAL(18, 4) NOT NULL,
        source_grn_id VARCHAR(36),
        source_po_id VARCHAR(36),
        layer_status VARCHAR(20) DEFAULT 'OPEN',
        consumed_at DATETIME,
        last_issue_reference VARCHAR(100),
        created_at DATETIME NOT NULL,
        tenant_id VARCHAR(36),
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY(item_id) REFERENCES items(id),
        FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY(source_grn_id) REFERENCES goods_receipt_notes(id),
        FOREIGN KEY(source_po_id) REFERENCES purchase_orders(id)
    );
    """)
    print("Created inventory_cost_layers table")

    # 3. Create inventory_valuation_entries table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_valuation_entries (
        id VARCHAR(36) PRIMARY KEY,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36),
        transaction_type VARCHAR(50) NOT NULL,
        quantity DECIMAL(18, 4) NOT NULL,
        unit_cost DECIMAL(18, 4) NOT NULL,
        total_value DECIMAL(18, 4) NOT NULL,
        running_inventory_qty DECIMAL(18, 4) NOT NULL,
        running_inventory_value DECIMAL(18, 4) NOT NULL,
        costing_method_used VARCHAR(20) NOT NULL,
        reference_type VARCHAR(50) NOT NULL,
        reference_id VARCHAR(36),
        created_at DATETIME NOT NULL,
        tenant_id VARCHAR(36),
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY(item_id) REFERENCES items(id),
        FOREIGN KEY(warehouse_id) REFERENCES warehouses(id)
    );
    """)
    print("Created inventory_valuation_entries table")

    # 4. Create inventory_revaluations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_revaluations (
        id VARCHAR(36) PRIMARY KEY,
        item_id VARCHAR(36) NOT NULL,
        old_cost DECIMAL(18, 4) NOT NULL,
        new_cost DECIMAL(18, 4) NOT NULL,
        quantity_affected DECIMAL(18, 4) NOT NULL,
        value_difference DECIMAL(18, 4) NOT NULL,
        reason VARCHAR(500) NOT NULL,
        status VARCHAR(20) DEFAULT 'DRAFT',
        approved_by VARCHAR(36),
        approved_at DATETIME,
        created_at DATETIME NOT NULL,
        tenant_id VARCHAR(36),
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY(item_id) REFERENCES items(id),
        FOREIGN KEY(approved_by) REFERENCES users(id)
    );
    """)
    print("Created inventory_revaluations table")

    # 5. Create inventory_periods table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_periods (
        id VARCHAR(36) PRIMARY KEY,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'OPEN',
        created_at DATETIME NOT NULL,
        tenant_id VARCHAR(36),
        is_deleted BOOLEAN DEFAULT 0
    );
    """)
    print("Created inventory_periods table")

    # 6. Create inventory_audit_logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36),
        action_type VARCHAR(50) NOT NULL,
        before_quantity DECIMAL(18, 4) NOT NULL,
        after_quantity DECIMAL(18, 4) NOT NULL,
        before_value DECIMAL(18, 4) NOT NULL,
        after_value DECIMAL(18, 4) NOT NULL,
        reference_type VARCHAR(50) NOT NULL,
        reference_id VARCHAR(36),
        performed_by VARCHAR(36),
        created_at DATETIME NOT NULL,
        tenant_id VARCHAR(36),
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY(item_id) REFERENCES items(id),
        FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY(performed_by) REFERENCES users(id)
    );
    """)
    print("Created inventory_audit_logs table")

    # 7. Create inventory_snapshots table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_snapshots (
        id VARCHAR(36) PRIMARY KEY,
        snapshot_date DATETIME NOT NULL,
        warehouse_id VARCHAR(36),
        inventory_value DECIMAL(18, 4) NOT NULL,
        inventory_quantity DECIMAL(18, 4) NOT NULL,
        item_count INTEGER NOT NULL,
        created_at DATETIME NOT NULL,
        tenant_id VARCHAR(36),
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY(warehouse_id) REFERENCES warehouses(id)
    );
    """)
    print("Created inventory_snapshots table")

    # 8. Create inventory_adjustments table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_adjustments (
        id VARCHAR(36) PRIMARY KEY,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36),
        qty_change DECIMAL(18, 4) NOT NULL,
        unit_cost DECIMAL(18, 4) NOT NULL,
        status VARCHAR(20) DEFAULT 'DRAFT',
        approved_by VARCHAR(36),
        approved_at DATETIME,
        remarks VARCHAR(500),
        created_at DATETIME NOT NULL,
        tenant_id VARCHAR(36),
        is_deleted BOOLEAN DEFAULT 0,
        FOREIGN KEY(item_id) REFERENCES items(id),
        FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY(approved_by) REFERENCES users(id)
    );
    """)
    print("Created inventory_adjustments table")

    conn.commit()
    conn.close()
    print("Inventory migrations completed successfully.")

if __name__ == "__main__":
    migrate()
