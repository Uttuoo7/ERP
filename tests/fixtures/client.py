"""
tests/fixtures/client.py
FastAPI TestClient fixture wired to use the test database session.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Set the test environment BEFORE importing the app
os.environ["TESTING"] = "1"
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
    from backend.dependencies import get_current_user
    from backend import models, auth_utils
    import uuid
    from fastapi import Depends, HTTPException
    from fastapi.security import OAuth2PasswordBearer

    oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # Rollback is handled by db_session fixture teardown

    def override_get_current_user(token: str = Depends(oauth2_scheme)):
        payload = auth_utils.decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id_str = payload.get("sub")
        role_str = payload.get("role", "BUYER")
        try:
            user_uuid = uuid.UUID(user_id_str)
        except (ValueError, TypeError):
            raise HTTPException(status_code=401, detail="Invalid sub")
        
        # Check if the role is a string and map to models.Role
        if isinstance(role_str, str):
            for r in models.Role:
                if r.value == role_str or r.name == role_str:
                    role_enum = r
                    break
            else:
                role_enum = models.Role.BUYER
        else:
            role_enum = role_str

        return models.User(
            id=user_uuid,
            username=f"mock_{role_str.lower()}",
            email=f"mock_{role_str.lower()}@test.local",
            role=role_enum,
            is_active=True
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    # Clean up overrides after test
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
