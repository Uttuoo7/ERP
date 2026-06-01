#!/usr/bin/env python3
"""
P2P ERP Enterprise Disaster Recovery & Restoration Automation Engine
Restores system state from compressed archives (.tar.gz)
"""
import os
import sys
import shutil
import tempfile
import subprocess
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./erp_v8.db")
UPLOADS_DIR = "uploads"

def parse_db_url(url: str):
    """Parse db connection url for variables."""
    if "postgresql" in url:
        try:
            parts = url.split("://")[1]
            user_pass, host_db = parts.split("@")
            user, password = user_pass.split(":")
            host_port, dbname = host_db.split("/")
            if ":" in host_port:
                host, port = host_port.split(":")
            else:
                host = host_port
                port = "5432"
            return {
                "type": "postgres",
                "user": user,
                "password": password,
                "host": host,
                "port": port,
                "dbname": dbname.split("?")[0]
            }
        except Exception as e:
            print(f"[-] Failed to parse PostgreSQL URL: {e}")
            return None
    else:
        db_path = url.replace("sqlite:///", "").replace("sqlite://", "")
        return {
            "type": "sqlite",
            "path": db_path
        }

def run_restore(archive_path: str):
    if not os.path.exists(archive_path):
        print(f"[-] Backup archive file not found: {archive_path}")
        sys.exit(1)

    print(f"[*] Beginning restoration sequence from: {archive_path}")
    db_info = parse_db_url(DATABASE_URL)
    if not db_info:
        print("[-] Invalid database configuration URL.")
        sys.exit(1)

    # 1. Extract Archive to Temp Directory
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"[*] Extracting archive contents...")
        try:
            shutil.unpack_archive(archive_path, temp_dir, "gztar")
            print("[+] Extraction successful.")
        except Exception as e:
            print(f"[-] Extraction failed: {e}")
            sys.exit(1)

        # 2. Database Restoration
        if db_info["type"] == "postgres":
            db_sql_file = os.path.join(temp_dir, "database.sql")
            if not os.path.exists(db_sql_file):
                print("[-] database.sql not found inside backup archive!")
                sys.exit(1)

            print(f"[*] Executing database restoration via PostgreSQL psql client...")
            env = os.environ.copy()
            env["PGPASSWORD"] = db_info["password"]
            
            cmd = [
                "psql",
                "-h", db_info["host"],
                "-p", db_info["port"],
                "-U", db_info["user"],
                "-d", db_info["dbname"],
                "-f", db_sql_file
            ]
            try:
                subprocess.run(cmd, env=env, check=True, capture_output=True, text=True)
                print("[+] PostgreSQL database restore completed successfully.")
            except subprocess.CalledProcessError as e:
                print(f"[-] Database restoration failed: {e.stderr}")
                sys.exit(1)

        elif db_info["type"] == "sqlite":
            db_file_src = os.path.join(temp_dir, "database.db")
            if not os.path.exists(db_file_src):
                # Check for alternative name
                db_file_src = os.path.join(temp_dir, "database.sql")
                if not os.path.exists(db_file_src):
                    print("[-] Database files not found inside backup archive!")
                    sys.exit(1)

            print(f"[*] Restoring SQLite database to {db_info['path']}...")
            try:
                # Backup current database file first if it exists, as safety precaution
                if os.path.exists(db_info["path"]):
                    safety_copy = db_info["path"] + ".safety"
                    shutil.copy2(db_info["path"], safety_copy)
                    print(f"[*] Active DB file safety-copied to {safety_copy}")

                shutil.copy2(db_file_src, db_info["path"])
                print("[+] SQLite database restore completed successfully.")
            except Exception as e:
                print(f"[-] SQLite restoration copy failed: {e}")
                sys.exit(1)

        # 3. Restore Uploads/Attachments
        uploads_src_dir = os.path.join(temp_dir, "uploads")
        if os.path.exists(uploads_src_dir):
            print(f"[*] Restoring uploads/attachments directory to {UPLOADS_DIR}...")
            try:
                shutil.copytree(uploads_src_dir, UPLOADS_DIR, dirs_exist_ok=True)
                print("[+] Uploads folder restored successfully.")
            except Exception as e:
                print(f"[-] Uploads restore copy failed: {e}")

    print("[+] RESTORATION COMPLETED SUCCESSFULLY. System recovered successfully.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("[-] Usage: python restore.py <path_to_backup_archive.tar.gz>")
        sys.exit(1)
    run_restore(sys.argv[1])
