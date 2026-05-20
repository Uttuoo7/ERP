import sqlite3

def check():
    conn = sqlite3.connect('erp_v8.db')
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables in erp_v8.db:")
    for t in tables:
        print(f" - {t[0]}")
    conn.close()

if __name__ == "__main__":
    check()
