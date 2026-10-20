"""
tests/test_api_companies.py

Tests for Companies API endpoints:
- GET /api/v1/companies
- GET /api/v1/companies/{company_identifier}
- GET /api/v1/companies/{company_identifier}/financials
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_list_companies_default(client: TestClient):
    response = client.get("/api/v1/companies")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert data["total"] == 113
    assert len(data["items"]) == 50  # default page limit


def test_list_companies_pagination(client: TestClient):
    response = client.get("/api/v1/companies?skip=10&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert data["skip"] == 10
    assert data["limit"] == 5
    assert len(data["items"]) == 5


def test_list_companies_sector_filter(client: TestClient):
    response = client.get("/api/v1/companies?sector=IT")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["sector"].lower() == "it"


def test_list_companies_industry_filter(client: TestClient):
    response = client.get("/api/v1/companies?industry=Cement")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["industry"].lower() == "cement"


def test_list_companies_sector_type_filter(client: TestClient):
    response = client.get("/api/v1/companies?sector_type=Financial")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["sector_type"] == "Financial"


def test_list_companies_search(client: TestClient):
    response = client.get("/api/v1/companies?search=Tata")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert (
            "tata" in item["company_name"].lower()
            or "tata" in item["company_id"].lower()
            or (item.get("ticker") and "tata" in item["ticker"].lower())
        )


def test_get_company_detail_valid(client: TestClient):
    response = client.get("/api/v1/companies/TCS")
    assert response.status_code == 200
    data = response.json()
    assert data["company_id"] == "TCS"
    assert "TATA CONSULTANCY SERVICES" in data["company_name"]
    assert data["sector"] == "IT"
    assert data["industry"] == "IT Services"
    assert data["market_cap_latest"] is not None
    assert data["current_price"] is not None
    assert data["ev"] is not None


def test_get_company_detail_case_insensitive(client: TestClient):
    response = client.get("/api/v1/companies/tcs")
    assert response.status_code == 200
    data = response.json()
    assert data["company_id"] == "TCS"


def test_get_company_detail_unknown(client: TestClient):
    response = client.get("/api/v1/companies/UnknownCompanyXYZ")
    assert response.status_code == 404
    data = response.json()
    assert data["status"] == "error"
    assert data["code"] == "RESOURCE_NOT_FOUND"


def test_get_company_financials_valid(client: TestClient):
    response = client.get("/api/v1/companies/TCS/financials")
    assert response.status_code == 200
    data = response.json()
    assert data["company_id"] == "TCS"
    assert data["count"] > 0
    assert len(data["financials"]) == data["count"]
    first = data["financials"][0]
    assert "fiscal_year" in first
    assert "revenue" in first
    assert "net_income" in first


def test_get_company_financials_unknown(client: TestClient):
    response = client.get("/api/v1/companies/UnknownCompanyXYZ/financials")
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "RESOURCE_NOT_FOUND"


def test_get_company_financials_preserves_missing_as_null(client: TestClient):
    response = client.get("/api/v1/companies/ACC/financials")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] > 0
    # In ACC financials.csv line 2, total_debt is empty
    # Verify it is serialized as None/null, not 0
    found_missing_debt = any(r["total_debt"] is None for r in data["financials"])
    assert found_missing_debt, "Expected missing total_debt to be preserved as null"
