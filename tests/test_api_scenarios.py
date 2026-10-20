"""
tests/test_api_scenarios.py

Tests for Stage 1D Scenario Analysis & Sensitivity Analysis API endpoints:
- POST /api/v1/deals/scenarios
- POST /api/v1/deals/sensitivity/1d
- POST /api/v1/deals/sensitivity/2d
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


TCS_BASE_PAYLOAD = {
    "acquisition_premium": 0.20,
    "cash_pct": 0.02,
    "debt_pct": 0.60,
    "stock_pct": 0.38,
    "transaction_fees": 500.0,
    "debt_issuance_fee_pct": 0.02,
    "minimum_cash_balance": 1000.0,
    "refinance_target_debt": True,
    "use_target_cash": True,
    "debt_interest_rate": 0.08,
    "foregone_cash_interest_rate": 0.05,
    "tax_rate": 0.25,
    "expected_annual_synergies": 2000.0,
}


# ===========================================================================
# 1. Scenario Analysis API Tests
# ===========================================================================

def test_api_scenarios_comparison_tcs_infosys(client: TestClient):
    """Test evaluating Base, Upside, and Downside scenarios through API."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "scenarios": [
            {
                "name": "Base Case",
                "scenario_type": "BASE",
                "description": "Base regression case",
                "overrides": {},
            },
            {
                "name": "Downside",
                "scenario_type": "DOWNSIDE",
                "description": "Higher premium",
                "overrides": {"acquisition_premium": 0.30},
            },
            {
                "name": "Upside",
                "scenario_type": "UPSIDE",
                "description": "Lower premium",
                "overrides": {"acquisition_premium": 0.10},
            },
        ],
    }
    response = client.post("/api/v1/deals/scenarios", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["acquirer_id"] == "TCS"
    assert data["target_id"] == "Infosys"
    assert data["scenario_count"] == 3
    assert len(data["scenarios"]) == 3

    # Base scenario verification (canonical regression outputs)
    base = data["scenarios"][0]
    assert base["identity"]["name"] == "Base Case"
    assert base["identity"]["scenario_type"] == "BASE"
    assert base["diagnostics"]["is_feasible"] is True

    # S&U outputs
    su = base["sources_uses"]
    assert su["total_uses"] == pytest.approx(567601.87, abs=5.0)
    assert su["total_sources"] == pytest.approx(567601.87, abs=5.0)
    assert su["buyer_cash"] == pytest.approx(10908.0, abs=5.0)
    assert su["new_debt"] == pytest.approx(327240.5, abs=5.0)
    assert su["stock_issuance"] == pytest.approx(207252.3, abs=5.0)

    # A/D outputs
    ad = base["accretion_dilution"]
    assert ad["year_1"]["eps"] == pytest.approx(129.28, abs=0.5)
    assert ad["year_1"]["accretion_dilution_pct"] == pytest.approx(-4.95, abs=0.5)
    assert ad["year_2"]["eps"] == pytest.approx(130.40, abs=0.5)
    assert ad["year_2"]["accretion_dilution_pct"] == pytest.approx(-4.13, abs=0.5)
    assert ad["year_3"]["eps"] == pytest.approx(131.48, abs=0.5)
    assert ad["year_3"]["accretion_dilution_pct"] == pytest.approx(-3.33, abs=0.5)
    assert ad["year_1"]["break_even_gross_synergy"] == pytest.approx(4762.0, abs=5.0)

    # Downside (higher premium) is more dilutive
    down = data["scenarios"][1]
    assert down["accretion_dilution"]["year_1"]["accretion_dilution_pct"] < base["accretion_dilution"]["year_1"]["accretion_dilution_pct"]

    # Upside (lower premium) is less dilutive
    up = data["scenarios"][2]
    assert up["accretion_dilution"]["year_1"]["accretion_dilution_pct"] > base["accretion_dilution"]["year_1"]["accretion_dilution_pct"]


def test_api_scenarios_custom_scenario_propagation(client: TestClient):
    """Test that custom scenario with 25% premium propagates through all layers."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "scenarios": [
            {
                "name": "Base Case",
                "scenario_type": "BASE",
                "overrides": {},
            },
            {
                "name": "Custom 25%",
                "scenario_type": "CUSTOM",
                "overrides": {"acquisition_premium": 0.25},
            },
        ],
    }
    response = client.post("/api/v1/deals/scenarios", json=payload)
    assert response.status_code == 200
    data = response.json()

    base = data["scenarios"][0]
    custom = data["scenarios"][1]

    # Purchase equity value should increase with premium
    assert custom["deal"]["purchase_equity_value"] > base["deal"]["purchase_equity_value"]
    # Transaction EV increases
    assert custom["deal"]["transaction_enterprise_value"] > base["deal"]["transaction_enterprise_value"]
    # Debt funding increases
    assert custom["sources_uses"]["new_debt"] > base["sources_uses"]["new_debt"]
    # Year 1 A/D is more dilutive
    assert custom["accretion_dilution"]["year_1"]["accretion_dilution_pct"] < base["accretion_dilution"]["year_1"]["accretion_dilution_pct"]


def test_api_scenarios_infeasible_structure_handled(client: TestClient):
    """Test that an infeasible financing scenario reports is_feasible=False in diagnostics."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "scenarios": [
            {
                "name": "Cash-Heavy Infeasible",
                "scenario_type": "CUSTOM",
                "overrides": {
                    "cash_pct": 0.98,
                    "debt_pct": 0.01,
                    "stock_pct": 0.01,
                },
            },
        ],
    }
    response = client.post("/api/v1/deals/scenarios", json=payload)
    assert response.status_code == 200
    data = response.json()

    scenario = data["scenarios"][0]
    assert scenario["diagnostics"]["is_feasible"] is False
    assert scenario["sources_uses"]["is_feasible"] is False
    assert len(scenario["diagnostics"]["warnings"]) > 0


