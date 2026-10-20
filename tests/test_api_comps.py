"""
tests/test_api_comps.py

Tests for Comparable Companies API:
- GET /api/v1/companies/{company_identifier}/comps
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_comps_tcs_valid(client: TestClient):
    response = client.get("/api/v1/companies/TCS/comps")
    assert response.status_code == 200
    data = response.json()
    assert data["target_id"] == "TCS"
    assert data["target_sector"] == "IT"
    assert data["target_industry"] == "IT Services"
    assert data["peer_count"] >= 5
    assert data["small_sample_warning"] is False
    assert len(data["peer_group"]) == data["peer_count"]
    assert "TCS" not in data["peer_group"]

    # Verify peer statistics
    stats = data["peer_statistics"]
    assert "ev_revenue" in stats["multiples"]
    assert "ev_ebitda" in stats["multiples"]
    assert "pe_ratio" in stats["multiples"]
    ev_ebitda = stats["multiples"]["ev_ebitda"]
    assert ev_ebitda["median"] is not None
    assert ev_ebitda["p25"] is not None
    assert ev_ebitda["p75"] is not None
    assert ev_ebitda["n"] > 0

    # Verify implied valuation
    implied = data["implied_valuation"]
    assert "ev_revenue" in implied
    assert "ev_ebitda" in implied
    assert "pe_ratio" in implied
    assert implied["ev_ebitda"]["implied_equity_value"] > 0


def test_comps_percentile_parameter(client: TestClient):
    resp_p25 = client.get("/api/v1/companies/TCS/comps?percentile=p25")
    assert resp_p25.status_code == 200
    val_p25 = resp_p25.json()["implied_valuation"]["ev_ebitda"]["implied_equity_value"]

    resp_p75 = client.get("/api/v1/companies/TCS/comps?percentile=p75")
    assert resp_p75.status_code == 200
    val_p75 = resp_p75.json()["implied_valuation"]["ev_ebitda"]["implied_equity_value"]

    assert val_p75 > val_p25, "75th percentile implied equity value should exceed 25th percentile"


def test_comps_invalid_percentile(client: TestClient):
    response = client.get("/api/v1/companies/TCS/comps?percentile=p99")
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "INVALID_INPUT"


def test_comps_unknown_company(client: TestClient):
    response = client.get("/api/v1/companies/NonExistentCo/comps")
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "RESOURCE_NOT_FOUND"


def test_comps_explicit_peer_ids(client: TestClient):
    response = client.get("/api/v1/companies/TCS/comps?peer_ids=Infosys&peer_ids=Wipro")
    assert response.status_code == 200
    data = response.json()
    assert data["peer_count"] == 2
    assert data["small_sample_warning"] is True
    assert set(data["peer_group"]) == {"Infosys", "Wipro"}
    assert any("comps: only 2 peer(s)" in w for w in data["warnings"])
