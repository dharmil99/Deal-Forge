"""
tests/test_api_valuation.py

Tests for Valuation Summary & Football Field API:
- GET /api/v1/companies/{company_identifier}/valuation
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_valuation_summary_tcs_structure(client: TestClient):
    response = client.get("/api/v1/companies/TCS/valuation")
    assert response.status_code == 200
    data = response.json()

    # Required top-level keys
    for key in ("target", "comps", "precedents", "dcf", "valuation_table", "warnings", "data_quality"):
        assert key in data, f"Missing key '{key}' in valuation response"

    # Target identity
    target = data["target"]
    assert target["company_id"] == "TCS"
    assert target["sector"] == "IT"
    assert target["industry"] == "IT Services"
    assert target["market_cap_latest"] > 0

    # Comps section
    comps = data["comps"]
    assert comps["peer_count"] >= 5
    assert comps["small_sample_warning"] is False
    assert "ev_ebitda" in comps["multiples"]

    # Precedents section
    precedents = data["precedents"]
    assert precedents["transaction_count"] == 4
    assert precedents["small_sample_warning"] is True

    # DCF section
    dcf = data["dcf"]
    assert dcf is not None
    assert dcf["implied_equity_value"] > 0
    assert dcf["wacc"] > 0

    # Football field summary table (must have 6 rows)
    table = data["valuation_table"]
    assert len(table) == 6
    methodologies = [r["methodology"] for r in table]
    assert any("Comps" in m and "EV/Revenue" in m for m in methodologies)
    assert any("Comps" in m and "EV/EBITDA" in m for m in methodologies)
    assert any("Comps" in m and "P/E" in m for m in methodologies)
    assert any("Precedents" in m and "EV/Revenue" in m for m in methodologies)
    assert any("Precedents" in m and "EV/EBITDA" in m for m in methodologies)
    assert any("DCF" in m for m in methodologies)

    # Precedents EV/EBITDA row must be unavailable
    for r in table:
        if "Precedents" in r["methodology"] and "EV/EBITDA" in r["methodology"]:
            assert r["available"] is False
            assert r["mid"] is None

    # Data quality section
    dq = data["data_quality"]
    assert dq["peer_count"] >= 5
    assert dq["comps_small_sample"] is False
    assert dq["precedents_small_sample"] is True
    assert dq["precedent_ev_ebitda_available"] is False
    assert dq["dcf_available"] is True


def test_valuation_no_blended_valuation_in_output(client: TestClient):
    response = client.get("/api/v1/companies/TCS/valuation")
    assert response.status_code == 200
    text = response.text
    forbidden = ("fair_value", "blended", "weighted_average", "consensus")
    for term in forbidden:
        assert term not in text, f"Forbidden term '{term}' found in valuation summary output"


def test_valuation_unknown_company(client: TestClient):
    response = client.get("/api/v1/companies/UnknownCompanyXYZ/valuation")
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "RESOURCE_NOT_FOUND"


def test_valuation_invalid_percentile(client: TestClient):
    response = client.get("/api/v1/companies/TCS/valuation?comps_percentile=invalid")
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "INVALID_INPUT"