def test_api_scenarios_unknown_company_returns_404(client: TestClient):
    """Test that non-existent company returns 404."""
    payload = {
        "buyer_id": "NON_EXISTENT_COMPANY_XYZ",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "scenarios": [
            {"name": "Base", "scenario_type": "BASE", "overrides": {}},
        ],
    }
    response = client.post("/api/v1/deals/scenarios", json=payload)
    assert response.status_code == 404


def test_api_scenarios_empty_scenarios_rejected(client: TestClient):
    """Test that empty scenarios list returns 422 validation error."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "scenarios": [],
    }
    response = client.post("/api/v1/deals/scenarios", json=payload)
    assert response.status_code == 422


# ===========================================================================
# 2. 1D Sensitivity API Tests
# ===========================================================================

def test_api_sensitivity_1d_premium_regression(client: TestClient):
    """Test 1D sensitivity across premium values for Year 1 A/D%."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "axis": {
            "variable": "acquisition_premium",
            "values": [0.20, 0.25, 0.30],
        },
        "output_metric": "year_1_ad_pct",
    }
    response = client.post("/api/v1/deals/sensitivity/1d", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["variable"] == "acquisition_premium"
    assert data["output_metric"] == "year_1_ad_pct"
    assert len(data["cells"]) == 3

    # Cell 0 (premium=0.20) matches base regression ≈ -4.95%
    c0 = data["cells"][0]
    assert c0["value"] == 0.20
    assert c0["output"] == pytest.approx(-4.95, abs=0.5)
    assert c0["is_feasible"] is True

    # Monotonically decreasing A/D%
    c1 = data["cells"][1]
    c2 = data["cells"][2]
    assert c0["output"] > c1["output"] > c2["output"]


def test_api_sensitivity_1d_invalid_variable_rejected(client: TestClient):
    """Test that invalid sensitivity variable returns 400."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "axis": {
            "variable": "invalid_var_xyz",
            "values": [0.1, 0.2],
        },
        "output_metric": "year_1_ad_pct",
    }
    response = client.post("/api/v1/deals/sensitivity/1d", json=payload)
    assert response.status_code == 400


def test_api_sensitivity_1d_invalid_metric_rejected(client: TestClient):
    """Test that invalid output metric returns 400."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "axis": {
            "variable": "acquisition_premium",
            "values": [0.1, 0.2],
        },
        "output_metric": "non_existent_metric",
    }
    response = client.post("/api/v1/deals/sensitivity/1d", json=payload)
    assert response.status_code == 400


def test_api_sensitivity_1d_infeasible_cell_preservation(client: TestClient):
    """Test that infeasible cells in 1D sensitivity return output=null, feasible=false."""
    cash_heavy = dict(TCS_BASE_PAYLOAD)
    cash_heavy["cash_pct"] = 0.98
    cash_heavy["debt_pct"] = 0.01
    cash_heavy["stock_pct"] = 0.01

    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": cash_heavy,
        "axis": {
            "variable": "acquisition_premium",
            "values": [0.20],
        },
        "output_metric": "year_1_ad_pct",
    }
    response = client.post("/api/v1/deals/sensitivity/1d", json=payload)
    assert response.status_code == 200
    data = response.json()

    cell = data["cells"][0]
    assert cell["is_feasible"] is False
    assert cell["output"] is None
    assert len(cell["diagnostics"]) > 0


# ===========================================================================
# 3. 2D Sensitivity Matrix API Tests
# ===========================================================================

