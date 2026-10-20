"""
tests/test_backend_core.py

Unit tests for backend core configuration, error models, and exception handlers.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from backend.app.core.config import Settings, get_settings
from backend.app.core.errors import (
    DealForgeError,
    EntityNotFoundError,
    InvalidInputError,
    setup_error_handlers,
)
from backend.app.schemas.common import ErrorResponse, HealthResponse, WarningMessage


def test_settings_sensible_defaults() -> None:
    """Validate that Settings provides sensible local defaults without requiring a .env file."""
    settings = Settings()
    assert settings.app_name == "DealForge API"
    assert settings.api_version == "0.1.0"
    assert settings.environment == "development"
    assert settings.data_dir.exists()
    assert isinstance(settings.cors_origins, list)
    assert len(settings.cors_origins) > 0


def test_common_schemas() -> None:
    """Validate schema construction and serialization."""
    health = HealthResponse(version="0.1.0", environment="test")
    assert health.status == "ok"
    assert health.service == "dealforge-api"

    warning = WarningMessage(code="SMALL_SAMPLE", message="Sample size < 5")
    assert warning.severity == "warning"

    err = ErrorResponse(message="Resource not found", code="NOT_FOUND")
    assert err.status == "error"
    assert err.message == "Resource not found"


def test_custom_exception_handlers() -> None:
    """Validate that custom domain exceptions return expected HTTP status and JSON envelope."""
    app = FastAPI()
    setup_error_handlers(app)

    @app.get("/trigger-entity-not-found")
    def trigger_entity_not_found():
        raise EntityNotFoundError("Target company TCS_XYZ not found")

    @app.get("/trigger-invalid-input")
    def trigger_invalid_input():
        raise InvalidInputError("Financing mix must sum to 1.0")

    @app.get("/trigger-dealforge-error")
    def trigger_dealforge_error():
        raise DealForgeError("General modeling failure", code="MODEL_FAILURE")

    @app.get("/trigger-unhandled")
    def trigger_unhandled():
        raise RuntimeError("Secret internal failure that should not be exposed")

    client = TestClient(app, raise_server_exceptions=False)

    # 404 Entity Not Found
    res = client.get("/trigger-entity-not-found")
    assert res.status_code == 404
    assert res.json()["code"] == "RESOURCE_NOT_FOUND"
    assert "TCS_XYZ" in res.json()["message"]

    # 400 Invalid Input
    res = client.get("/trigger-invalid-input")
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_INPUT"

    # 400 DealForge Error
    res = client.get("/trigger-dealforge-error")
    assert res.status_code == 400
    assert res.json()["code"] == "MODEL_FAILURE"

    # 500 Unhandled Exception - stack trace shielded
    res = client.get("/trigger-unhandled")
    assert res.status_code == 500
    data = res.json()
    assert data["code"] == "INTERNAL_SERVER_ERROR"
    assert "Secret internal failure" not in data["message"]
    assert data["message"] == "An unexpected internal server error occurred."
