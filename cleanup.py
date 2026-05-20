import sqlite3
c = sqlite3.connect('erp_v8.db')
c.execute("DELETE FROM purchase_orders WHERE po_number='PO-TEST'")
c.commit()
