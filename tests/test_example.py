import pytest
from tests.fixtures.client import client
from tests.fixtures.db import db_session

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json().get("status") == "ok"
