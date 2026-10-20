"""
tests/test_api_dcf.py

Tests for Discounted Cash Flow API:
- GET /api/v1/companies/{company_identifier}/dcf
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_dcf_tcs_default(client: TestClient):
    response = client.get("/api/v1/companies/TCS/dcf")
    assert response.status_code == 200
    data = response.json()
    assert data["company_id"] == "TCS"
    assert data["wacc_used"] > 0
    assert data["wacc_detail"] is not None
    assert "cost_of_equity" in data["wacc_detail"]
    assert "cost_of_debt_after_tax" in data["wacc_detail"]
    assert data["terminal_growth"] == 0.05
    assert data["forecast_years"] == 5
    assert len(data["forecast"]) == 5

    # Check cash flow structure
    for yr in data["forecast"]:
        assert yr["forecast_year"] >= 1
        assert yr["revenue"] > 0
        assert yr["ebitda"] > 0
        assert yr["fcff"] > 0

    assert data["terminal_value_undiscounted"] > 0
    assert data["pv_explicit_fcff"] > 0
    assert data["pv_terminal_value"] > 0
    assert data["implied_ev"] == pytest.approx(
        data["pv_explicit_fcff"] + data["pv_terminal_value"], rel=1e-5
    )
    assert data["implied_equity_value"] > 0
    assert data["implied_value_per_share"] > 0


def test_dcf_custom_assumptions(client: TestClient):
    response = client.get(
        "/api/v1/companies/TCS/dcf?wacc=0.14&terminal_growth=0.04&forecast_years=7"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["wacc_used"] == 0.14
    assert data["terminal_growth"] == 0.04
    assert data["forecast_years"] == 7
    assert len(data["forecast"]) == 7


def test_dcf_terminal_growth_greater_than_wacc_raises_400(client: TestClient):
    response = client.get("/api/v1/companies/TCS/dcf?wacc=0.08&terminal_growth=0.10")
    assert response.status_code == 400
    data = response.json()
    assert data["status"] == "error"
    assert data["code"] == "INVALID_INPUT"
    assert "must be less than WACC" in data["message"]


def test_dcf_capex_warning_preserved(client: TestClient):
    # Pass capex_pct_revenue (0.35) > ebitda_margin (0.25)
    response = client.get(
        "/api/v1/companies/TCS/dcf?ebitda_margin=0.20&capex_pct_revenue=0.30"
    )
    assert response.status_code == 200
    data = response.json()
    warnings_joined = " ".join(data["warnings"])
    assert "CapEx assumption" in warnings_joined
    assert "exceeds EBITDA margin" in warnings_joined


def test_dcf_unknown_company(client: TestClient):
    response = client.get("/api/v1/companies/NoSuchCompany/dcf")
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "RESOURCE_NOT_FOUND"
