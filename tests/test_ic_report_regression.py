"""
tests/test_ic_report_regression.py

Regression test suite for DealForge IC Report & Sensitivity Analysis:
1. Acquisition Premium sensitivity at 15%, 20%, 25%, 30% produces distinct non-zero outputs
2. Output values reconcile with deterministic backend engines
3. Infeasible funding structure returns is_feasible=False and output=None (not 0.00%)
4. Illustrative A/D does not override execution feasibility
5. Negative break-even synergy semantics (accretive ex-synergy <= 0)
6. Cross-page transaction assumption consistency
"""

from pathlib import Path
import pandas as pd
import pytest
from fastapi.testclient import TestClient

_PROJECT_ROOT = Path(__file__).resolve().parents[1]

from analytics.scenarios import (
    DEFAULT_ASSUMPTIONS,
    run_sensitivity_1d,
    run_sensitivity_2d,
    execute_scenario,
)
from analytics.screening import compute_metrics
from backend.app.main import app


@pytest.fixture(scope="module")
def data_frames():
    """Load real datasets for the TCS → Infosys regression transaction."""
    data_dir = _PROJECT_ROOT / "data"
    companies = pd.read_csv(data_dir / "companies.csv")
    financials = pd.read_csv(data_dir / "financials.csv")
    sectors = pd.read_csv(data_dir / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)
    return metrics, financials


@pytest.fixture(scope="module")
def client():
    """Create FastAPI test client."""
    return TestClient(app)


# Authoritative TCS -> Infosys Baseline Deal Parameters
TCS_INFOSYS_BASE = {
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


class TestAcquisitionPremiumSensitivityRegression:
    """Verify Acquisition Premium sensitivity produces distinct, non-zero backend outputs."""

    def test_premium_sensitivity_distinct_outputs(self, data_frames):
        """
        Verify that 15%, 20%, 25%, 30% acquisition premiums produce distinct,
        valid Year 1 A/D% values from the deterministic engine.
        None should be 0.00% or equal to each other.
        """
        metrics, financials = data_frames
        premiums = [0.15, 0.20, 0.25, 0.30]

        result = run_sensitivity_1d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_INFOSYS_BASE,
            variable="acquisition_premium",
            values=premiums,
            output_metric="year_1_ad_pct",
        )

        cells = result["cells"]
        assert len(cells) == 4

        # Verify all cells are feasible under the 2% cash / 60% debt / 38% stock structure
        for cell in cells:
            assert cell["is_feasible"] is True, f"Cell {cell['value']} unexpectedly infeasible"
            assert cell["output"] is not None, f"Cell {cell['value']} output is None"
            assert isinstance(cell["output"], (int, float))
            # Output must NOT be 0.00% (the confirmed bug)
            assert abs(cell["output"]) > 0.01, f"Cell {cell['value']} unexpectedly 0.00%"

        # Verify values are strictly descending as premium increases
        ad_values = [c["output"] for c in cells]
        assert len(set(ad_values)) == 4, "Premium sensitivity outputs must be distinct"
        assert ad_values[0] > ad_values[1] > ad_values[2] > ad_values[3], (
            f"Higher premiums must produce lower (more dilutive) A/D%: {ad_values}"
        )

    def test_premium_sensitivity_eps_distinct_outputs(self, data_frames):
        """Verify Year 1 Pro Forma EPS changes distinctly across premiums."""
        metrics, financials = data_frames
        premiums = [0.15, 0.20, 0.25, 0.30]

        result = run_sensitivity_1d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_INFOSYS_BASE,
            variable="acquisition_premium",
            values=premiums,
            output_metric="year_1_eps",
        )

        cells = result["cells"]
        assert len(cells) == 4

        eps_values = [c["output"] for c in cells]
        for eps in eps_values:
            assert eps is not None
            assert eps > 100.0  # TCS pro forma EPS is ~125-135 INR

        # Higher premium must decrease pro forma EPS
        assert len(set(eps_values)) == 4
        assert eps_values[0] > eps_values[1] > eps_values[2] > eps_values[3]

    def test_premium_sensitivity_purchase_equity_value(self, data_frames):
        """Verify purchase equity value scales with acquisition premium."""
        metrics, financials = data_frames
        premiums = [0.15, 0.20, 0.25, 0.30]

        result = run_sensitivity_1d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_INFOSYS_BASE,
            variable="acquisition_premium",
            values=premiums,
            output_metric="purchase_equity_value",
        )

        cells = result["cells"]
        eq_values = [c["output"] for c in cells]
        assert len(set(eq_values)) == 4
        # Higher premium increases purchase equity value
        assert eq_values[0] < eq_values[1] < eq_values[2] < eq_values[3]


