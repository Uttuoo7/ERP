"""
tests/fixtures/auth.py
Authentication helpers for generating test JWT tokens and auth headers.
"""
import os
import uuid
import pytest
from datetime import datetime, timedelta, timezone

import jwt

JWT_SECRET = os.getenv("SECRET_KEY", os.getenv("JWT_SECRET", "test_jwt_secret_key_for_erp_testing_only"))
JWT_ALGORITHM = "HS256"


def make_token(user_id: str, role: str, expires_minutes: int = 60) -> str:
    """Generate a JWT token for a test user."""
    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_minutes),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def auth_headers(user_id: str = None, role: str = "ADMIN") -> dict:
    """Return Authorization headers dict for a given role."""
    uid = user_id or str(uuid.uuid4())
    token = make_token(uid, role)
    return {"Authorization": f"Bearer {token}"}


# ── Pre-built fixtures for common roles ────────────────────────────────────

@pytest.fixture
def admin_headers() -> dict:
    return auth_headers(role="ADMIN")


@pytest.fixture
def buyer_headers() -> dict:
    return auth_headers(role="BUYER")


@pytest.fixture
def warehouse_headers() -> dict:
    return auth_headers(role="WAREHOUSE")


@pytest.fixture
def finance_headers() -> dict:
    return auth_headers(role="FINANCE")


@pytest.fixture
def procurement_manager_headers() -> dict:
    return auth_headers(role="PROCUREMENT_MANAGER")


@pytest.fixture
def finance_manager_headers() -> dict:
    return auth_headers(role="FINANCE_MANAGER")


@pytest.fixture
def auditor_headers() -> dict:
    return auth_headers(role="AUDITOR")
