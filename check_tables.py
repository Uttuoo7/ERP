import sqlite3
conn = sqlite3.connect('erp_v8.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]
conn.close()
for table in sorted(tables):
    print(table)
