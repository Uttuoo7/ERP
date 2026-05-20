import sqlite3

def migrate():
    conn = sqlite3.connect('erp_v8.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE purchase_orders ADD COLUMN created_by_id CHAR(32);")
        print("Added created_by_id to purchase_orders")
    except Exception as e:
        print(e)
        
    try:
        cursor.execute("ALTER TABLE purchase_orders ADD COLUMN updated_by_id CHAR(32);")
        print("Added updated_by_id to purchase_orders")
    except Exception as e:
        print(e)
        
    try:
        cursor.execute("ALTER TABLE purchase_orders ADD COLUMN updated_at DATETIME;")
        print("Added updated_at to purchase_orders")
    except Exception as e:
        print(e)
        
    try:
        cursor.execute("ALTER TABLE internal_sales_orders ADD COLUMN updated_by_id CHAR(32);")
        print("Added updated_by_id to internal_sales_orders")
    except Exception as e:
        print(e)
        
    try:
        cursor.execute("ALTER TABLE internal_sales_orders ADD COLUMN updated_at DATETIME;")
        print("Added updated_at to internal_sales_orders")
    except Exception as e:
        print(e)
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
