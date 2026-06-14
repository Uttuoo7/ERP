import sys
import os
import sqlite3

# Ensure root folder is in Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import engine, SQLALCHEMY_DATABASE_URL
from backend.models import Base

def run_migrations():
    print("=" * 60)
    print("RUNNING MANUFACTURING DATABASE MIGRATIONS & SCHEMA RESET")
    print("=" * 60)
    
    # 1. Reset tables if they are empty and need correct schema
    if "sqlite" in SQLALCHEMY_DATABASE_URL:
        db_file = SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "").replace("./", "")
        print(f"Connecting directly to SQLite database: {db_file}")
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        # Turn off foreign keys temporarily to allow dropping tables
        cursor.execute("PRAGMA foreign_keys=OFF")
        
        # Check if work_orders has data
        try:
            cursor.execute("SELECT COUNT(*) FROM work_orders")
            wo_count = cursor.fetchone()[0]
        except Exception:
            wo_count = 0
            
        try:
            cursor.execute("SELECT COUNT(*) FROM quality_inspections")
            qi_count = cursor.fetchone()[0]
        except Exception:
            qi_count = 0
            
        print(f"  Existing work_orders count: {wo_count}")
        print(f"  Existing quality_inspections count: {qi_count}")
        
        # Since they are empty, we drop them so they can be recreated with the new schema
        if wo_count == 0:
            cursor.execute("DROP TABLE IF EXISTS work_orders")
            print("  [DROP] Dropped empty work_orders table for schema recreation.")
        else:
            # If not empty, add columns back-compatibly
            cursor.execute("PRAGMA table_info(work_orders)")
            cols = {row[1] for row in cursor.fetchall()}
            if "priority" not in cols:
                cursor.execute("ALTER TABLE work_orders ADD COLUMN priority VARCHAR(20) DEFAULT 'MEDIUM'")
                print("  [ALTER] Added priority column to work_orders")
            if "customer_priority" not in cols:
                cursor.execute("ALTER TABLE work_orders ADD COLUMN customer_priority VARCHAR(20) DEFAULT 'MEDIUM'")
                print("  [ALTER] Added customer_priority column to work_orders")
            if "release_date" not in cols:
                cursor.execute("ALTER TABLE work_orders ADD COLUMN release_date DATETIME")
                print("  [ALTER] Added release_date column to work_orders")
            
        if qi_count == 0:
            cursor.execute("DROP TABLE IF EXISTS quality_inspections")
            print("  [DROP] Dropped empty quality_inspections table for schema recreation.")
            
        cursor.execute("PRAGMA foreign_keys=ON")
        conn.commit()
        conn.close()
        
    else:
        # For PostgreSQL: do nothing or conditional drops if empty
        from sqlalchemy import text
        print("Skipping direct drops for PostgreSQL; create_all will run.")

    # 2. Create tables using SQLAlchemy (will recreate work_orders & quality_inspections if dropped)
    try:
        Base.metadata.create_all(bind=engine)
        print("  [SUCCESS] Base.metadata.create_all executed. All manufacturing tables and schemas verified.")
    except Exception as e:
        print(f"  [ERROR] Table creation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
