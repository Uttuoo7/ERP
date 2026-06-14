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

    # Seed default tenant to prevent foreign key errors for tables enforcing tenant FKs
    from backend.models import Tenant, Account, TenantConfig, SYSTEM_DEFAULT_TENANT_UUID
    from sqlalchemy.orm import Session
    with Session(engine) as session:
        default_tenant = Tenant(
            id=SYSTEM_DEFAULT_TENANT_UUID,
            name="Default Tenant",
            domain="default.local",
            status="ACTIVE"
        )
        session.add(default_tenant)
        session.flush()

        # Seed default GL accounts
        acc_control = Account(
            id=uuid.uuid4(),
            code="1200",
            name="Inventory Control Account",
            account_type="ASSET",
            tenant_id=SYSTEM_DEFAULT_TENANT_UUID
        )
        acc_gain = Account(
            id=uuid.uuid4(),
            code="4100",
            name="Inventory Gain Account",
            account_type="REVENUE",
            tenant_id=SYSTEM_DEFAULT_TENANT_UUID
        )
        acc_loss = Account(
            id=uuid.uuid4(),
            code="5100",
            name="Inventory Loss Account",
            account_type="EXPENSE",
            tenant_id=SYSTEM_DEFAULT_TENANT_UUID
        )
        acc_variance = Account(
            id=uuid.uuid4(),
            code="5000",
            name="Inventory Variance Account",
            account_type="EXPENSE",
            tenant_id=SYSTEM_DEFAULT_TENANT_UUID
        )
        session.add_all([acc_control, acc_gain, acc_loss, acc_variance])
        session.flush()

        # Seed default config
        config = TenantConfig(
            tenant_uuid=SYSTEM_DEFAULT_TENANT_UUID,
            inventory_control_account_id=acc_control.id,
            inventory_adjustment_gain_account_id=acc_gain.id,
            inventory_adjustment_loss_account_id=acc_loss.id,
            inventory_variance_account_id=acc_variance.id,
            inventory_costing_method="FIFO",
            allow_negative_inventory=False,
            tenant_id=SYSTEM_DEFAULT_TENANT_UUID
        )
        session.add(config)
        session.commit()

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
    connection.exec_driver_sql("BEGIN")
    session = test_session_factory(bind=connection)
    session.begin_nested()

    # Monkeypatch commit and rollback to prevent leaking nested transactions into the outer transaction
    real_commit = session.commit
    real_rollback = session.rollback

    def patched_commit():
        if session.in_nested_transaction():
            real_commit()
            session.begin_nested()
        else:
            session.flush()

    def patched_rollback():
        if session.in_nested_transaction():
            real_rollback()
            session.begin_nested()
        else:
            real_rollback()

    session.commit = patched_commit
    session.rollback = patched_rollback

    yield session

    session.commit = real_commit
    session.rollback = real_rollback
    session.close()
    try:
        connection.exec_driver_sql("ROLLBACK")
    except Exception:
        pass
    connection.close()


