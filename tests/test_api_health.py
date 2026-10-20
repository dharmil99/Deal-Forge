"""
tests/test_api_health.py

Tests for FastAPI health checks, API v1 routing foundation, and OpenAPI specification.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import get_settings
from backend.app.main import create_app


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Create a FastAPI test client for the DealForge application."""
    app = create_app()
    return TestClient(app)


def test_root_health_endpoint(client: TestClient) -> None:
    """Test GET /health returns a 200 OK with expected structure."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "dealforge-api"
    assert "version" in data
    assert "environment" in data


def test_api_v1_health_endpoint(client: TestClient) -> None:
    """Test GET /api/v1/health returns a 200 OK with versioned route."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "dealforge-api"
    assert data["version"] == get_settings().api_version


def test_not_found_returns_structured_error(client: TestClient) -> None:
    """Test requesting an undefined endpoint returns structured ErrorResponse without stack traces."""
    response = client.get("/api/v1/nonexistent-route-for-testing")
    assert response.status_code == 404
    data = response.json()
    assert data["status"] == "error"
    assert "message" in data
    assert "code" in data
    assert data["code"] == "HTTP_404"


def test_openapi_schema(client: TestClient) -> None:
    """Test that the OpenAPI JSON specification is generated correctly."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "DealForge API"
    assert "/health" in schema["paths"]
    assert "/api/v1/health" in schema["paths"]
