"""
tests/test_api_screening.py

Tests for Acquisition Target Screening API:
- POST /api/v1/screening
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_screening_default_screen(client: TestClient):
    response = client.post("/api/v1/screening", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["total_universe_count"] == 113
    assert data["passed_count"] > 0
    assert len(data["items"]) == data["passed_count"]
    # By default, industrial_only is True
    for item in data["items"]:
        assert item["sector_type"] == "Industrial"


def test_screening_filters_revenue_and_ebitda(client: TestClient):
    payload = {
        "min_revenue_cagr": 0.10,
        "min_ebitda_margin": 0.15,
        "max_ev_ebitda": 15.0,
        "max_net_debt_ebitda": 3.0,
    }
    response = client.post("/api/v1/screening", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["passed_count"] > 0
    for item in data["items"]:
        assert item["revenue_cagr"] >= 0.10
        assert item["ebitda_margin"] >= 0.15
        assert item["ev_ebitda"] <= 15.0
        assert item["net_debt_ebitda"] <= 3.0


def test_screening_sector_filter(client: TestClient):
    payload = {"sector": "IT"}
    response = client.post("/api/v1/screening", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["passed_count"] > 0
    for item in data["items"]:
        assert item["sector"] == "IT"


def test_screening_industrial_only_false_includes_financials(client: TestClient):
    payload = {"industrial_only": False}
    response = client.post("/api/v1/screening", json=payload)
    assert response.status_code == 200
    data = response.json()
    has_financial = any(item["sector_type"] == "Financial" for item in data["items"])
    assert has_financial, "Expected financial companies to be present when industrial_only=False"
    # Should contain warning about financial sector multiples
    assert any("Financial-sector" in w for w in data["warnings"])


def test_screening_sorting_and_limit(client: TestClient):
    payload = {
        "sort_by": "revenue_cagr",
        "ascending": False,
        "limit": 5,
    }
    response = client.post("/api/v1/screening", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 5
    cagrs = [item["revenue_cagr"] for item in data["items"]]
    assert cagrs == sorted(cagrs, reverse=True)


def test_screening_invalid_input_extra_field_rejected(client: TestClient):
    payload = {"min_revenue_cagr": 0.10, "unrecognized_filter": 999}
    response = client.post("/api/v1/screening", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["status"] == "error"
    assert data["code"] == "VALIDATION_ERROR"


def test_screening_diagnostics_structure(client: TestClient):
    response = client.post("/api/v1/screening", json={"min_revenue_cagr": 0.50})
    assert response.status_code == 200
    data = response.json()
    assert "diagnostics" in data
    assert "total_universe" in data["diagnostics"]
    assert "filters_applied" in data
