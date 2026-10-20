"""
tests/test_api_precedents.py

Tests for Precedent Transactions API:
- GET /api/v1/companies/{company_identifier}/precedents
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_precedents_tcs_valid(client: TestClient):
    response = client.get("/api/v1/companies/TCS/precedents")
    assert response.status_code == 200
    data = response.json()
    assert data["target_id"] == "TCS"
    assert data["transaction_count"] == 4
    assert data["small_sample_warning"] is True
    assert len(data["transactions"]) == 4

    # Verify individual transaction structure
    t1 = data["transactions"][0]
    assert "transaction_id" in t1
    assert "acquirer" in t1
    assert "target" in t1
    assert "deal_value_cr" in t1

    # In seed transactions.csv, target_ebitda_cr is null for all transactions
    # Therefore, precedent EV/EBITDA must be null/None, NOT fabricated
    assert data["statistics"]["ev_ebitda"]["n"] == 0
    assert data["statistics"]["ev_ebitda"]["median"] is None
    assert data["implied_valuation"]["ev_ebitda"] is None

    # But EV/Revenue should exist
    assert data["statistics"]["ev_revenue"]["n"] == 3
    assert data["statistics"]["ev_revenue"]["median"] is not None
    assert data["implied_valuation"]["ev_revenue"] is not None
    assert data["implied_valuation"]["ev_revenue"]["implied_equity_value"] > 0

    # Warnings must preserve EV/EBITDA gap and small sample
    warnings_joined = " ".join(data["warnings"])
    assert "EV/EBITDA precedent multiple unavailable" in warnings_joined
    assert "small_sample" in warnings_joined or "threshold: 5" in warnings_joined


def test_precedents_sector_filter(client: TestClient):
    response = client.get("/api/v1/companies/TCS/precedents?sector=Materials")
    assert response.status_code == 200
    data = response.json()
    assert data["transaction_count"] == 3
    for tx in data["transactions"]:
        assert tx["sector"] == "Materials"


def test_precedents_invalid_percentile(client: TestClient):
    response = client.get("/api/v1/companies/TCS/precedents?percentile=p10")
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "INVALID_INPUT"


def test_precedents_unknown_company(client: TestClient):
    response = client.get("/api/v1/companies/UnknownTarget/precedents")
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "RESOURCE_NOT_FOUND"
