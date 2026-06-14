import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "erp_v8.db")

def clean():
    print("Connecting to:", DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Disable foreign keys temporarily to allow ID updates
        cursor.execute("PRAGMA foreign_keys = OFF;")
        
        # 1. Clean fiscal_years id
        cursor.execute("SELECT id, name FROM fiscal_years;")
        fy_rows = cursor.fetchall()
        print("Existing Fiscal Years:")
        for row in fy_rows:
            old_id = row[0]
            new_id = old_id.replace("-", "")
            print(f" - {row[1]}: {old_id} -> {new_id}")
            cursor.execute("UPDATE fiscal_years SET id = ? WHERE id = ?;", (new_id, old_id))
            
            # 2. Clean accounting_periods referencing this fiscal_year
            cursor.execute("UPDATE accounting_periods SET fiscal_year_id = ? WHERE fiscal_year_id = ?;", (new_id, old_id))
            
            # 3. Clean journal_sequences referencing this fiscal_year
            cursor.execute("UPDATE journal_sequences SET fiscal_year_id = ? WHERE fiscal_year_id = ?;", (new_id, old_id))
            
        conn.commit()
        print("UUID normalization complete.")
        
        # Re-enable foreign keys and verify integrity
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("PRAGMA foreign_key_check;")
        errors = cursor.fetchall()
        if errors:
            print("Warning: Foreign Key violations found after update:", errors)
        else:
            print("Database integrity check passed successfully!")
            
    except Exception as e:
        conn.rollback()
        print("Error during clean:", e)
    finally:
        conn.close()

if __name__ == "__main__":
    clean()
