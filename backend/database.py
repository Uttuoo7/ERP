import os
import logging
from datetime import datetime
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://erp_user:erp_password@localhost:5432/p2p_erp")

def sqlite_to_char(val, fmt):
    if not val:
        return ""
    try:
        # Standardize SQLite date formats: split subseconds / 'T' boundaries
        clean_val = val.split('.')[0].replace('T', ' ')
        # Support common patterns
        for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(clean_val, pattern)
                if fmt == "YYYY-MM":
                    return dt.strftime("%Y-%m")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return str(val)[:7]
    except Exception:
        return str(val)[:7]

# Initialize and fallback to SQLite if PostgreSQL connection fails
is_sqlite = False
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    is_sqlite = True
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    try:
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL, 
            pool_size=20, 
            max_overflow=0,
            pool_pre_ping=True
        )
        # Test connection
        conn = engine.connect()
        conn.close()
        logger.info("Successfully connected to PostgreSQL database.")
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed. Falling back to local SQLite database (erp_v8.db)... Error: {e}")
        SQLALCHEMY_DATABASE_URL = "sqlite:///./erp_v8.db"
        is_sqlite = True
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            connect_args={"check_same_thread": False}
        )

# SQLite enforcement of foreign keys & registering custom to_char function
if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
        # Register custom to_char UDF to preserve 100% query compatibility with PostgreSQL
        dbapi_connection.create_function("to_char", 2, sqlite_to_char)
        logger.info("Custom to_char function registered on SQLite driver.")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
