import sqlite3
import os
import sys
from backend.models import Base

def auto_migrate():
    db_path = 'erp_v8.db'
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Comparing SQLAlchemy metadata against SQLite database columns...")
    
    for table_name, table_obj in Base.metadata.tables.items():
        try:
            cursor.execute(f"PRAGMA table_info({table_name});")
            existing_cols = {row[1] for row in cursor.fetchall()}
            if not existing_cols:
                # Table does not exist yet (let create_all handle it)
                continue
                
            for col_name, col_obj in table_obj.columns.items():
                if col_name not in existing_cols:
                    # SQLite column missing
                    col_type = "TEXT"
                    from sqlalchemy import Integer, Boolean, DateTime, Numeric
                    
                    if isinstance(col_obj.type, Integer):
                        col_type = "INTEGER"
                    elif isinstance(col_obj.type, Boolean):
                        col_type = "BOOLEAN"
                    elif isinstance(col_obj.type, DateTime):
                        col_type = "DATETIME"
                    elif isinstance(col_obj.type, Numeric):
                        col_type = "NUMERIC"
                        
                    alter_query = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type};"
                    try:
                        cursor.execute(alter_query)
                        print(f" [SUCCESS] Added column '{col_name}' ({col_type}) to table '{table_name}'")
                    except Exception as err:
                        print(f" [FAILED] Could not add '{col_name}' to '{table_name}': {err}")
        except Exception as e:
            print(f"Error checking table {table_name}: {e}")
            
    conn.commit()
    conn.close()
    print("Auto-migration complete.")

if __name__ == "__main__":
    auto_migrate()