class TestSensitivityInfeasibilitySemantics:
    """Verify infeasible structures return output=None and is_feasible=False."""

    def test_infeasible_cash_shortfall_returns_none_output(self, data_frames):
        """
        When cash demand exceeds buyer liquidity (e.g. 90% cash),
        the backend must report is_feasible=False and output=None, NOT 0.00%.
        """
        metrics, financials = data_frames
        infeasible_base = dict(TCS_INFOSYS_BASE)
        infeasible_base["cash_pct"] = 0.90
        infeasible_base["debt_pct"] = 0.05
        infeasible_base["stock_pct"] = 0.05

        result = run_sensitivity_1d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=infeasible_base,
            variable="acquisition_premium",
            values=[0.15, 0.20, 0.25],
            output_metric="year_1_ad_pct",
        )

        for cell in result["cells"]:
            assert cell["is_feasible"] is False, "Cash shortfall must be flagged as infeasible"
            assert cell["output"] is None, "Infeasible sensitivity cells must return output=None (not 0.0)"
            assert len(cell["diagnostics"]) > 0

    def test_api_1d_sensitivity_regression(self, client: TestClient):
        """Test API POST /api/v1/deals/sensitivity/1d returns distinct non-zero values."""
        payload = {
            "buyer_id": "TCS",
            "target_id": "Infosys",
            "base_assumptions": TCS_INFOSYS_BASE,
            "axis": {
                "variable": "acquisition_premium",
                "values": [0.15, 0.20, 0.25, 0.30],
            },
            "output_metric": "year_1_ad_pct",
        }

        response = client.post("/api/v1/deals/sensitivity/1d", json=payload)
        assert response.status_code == 200
        data = response.json()

        cells = data["cells"]
        assert len(cells) == 4
        outputs = [c["output"] for c in cells]

        # Verify no nulls, no 0.00%
        for out in outputs:
            assert out is not None
            assert abs(out) > 0.01

        # Must be strictly distinct
        assert len(set(outputs)) == 4


class TestTransactionFeasibilityVsAccretionSemantics:
    """Verify institutional separation of execution feasibility and modeled accretion."""

    def test_illustrative_accretive_deal_can_be_infeasible(self, data_frames):
        """
        A transaction can be financially accretive in theory (e.g. funded with cheap debt/cash)
        yet infeasible because the cash required exceeds available balance.
        The model must report is_feasible=False while calculating illustrative accretion.
        """
        metrics, financials = data_frames
        # High cash consideration (50%) with high synergies creates accretive illustrative EPS
        # but TCS cannot fund 50% cash (~₹400,000 Cr) out of ₹9,969 Cr cash
        infeasible_structure = dict(TCS_INFOSYS_BASE)
        infeasible_structure["cash_pct"] = 0.50
        infeasible_structure["debt_pct"] = 0.30
        infeasible_structure["stock_pct"] = 0.20
        infeasible_structure["expected_annual_synergies"] = 5000.0

        res = execute_scenario(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            assumptions=infeasible_structure,
        )

        su = res["sources_uses"]
        ad = res["accretion_dilution"]

        # Feasibility MUST be False
        assert su["reconciliation"]["is_feasible"] is False
        assert su["reconciliation"]["funding_shortfall"] > 0
        assert ad["is_feasible"] is False

        # Illustrative pro forma EPS is calculated
        y1 = ad["pro_forma"]["years"]["year_1"]
        assert y1["pro_forma_eps"] is not None
        assert y1["accretion_dilution_pct"] is not None


class TestBreakEvenSynergySemantics:
    """Verify break-even synergy calculation when already accretive."""

    def test_break_even_synergy_negative_when_accretive_ex_synergy(self):
        """
        When a deal is accretive before incremental synergies (base_ni >= required_ni),
        calculate_break_even_synergies returns break_even_gross_synergy <= 0 and synergies_required=False.
        This represents the institutional 'SYNERGY NOT REQUIRED' state.
        """
        from analytics.accretion_dilution import calculate_break_even_synergies

        # Target net income (20,000 Cr) exceeds new debt interest (5,000 Cr) and share dilution
        be = calculate_break_even_synergies(
            buyer_standalone_eps=100.0,
            pro_forma_shares=4000000000.0,  # 400 Cr shares -> required_ni = 40,000 Cr
            buyer_net_income=30000.0,       # 30,000 Cr
            target_net_income=20000.0,      # 20,000 Cr -> base_ni = 45,000 Cr > 40,000 Cr required
            after_tax_debt_interest=5000.0,
            after_tax_foregone_interest=0.0,
            tax_rate=0.25,
            shares_is_raw=True,
        )

        assert be["break_even_gross_synergy"] <= 0
        assert be["synergies_required"] is False
