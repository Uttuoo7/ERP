import os
import logging
from datetime import datetime
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

from .config.settings import settings

SQLALCHEMY_DATABASE_URL = settings.db.url

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
            pool_size=settings.db.pool_size, 
            max_overflow=settings.db.max_overflow,
            pool_pre_ping=settings.db.pool_pre_ping
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

import contextvars
import uuid
from sqlalchemy.orm import with_loader_criteria

# Re-export for tenant_middleware and other modules that import from database
from .models import SYSTEM_DEFAULT_TENANT_UUID  # noqa: F401

current_tenant_id_context = contextvars.ContextVar("current_tenant_id", default=None)
bypass_tenant_filter_context = contextvars.ContextVar("bypass_tenant_filter", default=False)

def set_current_tenant_id(tenant_id: uuid.UUID):
    current_tenant_id_context.set(tenant_id)

def get_current_tenant_id() -> uuid.UUID:
    return current_tenant_id_context.get()

def set_bypass_tenant_filter(bypass: bool):
    bypass_tenant_filter_context.set(bypass)

def get_bypass_tenant_filter() -> bool:
    return bypass_tenant_filter_context.get()

@event.listens_for(SessionLocal, "do_orm_execute")
def opt_in_tenant_filtering(orm_execute_state):
    if orm_execute_state.is_select and not get_bypass_tenant_filter():
        from .models import Base
        tenant_id = get_current_tenant_id()
        
        if tenant_id:
            # Enforce matching tenant AND active record (not deleted)
            orm_execute_state.statement = orm_execute_state.statement.options(
                with_loader_criteria(
                    Base,
                    lambda cls: (cls.tenant_id == tenant_id) & (cls.is_deleted == False),
                    include_aliases=True,
                    propagate_to_loaders=True
                )
            )
        else:
            # Enforce active record only (useful for non-tenant sessions like global auth, seeding)
            orm_execute_state.statement = orm_execute_state.statement.options(
                with_loader_criteria(
                    Base,
                    lambda cls: cls.is_deleted == False,
                    include_aliases=True,
                    propagate_to_loaders=True
                )
            )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

