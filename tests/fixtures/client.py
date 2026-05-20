"""
tests/fixtures/client.py
FastAPI TestClient fixture wired to use the test database session.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Set the test environment BEFORE importing the app
os.environ.setdefault("TEST_DATABASE_URL",
    "postgresql://erp_test_user:erp_test_password@localhost:5433/p2p_erp_test")


@pytest.fixture
def client(db_session: Session) -> TestClient:
    """
    Return a FastAPI TestClient whose database dependency is overridden
    to use the transactional test session (rolled back after each test).
    """
    from backend.main import app
    from backend.database import get_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # Rollback is handled by db_session fixture teardown

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    # Clean up override after test
    app.dependency_overrides.pop(get_db, None)
