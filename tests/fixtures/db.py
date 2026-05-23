"""
tests/fixtures/db.py
Test database fixture with in-memory SQLite for complete isolation.
"""

import os
import uuid
import pytest
from sqlalchemy import create_engine, event, TypeDecorator, String
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool


class SQLiteUUID(TypeDecorator):
    """Platform-independent UUID type that works with SQLite.
    Stores UUIDs as 32-character hex strings in SQLite instead of
    the native PostgreSQL UUID type which doesn't work in SQLite.
    """
    impl = String(32)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if isinstance(value, uuid.UUID):
                return value.hex
            return uuid.UUID(value).hex
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(value)
        return value


@pytest.fixture(scope="session")
def test_engine():
    """Create a SQLAlchemy engine using an in-memory SQLite database.
    Uses StaticPool to ensure all connections share the same in-memory DB.
    Patches PostgreSQL UUID columns to use a SQLite-compatible string type.
    """
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID
    from backend.models import Base

    # Patch all PostgreSQL UUID columns to use SQLite-compatible type
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, PG_UUID):
                column.type = SQLiteUUID()

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Enable foreign keys on every connection (SQLite requirement)
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Create tables
    Base.metadata.create_all(bind=engine)
    yield engine
    # Drop tables after session
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="session")
def test_session_factory(test_engine):
    """Create a session factory bound to the test engine."""
    return sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def db_session(test_engine, test_session_factory) -> Session:
    """Provide a DB session rolled back after each test using SAVEPOINT."""
    connection = test_engine.connect()
    outer = connection.begin()
    session = test_session_factory(bind=connection)
    session.begin_nested()
    yield session
    session.close()
    outer.rollback()
    connection.close()
