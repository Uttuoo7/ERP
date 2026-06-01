#!/usr/bin/env python3
"""
P2P ERP Enterprise Backup & Snapshot Automation Engine
Supports both PostgreSQL (production) and SQLite (development/local)
"""
import os
import sys
import time
import shutil
import subprocess
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BACKUP_DIR = os.getenv("BACKUP_DIR", "backups")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./erp_v8.db")
UPLOADS_DIR = "uploads"

# Create backup directory
os.makedirs(BACKUP_DIR, exist_ok=True)

def parse_db_url(url: str):
    """Parse db connection url for variables."""
    # postgresql://user:password@host:port/dbname
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
        # sqlite:///path/to/db
        db_path = url.replace("sqlite:///", "").replace("sqlite://", "")
        return {
            "type": "sqlite",
            "path": db_path
        }

def run_backup():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    print(f"[*] Starting ERP System Backup - Snapshot: {timestamp}")
    
    db_info = parse_db_url(DATABASE_URL)
    if not db_info:
        print("[-] Invalid database configuration URL.")
        sys.exit(1)

    backup_name = f"erp_backup_{timestamp}"
    session_backup_dir = os.path.join(BACKUP_DIR, backup_name)
    os.makedirs(session_backup_dir, exist_ok=True)

    # 1. Database Backup
    db_backup_file = ""
    if db_info["type"] == "postgres":
        db_backup_file = os.path.join(session_backup_dir, "database.sql")
        print(f"[*] Executing PostgreSQL dump to {db_backup_file}...")
        env = os.environ.copy()
        env["PGPASSWORD"] = db_info["password"]
        
        cmd = [
            "pg_dump",
            "-h", db_info["host"],
            "-p", db_info["port"],
            "-U", db_info["user"],
            "-d", db_info["dbname"],
            "-f", db_backup_file,
            "--clean", # Includes DROP TABLE statements
            "--if-exists"
        ]
        
        try:
            result = subprocess.run(cmd, env=env, capture_output=True, text=True, check=True)
            print("[+] PostgreSQL database backup completed successfully.")
        except subprocess.CalledProcessError as e:
            print(f"[-] pg_dump failed: {e.stderr}")
            shutil.rmtree(session_backup_dir)
            sys.exit(1)
            
    elif db_info["type"] == "sqlite":
        db_backup_file = os.path.join(session_backup_dir, "database.db")
        print(f"[*] Copying SQLite database from {db_info['path']} to {db_backup_file}...")
        if os.path.exists(db_info["path"]):
            try:
                shutil.copy2(db_info["path"], db_backup_file)
                print("[+] SQLite database backup completed successfully.")
            except Exception as e:
                print(f"[-] SQLite copy failed: {e}")
                shutil.rmtree(session_backup_dir)
                sys.exit(1)
        else:
            print(f"[-] SQLite database file not found at {db_info['path']}. Creating empty schema placeholder.")

    # 2. Uploads Directory Backup (Media & Documents)
    if os.path.exists(UPLOADS_DIR):
        uploads_backup_dest = os.path.join(session_backup_dir, "uploads")
        print(f"[*] Copying attachments directory to {uploads_backup_dest}...")
        try:
            shutil.copytree(UPLOADS_DIR, uploads_backup_dest, dirs_exist_ok=True)
            print("[+] Uploads attachments directory backup completed successfully.")
        except Exception as e:
            print(f"[-] Uploads copying failed: {e}")
    else:
        print("[*] No uploads directory found to backup.")

    # 3. Create Compressed Archive
    archive_path = shutil.make_archive(session_backup_dir, 'gztar', session_backup_dir)
    # Remove raw folder, keeping only the compressed tarball
    shutil.rmtree(session_backup_dir)
    
    print(f"[+] BACKUP COMPLETE: {archive_path}")
    print(f"[+] Total Size: {round(os.path.getsize(archive_path) / (1024 * 1024), 2)} MB")

if __name__ == "__main__":
    run_backup()
