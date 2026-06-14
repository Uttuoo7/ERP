import sqlite3
import os
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), "erp_v8.db")

def migrate():
    print("Connecting to database:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_keys=OFF")

    # 1. Create inventory_issues table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_issues (
        id VARCHAR(36) PRIMARY KEY,
        issue_number VARCHAR(50) UNIQUE NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        department_id VARCHAR(36),
        issue_date DATETIME NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        issue_type VARCHAR(50) NOT NULL DEFAULT 'ISSUE',
        remarks VARCHAR(500),
        approved_by VARCHAR(36),
        approved_at DATETIME,
        tenant_id VARCHAR(36),
        created_at DATETIME NOT NULL,
        FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY(department_id) REFERENCES departments(id),
        FOREIGN KEY(approved_by) REFERENCES users(id)
    );
    """)
    print("Created inventory_issues table")

    # 2. Create inventory_issue_lines table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_issue_lines (
        id VARCHAR(36) PRIMARY KEY,
        issue_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        quantity DECIMAL(18, 4) NOT NULL,
        unit_cost DECIMAL(18, 4) NOT NULL DEFAULT 0,
        total_cost DECIMAL(18, 4) NOT NULL DEFAULT 0,
        costing_method_used VARCHAR(20) NOT NULL,
        issue_cost_basis VARCHAR(20) NOT NULL,
        cost_layer_reference VARCHAR(200),
        tenant_id VARCHAR(36),
        FOREIGN KEY(issue_id) REFERENCES inventory_issues(id),
        FOREIGN KEY(item_id) REFERENCES items(id)
    );
    """)
    print("Created inventory_issue_lines table")

    # 3. Seed accounts if missing
    accounts_to_seed = [
        {"code": "1250", "name": "Inventory In Transit", "account_type": "ASSET"},
        {"code": "5000", "name": "Cost Of Goods Sold", "account_type": "EXPENSE"},
        {"code": "5100", "name": "Inventory Loss / Scrap Expense", "account_type": "EXPENSE"}
    ]

    for acc in accounts_to_seed:
        cursor.execute("SELECT id FROM accounts WHERE code = ? AND is_deleted = 0", (acc["code"],))
        row = cursor.fetchone()
        if not row:
            acc_id = str(uuid.uuid4())
            cursor.execute("""
            INSERT INTO accounts (id, code, name, account_type, is_active, is_deleted)
            VALUES (?, ?, ?, ?, 1, 0)
            """, (acc_id, acc["code"], acc["name"], acc["account_type"]))
            print(f"Seeded account {acc['code']} - {acc['name']}")
        else:
            cursor.execute("UPDATE accounts SET is_active = 1 WHERE code = ?", (acc["code"],))

    conn.commit()

    # Resolve account ids
    account_ids = {}
    for code in ["1200", "1250", "5000", "5100"]:
        cursor.execute("SELECT id FROM accounts WHERE code = ? AND is_deleted = 0", (code,))
        row = cursor.fetchone()
        if row:
            account_ids[code] = row[0]

    # 4. Seed posting configurations
    configs_to_seed = [
        {"event_key": "INVENTORY_CONTROL", "code": "1200"},
        {"event_key": "INVENTORY_IN_TRANSIT", "code": "1250"},
        {"event_key": "COGS_CONTROL", "code": "5000"},
        {"event_key": "SCRAP_EXPENSE", "code": "5100"}
    ]

    for cfg in configs_to_seed:
        cursor.execute("SELECT id FROM posting_configurations WHERE event_key = ? AND is_deleted = 0", (cfg["event_key"],))
        row = cursor.fetchone()
        acc_id = account_ids.get(cfg["code"])
        if not acc_id:
            print(f"Warning: Account code {cfg['code']} for posting config {cfg['event_key']} not found.")
            continue

        if not row:
            cfg_id = str(uuid.uuid4())
            cursor.execute("""
            INSERT INTO posting_configurations (id, event_key, account_id, is_deleted)
            VALUES (?, ?, ?, 0)
            """, (cfg_id, cfg["event_key"], acc_id))
            print(f"Seeded posting configuration {cfg['event_key']} -> account {cfg['code']}")
        else:
            cursor.execute("""
            UPDATE posting_configurations SET account_id = ? WHERE event_key = ?
            """, (acc_id, cfg["event_key"]))
            print(f"Updated posting configuration {cfg['event_key']} -> account {cfg['code']}")

    conn.commit()
    conn.close()
    print("Phase 12C migrations applied successfully.")

if __name__ == "__main__":
    migrate()
