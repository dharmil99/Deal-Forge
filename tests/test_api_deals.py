"""
tests/test_api_deals.py

Tests for Deal Workspace API endpoints:
- POST /api/v1/deals (Deal Builder)
- POST /api/v1/deals/sources-uses (Sources & Uses)
- POST /api/v1/deals/accretion-dilution (Accretion / Dilution)
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


# ===========================================================================
# 1. Deal Builder API Tests
# ===========================================================================

def test_deal_builder_tcs_infosys_valid(client: TestClient):
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "acquisition_premium": 0.20,
        "cash_pct": 0.50,
        "debt_pct": 0.30,
        "stock_pct": 0.20,
        "transaction_fees": 500.0,
        "expected_annual_synergies": 2000.0,
    }
    response = client.post("/api/v1/deals", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Acquirer & Target profiles
    assert data["acquirer"]["company_id"] == "TCS"
    assert data["target"]["company_id"] == "Infosys"
    assert data["acquirer"]["market_cap"] > 0
    assert data["target"]["equity_value"] > 0

    # Transaction terms
    txn = data["transaction"]
    assert txn["acquisition_premium"] == 0.20
    assert txn["purchase_equity_value"] == pytest.approx(
        txn["target_standalone_equity_value"] * 1.20, rel=1e-4
    )
    assert txn["transaction_fees"] == 500.0
    assert txn["total_transaction_value"] == txn["purchase_equity_value"] + 500.0
    assert txn["offer_price_per_share"] > 0
    assert txn["transaction_enterprise_value"] is not None

    # Financing structure
    fin = data["financing"]
    assert fin["cash_pct"] == 0.50
    assert fin["debt_pct"] == 0.30
    assert fin["stock_pct"] == 0.20
    assert fin["cash_amount"] == pytest.approx(txn["purchase_equity_value"] * 0.50, rel=1e-4)
    assert fin["debt_amount"] == pytest.approx(txn["purchase_equity_value"] * 0.30, rel=1e-4)
    assert fin["stock_amount"] == pytest.approx(txn["purchase_equity_value"] * 0.20, rel=1e-4)

    # Synergies
    syn = data["synergies"]
    assert syn["annual_run_rate"] == 2000.0
    assert syn["year_1"] == pytest.approx(2000.0 * 0.33, rel=1e-4)
    assert syn["year_2"] == pytest.approx(2000.0 * 0.67, rel=1e-4)
    assert syn["year_3"] == pytest.approx(2000.0 * 1.00, rel=1e-4)


def test_deal_builder_explicit_purchase_price_overrides_premium(client: TestClient):
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "purchase_equity_value": 600000.0,
        "acquisition_premium": 0.20,
        "cash_pct": 1.0,
        "debt_pct": 0.0,
        "stock_pct": 0.0,
    }
    response = client.post("/api/v1/deals", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["transaction"]["purchase_equity_value"] == 600000.0
    # Implied premium should be recalculated from 600,000 Cr
    assert any("explicit purchase_equity_value" in w for w in data["warnings"])


def test_deal_builder_invalid_financing_mix_sum_rejected(client: TestClient):
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "cash_pct": 0.50,
        "debt_pct": 0.30,
        "stock_pct": 0.10,  # Sum = 0.90 != 1.0
    }
    response = client.post("/api/v1/deals", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "VALIDATION_ERROR"
    assert "Financing mix must sum to 1.0" in response.text


def test_deal_builder_unknown_company_raises_404(client: TestClient):
    payload = {
        "buyer_id": "NonExistentBuyer",
        "target_id": "Infosys",
        "cash_pct": 1.0,
        "debt_pct": 0.0,
        "stock_pct": 0.0,
    }
    response = client.post("/api/v1/deals", json=payload)
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "RESOURCE_NOT_FOUND"


# ===========================================================================
# 2. Sources & Uses API Tests
# ===========================================================================

def test_sources_uses_feasible_balanced_structure(client: TestClient):
    """
    Feasible TCS -> Infosys scenario:
    2% cash of ~540k Cr net funding is ~10,908 Cr <= TCS cash balance (~12,908 Cr).
    """
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "acquisition_premium": 0.20,
        "cash_pct": 0.02,
        "debt_pct": 0.60,
        "stock_pct": 0.38,
        "transaction_fees": 500.0,
        "refinance_target_debt": True,
        "use_target_cash": True,
        "debt_issuance_fee_pct": 0.02,
        "minimum_cash_balance": 1000.0,
    }
    response = client.post("/api/v1/deals/sources-uses", json=payload)
    assert response.status_code == 200
    data = response.json()

    rec = data["reconciliation"]
    assert rec["is_feasible"] is True
    assert rec["sources_uses_balanced"] is True
    assert abs(rec["difference"]) < 1e-4
    assert rec["status"] == "BALANCED & EXECUTABLE"
    assert rec["funding_shortfall"] == 0.0

    # Uses breakdown
    u = data["uses"]
    assert u["target_debt_refinancing"] == 9176.0
    assert u["transaction_fees"] == 500.0
    assert u["debt_issuance_fees"] > 0
    assert u["total_uses"] == data["sources"]["total_sources"]

    # Sources breakdown
    s = data["sources"]
    assert s["target_cash_sweep"] == 22201.0
    assert s["acquirer_cash"] == pytest.approx(10908.0, abs=1.0)
    assert s["new_debt"] == pytest.approx(327240.5, abs=1.0)
    assert s["stock_issuance"] == pytest.approx(207252.3, abs=1.0)

    # Cash reconciliation
    crec = data["cash_reconciliation"]
    assert crec["is_cash_funded"] is True
    assert crec["pro_forma_acquirer_cash"] >= 1000.0


def test_sources_uses_infeasible_cash_shortfall_preserved(client: TestClient):
    """
    Infeasible TCS -> Infosys scenario:
    50% cash requires ~270,000 Cr cash, which far exceeds TCS cash (~12,908 Cr).
    Must return 200 OK with is_feasible=False and INFEASIBLE status.
    """
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "acquisition_premium": 0.20,
        "cash_pct": 0.50,
        "debt_pct": 0.30,
        "stock_pct": 0.20,
        "transaction_fees": 500.0,
        "refinance_target_debt": True,
        "use_target_cash": True,
        "debt_issuance_fee_pct": 0.02,
    }
    response = client.post("/api/v1/deals/sources-uses", json=payload)
    assert response.status_code == 200
    data = response.json()

    rec = data["reconciliation"]
    assert rec["is_feasible"] is False
    assert rec["status"] == "INFEASIBLE: CASH SHORTFALL"
    assert rec["funding_shortfall"] > 200000.0

    # Requested cash != executable cash
    assert data["requested_financing"]["acquirer_cash"] > 200000.0
    assert data["sources"]["acquirer_cash"] <= 12908.0  # Capped at available cash

    # Cash reconciliation reports deficit
    crec = data["cash_reconciliation"]
    assert crec["is_cash_funded"] is False
    assert crec["cash_deficit"] > 0
    assert crec["pro_forma_acquirer_cash"] == 0.0


def test_sources_uses_target_debt_refinance_false(client: TestClient):
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "cash_pct": 0.02,
        "debt_pct": 0.60,
        "stock_pct": 0.38,
        "refinance_target_debt": False,
    }
    response = client.post("/api/v1/deals/sources-uses", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["uses"]["target_debt_refinancing"] == 0.0


def test_sources_uses_unknown_company_raises_404(client: TestClient):
    payload = {
        "buyer_id": "TCS",
        "target_id": "NonExistentTarget",
        "cash_pct": 1.0,
        "debt_pct": 0.0,
        "stock_pct": 0.0,
    }
    response = client.post("/api/v1/deals/sources-uses", json=payload)
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "RESOURCE_NOT_FOUND"


# ===========================================================================
# 3. Accretion / Dilution API Tests
# ===========================================================================

def test_accretion_dilution_exact_phase7_8_validated_scenario(client: TestClient):
    """
    CRITICAL REGRESSION TEST (Sections 13 & 20):
    TCS -> Infosys with:
    - refinance_target_debt = True
    - use_target_cash = True
    - debt_issuance_fee = 2%
    - minimum_cash = 1000
    - cash = 2%
    - debt = 60%
    - stock = 38%
    - transaction_fees = 500
    - expected_annual_synergies = 2000
    """
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "acquisition_premium": 0.20,
        "cash_pct": 0.02,
        "debt_pct": 0.60,
        "stock_pct": 0.38,
        "transaction_fees": 500.0,
        "refinance_target_debt": True,
        "use_target_cash": True,
        "debt_issuance_fee_pct": 0.02,
        "minimum_cash_balance": 1000.0,
        "expected_annual_synergies": 2000.0,
        "debt_interest_rate": 0.08,
        "foregone_cash_interest_rate": 0.05,
        "tax_rate": 0.25,
    }
    response = client.post("/api/v1/deals/accretion-dilution", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_available"] is True
    assert data["is_feasible"] is True

    # Standalone EPS
    assert abs(data["standalone"]["buyer_eps"] - 136.01) < 0.1
    assert abs(data["standalone"]["target_eps"] - 72.75) < 0.1

    # Financing execution values
    fin = data["financing"]
    assert fin["buyer_cash_used"] == pytest.approx(10908.0, abs=1.0)
    assert fin["new_debt"] == pytest.approx(327240.5, abs=1.0)
    assert fin["stock_consideration_value"] == pytest.approx(207252.3, abs=1.0)
    assert fin["is_feasible"] is True

    # Pro-forma multi-year projections
    years = data["pro_forma"]["years"]

    # Year 1: EPS ≈ 129.28, A/D ≈ -4.95%
    y1 = years["year_1"]
    assert abs(y1["pro_forma_eps"] - 129.28) < 0.05
    assert abs(y1["accretion_dilution_pct"] - (-4.95)) < 0.05
    assert y1["status"] == "DILUTIVE"

    # Year 2: EPS ≈ 130.40, A/D ≈ -4.13%
    y2 = years["year_2"]
    assert abs(y2["pro_forma_eps"] - 130.40) < 0.05
    assert abs(y2["accretion_dilution_pct"] - (-4.13)) < 0.05
    assert y2["status"] == "DILUTIVE"

    # Year 3: EPS ≈ 131.48, A/D ≈ -3.33%
    y3 = years["year_3"]
    assert abs(y3["pro_forma_eps"] - 131.48) < 0.05
    assert abs(y3["accretion_dilution_pct"] - (-3.33)) < 0.05
    assert y3["status"] == "DILUTIVE"

    # Break-even synergy: ≈ 4,762.0 Cr
    be1 = data["break_even"]["year_1"]
    assert abs(be1["break_even_gross_synergy"] - 4762.0) < 2.0
    assert be1["synergies_required"] is True


def test_accretion_dilution_default_infeasible_labeled_illustrative(client: TestClient):
    """
    Default 50/30/20 mix requires ~270,000 Cr cash which TCS does not have.
    Must be marked is_feasible=False and status 'NON-EXECUTABLE / ILLUSTRATIVE'.
    """
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "cash_pct": 0.50,
        "debt_pct": 0.30,
        "stock_pct": 0.20,
    }
    response = client.post("/api/v1/deals/accretion-dilution", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_feasible"] is False
    y1 = data["pro_forma"]["years"]["year_1"]
    assert y1["status"] == "NON-EXECUTABLE / ILLUSTRATIVE"
    assert y1["modelled_status"] in ("ACCRETIVE", "DILUTIVE", "NEUTRAL")
    assert any("Requested / Illustrative Structure" in d for d in data["diagnostics"])


def test_accretion_dilution_rate_sensitivities(client: TestClient):
    """Higher debt interest rate must produce higher interest expense and lower EPS."""
    base_payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "cash_pct": 0.02,
        "debt_pct": 0.60,
        "stock_pct": 0.38,
        "debt_interest_rate": 0.08,
    }
    resp_base = client.post("/api/v1/deals/accretion-dilution", json=base_payload)
    assert resp_base.status_code == 200
    eps_base = resp_base.json()["pro_forma"]["years"]["year_1"]["pro_forma_eps"]

    higher_rate_payload = {**base_payload, "debt_interest_rate": 0.12}
    resp_higher = client.post("/api/v1/deals/accretion-dilution", json=higher_rate_payload)
    assert resp_higher.status_code == 200
    eps_higher = resp_higher.json()["pro_forma"]["years"]["year_1"]["pro_forma_eps"]

    assert eps_higher < eps_base


def test_accretion_dilution_synergy_overrides(client: TestClient):
    """Direct synergy overrides for Year 1, 2, 3 should take effect."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "cash_pct": 0.02,
        "debt_pct": 0.60,
        "stock_pct": 0.38,
        "synergy_year_1": 1500.0,
        "synergy_year_2": 3000.0,
        "synergy_year_3": 5000.0,
    }
    response = client.post("/api/v1/deals/accretion-dilution", json=payload)
    assert response.status_code == 200
    data = response.json()
    syn = data["synergies"]
    assert syn["gross_year_1"] == 1500.0
    assert syn["gross_year_2"] == 3000.0
    assert syn["gross_year_3"] == 5000.0


def test_accretion_dilution_unknown_company_raises_404(client: TestClient):
    payload = {
        "buyer_id": "TCS",
        "target_id": "NonExistentCompany",
        "cash_pct": 0.50,
        "debt_pct": 0.30,
        "stock_pct": 0.20,
    }
    response = client.post("/api/v1/deals/accretion-dilution", json=payload)
    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "RESOURCE_NOT_FOUND"
