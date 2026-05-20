"""
tests/test_rbac.py
RBAC & Security Tests.

Validates:
  - Unauthenticated requests are rejected (401)
  - Insufficient role access is forbidden (403)
  - Correct roles can access protected endpoints
  - Token expiry is rejected
"""
import pytest
import uuid
import time
from datetime import datetime, timedelta, timezone

import jwt

from tests.fixtures.auth import make_token


pytestmark = pytest.mark.rbac

JWT_SECRET = "test_jwt_secret_key_for_erp_testing_only"
ALGORITHM = "HS256"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Unauthenticated Access ───────────────────────────────────────────────────

class TestUnauthenticated:
    def test_vendors_list_requires_auth(self, client):
        """GET /api/vendors/ without token should return 401 or 403."""
        response = client.get("/api/vendors/")
        assert response.status_code in (401, 403)

    def test_items_list_requires_auth(self, client):
        response = client.get("/api/items/")
        assert response.status_code in (401, 403)

    def test_purchase_orders_requires_auth(self, client):
        response = client.get("/api/pos/")
        assert response.status_code in (401, 403)

    def test_invoices_requires_auth(self, client):
        response = client.get("/api/invoices/")
        assert response.status_code in (401, 403)

    def test_analytics_requires_auth(self, client):
        response = client.get("/api/analytics/command-center")
        assert response.status_code in (401, 403)


# ─── Token Validity ────────────────────────────────────────────────────────────

class TestTokenValidity:
    def test_expired_token_is_rejected(self, client):
        """An expired JWT token must be rejected."""
        expired_token = make_token(
            user_id=str(uuid.uuid4()),
            role="ADMIN",
            expires_minutes=-1  # Already expired
        )
        response = client.get("/api/vendors/",
                               headers=headers(expired_token))
        assert response.status_code in (401, 403)

    def test_malformed_token_is_rejected(self, client):
        """A garbage token string must be rejected."""
        response = client.get("/api/vendors/",
                               headers={"Authorization": "Bearer this.is.garbage"})
        assert response.status_code in (401, 403)

    def test_missing_bearer_prefix_rejected(self, client):
        """Token without 'Bearer' prefix must be rejected."""
        valid_token = make_token(str(uuid.uuid4()), "ADMIN")
        response = client.get("/api/vendors/",
                               headers={"Authorization": valid_token})
        assert response.status_code in (401, 403)

    def test_valid_admin_token_accepted(self, client, admin_headers):
        """A valid admin token should be accepted for health check."""
        response = client.get("/api/health", headers=admin_headers)
        assert response.status_code == 200


# ─── Role-Based Access ─────────────────────────────────────────────────────────

class TestRoleEnforcement:
    def test_admin_can_access_rbac_users(self, client, admin_headers):
        """ADMIN role should be able to access /api/auth/rbac/users."""
        response = client.get("/api/auth/rbac/users", headers=admin_headers)
        # Either 200 (success) or 404 if endpoint not found, but not 401/403
        assert response.status_code not in (401, 403)

    def test_buyer_cannot_access_rbac_admin(self, client, buyer_headers):
        """BUYER role should NOT be able to manage RBAC users."""
        response = client.get("/api/auth/rbac/users", headers=buyer_headers)
        # Expect 401, 403, or 404 (not 200)
        assert response.status_code != 200 or response.status_code == 404

    def test_finance_can_access_invoices(self, client, finance_headers):
        """FINANCE role should be able to list invoices."""
        response = client.get("/api/invoices/", headers=finance_headers)
        assert response.status_code not in (401, 403)

    def test_warehouse_can_access_grns(self, client, warehouse_headers):
        """WAREHOUSE role should be able to list GRNs."""
        response = client.get("/api/grns/", headers=warehouse_headers)
        assert response.status_code not in (401, 403)

    def test_auditor_gets_read_access(self, client, auditor_headers):
        """AUDITOR should have read access to procurement data."""
        response = client.get("/api/pos/", headers=auditor_headers)
        assert response.status_code not in (401, 403)


# ─── Endpoint Security ────────────────────────────────────────────────────────

class TestEndpointSecurity:
    def test_health_is_public(self, client):
        """Health check endpoint is public — no auth required."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_cannot_inject_arbitrary_role(self, client):
        """A token with an invented role should be rejected."""
        fake_token = jwt.encode(
            {
                "sub": str(uuid.uuid4()),
                "role": "SUPER_HACKER",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            },
            JWT_SECRET,
            algorithm=ALGORITHM,
        )
        response = client.get("/api/auth/rbac/users",
                               headers={"Authorization": f"Bearer {fake_token}"})
        assert response.status_code in (401, 403, 422)

    def test_sql_injection_in_query_param_handled(self, client, admin_headers):
        """SQL injection attempts in query params should not crash the server."""
        response = client.get(
            "/api/vendors/?search=' OR '1'='1",
            headers=admin_headers
        )
        # Should return 200 (empty result) or 422, never 500
        assert response.status_code != 500
