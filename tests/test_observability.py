import pytest
from unittest.mock import MagicMock, patch

@pytest.fixture(autouse=True)
def mock_redis_and_psutil():
    # Mock Redis client
    mock_redis_instance = MagicMock()
    mock_redis_instance.ping.return_value = True
    mock_redis_instance.llen.return_value = 0
    
    # Mock psutil cpu & memory
    mock_cpu = MagicMock(return_value=12.5)
    mock_mem = MagicMock()
    mock_mem.percent = 45.2
    
    with patch("redis.Redis.from_url", return_value=mock_redis_instance), \
         patch("psutil.cpu_percent", mock_cpu), \
         patch("psutil.virtual_memory", return_value=mock_mem):
        yield

@pytest.mark.api
def test_get_overall_health(client):
    """Test the general health check endpoint with mocked Redis."""
    response = client.get("/api/observability/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "services" in data
    assert data["services"]["database"]["status"] == "UP"
    assert data["services"]["redis"]["status"] == "UP"

@pytest.mark.api
def test_get_db_health(client):
    """Test the DB specific health check endpoint."""
    response = client.get("/api/observability/health/db")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert "latency_ms" in data

@pytest.mark.api
def test_get_redis_health(client):
    """Test the Redis specific health check endpoint with mocked Redis."""
    response = client.get("/api/observability/health/redis")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"

@pytest.mark.api
def test_get_celery_health(client):
    """Test the Celery specific health check endpoint with mocked Redis."""
    response = client.get("/api/observability/health/celery")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert "queue_depth" in data

@pytest.mark.api
def test_get_websocket_health(client):
    """Test the WebSocket specific health check endpoint."""
    response = client.get("/api/observability/health/websocket")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert "active_connections" in data