def test_api_sensitivity_2d_matrix(client: TestClient):
    """Test 2D sensitivity matrix across premium (X) and synergies (Y)."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "x_axis": {
            "variable": "acquisition_premium",
            "values": [0.15, 0.20, 0.25],
        },
        "y_axis": {
            "variable": "synergy_year_1",
            "values": [500.0, 1000.0],
        },
        "output_metric": "year_1_eps",
    }
    response = client.post("/api/v1/deals/sensitivity/2d", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["dimensions"]["rows"] == 2
    assert data["dimensions"]["columns"] == 3
    assert data["dimensions"]["total_cells"] == 6

    matrix = data["matrix"]
    assert len(matrix) == 2
    for row in matrix:
        assert len(row) == 3
        for cell in row:
            assert cell["is_feasible"] is True
            assert isinstance(cell["output"], float)


def test_api_sensitivity_2d_same_variable_rejected(client: TestClient):
    """Test that using same variable for X and Y returns 400."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "x_axis": {
            "variable": "acquisition_premium",
            "values": [0.15, 0.20],
        },
        "y_axis": {
            "variable": "acquisition_premium",
            "values": [0.15, 0.20],
        },
        "output_metric": "year_1_eps",
    }
    response = client.post("/api/v1/deals/sensitivity/2d", json=payload)
    assert response.status_code == 400


def test_api_sensitivity_2d_infeasible_cells_preserved(client: TestClient):
    """Test that infeasible cells in 2D sensitivity have output=null and is_feasible=False."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "x_axis": {
            "variable": "cash_pct",
            "values": [0.02],
        },
        "y_axis": {
            "variable": "debt_pct",
            "values": [0.60, 0.80],
        },
        "output_metric": "year_1_ad_pct",
    }
    response = client.post("/api/v1/deals/sensitivity/2d", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Row 0: debt=0.60, cash=0.02, stock=0.38 -> feasible
    assert data["matrix"][0][0]["is_feasible"] is True
    assert data["matrix"][0][0]["output"] is not None

    # Row 1: debt=0.80, cash=0.02, stock=0.38 -> infeasible
    assert data["matrix"][1][0]["is_feasible"] is False
    assert data["matrix"][1][0]["output"] is None
    assert len(data["matrix"][1][0]["diagnostics"]) > 0


# ===========================================================================
# 4. Single Scenario and Compare Alias API Tests
# ===========================================================================

def test_api_single_scenario_tcs_infosys(client: TestClient):
    """Test executing a single scenario via POST /api/v1/deals/scenario."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "scenario": {
            "name": "Base Executable",
            "scenario_type": "BASE",
            "description": "Single scenario regression",
            "overrides": {},
        },
    }
    response = client.post("/api/v1/deals/scenario", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["identity"]["name"] == "Base Executable"
    assert data["identity"]["scenario_type"] == "BASE"
    assert data["diagnostics"]["is_feasible"] is True

    # Check S&U
    su = data["sources_uses"]
    assert su["total_uses"] == pytest.approx(567601.87, abs=5.0)
    assert su["total_sources"] == pytest.approx(567601.87, abs=5.0)
    assert su["buyer_cash"] == pytest.approx(10908.0, abs=5.0)
    assert su["new_debt"] == pytest.approx(327240.5, abs=5.0)
    assert su["stock_issuance"] == pytest.approx(207252.3, abs=5.0)

    # Check A/D
    ad = data["accretion_dilution"]
    assert ad["year_1"]["eps"] == pytest.approx(129.28, abs=0.5)
    assert ad["year_1"]["accretion_dilution_pct"] == pytest.approx(-4.95, abs=0.5)


def test_api_scenarios_compare_alias(client: TestClient):
    """Test POST /api/v1/deals/scenarios/compare alias endpoint."""
    payload = {
        "buyer_id": "TCS",
        "target_id": "Infosys",
        "base_assumptions": TCS_BASE_PAYLOAD,
        "scenarios": [
            {"name": "Base", "scenario_type": "BASE", "overrides": {}},
        ],
    }
    response = client.post("/api/v1/deals/scenarios/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_count"] == 1
    assert data["scenarios"][0]["identity"]["name"] == "Base"


# ===========================================================================
# 5. OpenAPI Specification Validation
# ===========================================================================

def test_openapi_schema_contains_stage_1d_endpoints(client: TestClient):
    """Verify that OpenAPI schema contains all Stage 1D scenario endpoints."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()

    paths = schema.get("paths", {})
    assert "/api/v1/deals/scenario" in paths
    assert "/api/v1/deals/scenarios" in paths
    assert "/api/v1/deals/scenarios/compare" in paths
    assert "/api/v1/deals/sensitivity/1d" in paths
    assert "/api/v1/deals/sensitivity/2d" in paths
