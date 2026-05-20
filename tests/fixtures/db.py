"""
tests/fixtures/db.py
Test database fixture with automatic fallback to SQLite if PostgreSQL is unavailable.
"""

import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Default to SQLite in-memory for environments without PostgreSQL.
DEFAULT_SQLITE_URL = "sqlite:///./test.db"
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", DEFAULT_SQLITE_URL)

@pytest.fixture(scope="session")
def test_engine():
    """Create a SQLAlchemy engine for the test database.
    Attempts to connect to the provided URL; on failure, falls back to SQLite.
    """
    from backend.models import Base
    try:
        engine = create_engine(
            TEST_DATABASE_URL,
            pool_pre_ping=True,
            echo=False,
        )
        # Test connection for PostgreSQL URLs
        if not TEST_DATABASE_URL.startswith("sqlite"):
            # try connecting to ensure server is up
            conn = engine.connect()
            conn.close()
    except Exception as e:
        # Fallback to SQLite
        engine = create_engine(
            DEFAULT_SQLITE_URL,
            connect_args={"check_same_thread": False},
            echo=False,
        )
        # Log fallback (would normally use logger)
        print("[INFO] PostgreSQL unavailable, falling back to SQLite for tests.")
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
