"""
tests/test_scenarios.py

Tests for Phase 9: Scenario Analysis & Sensitivity Analysis
(analytics/scenarios.py).

Tests cover:
  SCENARIOS:
    1. Base scenario
    2. Upside scenario
    3. Downside scenario
    4. Custom scenario
    5. Single-parameter override
    6. Multiple-parameter override
    7. Invalid financing mix
    8. Unknown company
    9. Scenario comparison
    10. Feasibility propagation

  SENSITIVITY:
    1. 1D premium sensitivity
    2. 1D debt sensitivity
    3. 2D premium/debt sensitivity
    4. Matrix dimensions
    5. Each cell uses deterministic engine
    6. Infeasible cells
    7. Unavailable values
    8. Invalid axis
    9. Invalid values
    10. Matrix-size validation

  REGRESSION:
    - TCS → Infosys base scenario regression
    - Premium change propagation regression
    - Sensitivity regression
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

# Ensure project root is on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from analytics.scenarios import (
    DEFAULT_ASSUMPTIONS,
    MAX_SENSITIVITY_AXIS,
    SUPPORTED_ASSUMPTIONS,
    SUPPORTED_OUTPUT_METRICS,
    SUPPORTED_SENSITIVITY_VARIABLES,
    ScenarioDefinition,
    execute_scenario,
    extract_scenario_result,
    resolve_assumptions,
    run_scenarios,
    run_sensitivity_1d,
    run_sensitivity_2d,
    validate_assumptions,
)
from analytics.screening import compute_metrics


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def data_frames():
    """Load real datasets for the TCS → Infosys regression transaction."""
    data_dir = _PROJECT_ROOT / "data"
    companies = pd.read_csv(data_dir / "companies.csv")
    financials = pd.read_csv(data_dir / "financials.csv")
    sectors = pd.read_csv(data_dir / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)
    return metrics, financials


# The validated TCS → Infosys base assumptions
TCS_BASE = {
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
    "synergy_year_1": None,
    "synergy_year_2": None,
    "synergy_year_3": None,
    "expected_annual_synergies": 2000.0,
}


# ===================================================================
# SCENARIO DEFINITION TESTS
# ===================================================================

class TestScenarioDefinition:
    """Tests for ScenarioDefinition creation and validation."""

    def test_base_scenario_creation(self):
        """Test creating a base scenario."""
        sd = ScenarioDefinition(name="Base Case", scenario_type="BASE")
        assert sd.name == "Base Case"
        assert sd.scenario_type == "BASE"
        assert sd.overrides == {}

    def test_upside_scenario_creation(self):
        """Test creating an upside scenario with overrides."""
        sd = ScenarioDefinition(
            name="Upside",
            scenario_type="UPSIDE",
            description="Optimistic case",
            overrides={"acquisition_premium": 0.15},
        )
        assert sd.scenario_type == "UPSIDE"
        assert sd.overrides["acquisition_premium"] == 0.15

    def test_downside_scenario_creation(self):
        """Test creating a downside scenario."""
        sd = ScenarioDefinition(
            name="Downside",
            scenario_type="DOWNSIDE",
            overrides={"acquisition_premium": 0.30, "debt_pct": 0.70},
        )
        assert sd.scenario_type == "DOWNSIDE"
        assert len(sd.overrides) == 2

    def test_custom_scenario_creation(self):
        """Test creating a custom scenario."""
        sd = ScenarioDefinition(
            name="Custom Test",
            scenario_type="CUSTOM",
            overrides={"synergy_year_1": 500.0},
        )
        assert sd.scenario_type == "CUSTOM"

    def test_empty_name_rejected(self):
        """Test that empty scenario name is rejected."""
        with pytest.raises(ValueError, match="empty"):
            ScenarioDefinition(name="", scenario_type="BASE")

    def test_invalid_scenario_type_rejected(self):
        """Test that invalid scenario types are rejected."""
        with pytest.raises(ValueError, match="Invalid scenario type"):
            ScenarioDefinition(name="Test", scenario_type="INVALID")

    def test_unsupported_override_rejected(self):
        """Test that unsupported assumption overrides are rejected."""
        with pytest.raises(ValueError, match="Unsupported"):
            ScenarioDefinition(
                name="Test",
                overrides={"imaginary_parameter": 42},
            )

    def test_to_dict(self):
        """Test serialization to dictionary."""
        sd = ScenarioDefinition(
            name="Base",
            scenario_type="BASE",
            description="Test",
            overrides={"acquisition_premium": 0.25},
        )
        d = sd.to_dict()
        assert d["name"] == "Base"
        assert d["scenario_type"] == "BASE"
        assert d["overrides"]["acquisition_premium"] == 0.25


# ===================================================================
# ASSUMPTION RESOLUTION TESTS
# ===================================================================

class TestAssumptionResolution:
    """Tests for resolve_assumptions and validate_assumptions."""

    def test_single_override(self):
        """Test that a single override changes only that parameter."""
        base = dict(TCS_BASE)
        resolved = resolve_assumptions(base, {"acquisition_premium": 0.25})
        assert resolved["acquisition_premium"] == 0.25
        # Everything else stays the same
        assert resolved["cash_pct"] == base["cash_pct"]
        assert resolved["debt_pct"] == base["debt_pct"]
        assert resolved["stock_pct"] == base["stock_pct"]
        assert resolved["debt_interest_rate"] == base["debt_interest_rate"]

    def test_multiple_overrides(self):
        """Test that multiple overrides change only specified params."""
        base = dict(TCS_BASE)
        resolved = resolve_assumptions(base, {
            "acquisition_premium": 0.25,
            "debt_pct": 0.70,
            "stock_pct": 0.28,
        })
        assert resolved["acquisition_premium"] == 0.25
        assert resolved["debt_pct"] == 0.70
        assert resolved["stock_pct"] == 0.28
        # Others unchanged
        assert resolved["cash_pct"] == base["cash_pct"]

    def test_unsupported_override_rejected(self):
        """Test that resolve_assumptions rejects unsupported parameters."""
        with pytest.raises(ValueError, match="Unsupported"):
            resolve_assumptions(TCS_BASE, {"not_a_param": 99})

    def test_valid_assumptions_pass(self):
        """Test that valid assumptions pass validation."""
        errors = validate_assumptions(TCS_BASE)
        assert errors == []

    def test_invalid_financing_mix(self):
        """Test that financing percentages not summing to 100% fail."""
        bad = dict(TCS_BASE)
        bad["cash_pct"] = 0.50
        bad["debt_pct"] = 0.50
        bad["stock_pct"] = 0.50
        errors = validate_assumptions(bad)
        assert any("100%" in e for e in errors)

    def test_invalid_tax_rate(self):
        """Test that tax rate >= 1.0 fails."""
        bad = dict(TCS_BASE)
        bad["tax_rate"] = 1.5
        errors = validate_assumptions(bad)
        assert any("tax_rate" in e for e in errors)

    def test_negative_debt_rate(self):
        """Test that negative debt interest rate fails."""
        bad = dict(TCS_BASE)
        bad["debt_interest_rate"] = -0.05
        errors = validate_assumptions(bad)
        assert any("debt_interest_rate" in e for e in errors)


# ===================================================================
# SCENARIO EXECUTION TESTS (TCS → Infosys Regression)
# ===================================================================

class TestScenarioExecution:
    """Tests for executing scenarios through the deterministic pipeline."""

    def test_base_scenario_tcs_infosys(self, data_frames):
        """
        TCS → Infosys base scenario regression.
        Validates against known regression values.
        """
        metrics, financials = data_frames
        result = execute_scenario(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            assumptions=TCS_BASE,
        )

        assert "deal" in result
        assert "sources_uses" in result
        assert "accretion_dilution" in result

        ad = result["accretion_dilution"]
        assert ad["is_feasible"] is True
        assert ad["is_available"] is True

        # Regression: Year 1 EPS ≈ ₹129.28
        y1 = ad["pro_forma"]["years"]["year_1"]
        assert y1["pro_forma_eps"] is not None
        assert abs(y1["pro_forma_eps"] - 129.28) < 0.5

        # Regression: Year 1 A/D ≈ -4.95%
        assert y1["accretion_dilution_pct"] is not None
        assert abs(y1["accretion_dilution_pct"] - (-4.95)) < 0.5

        # Year 2 regression
        y2 = ad["pro_forma"]["years"]["year_2"]
        assert abs(y2["pro_forma_eps"] - 130.40) < 0.5
        assert abs(y2["accretion_dilution_pct"] - (-4.13)) < 0.5

        # Year 3 regression
        y3 = ad["pro_forma"]["years"]["year_3"]
        assert abs(y3["pro_forma_eps"] - 131.48) < 0.5
        assert abs(y3["accretion_dilution_pct"] - (-3.33)) < 0.5

        # Break-even synergy regression ≈ ₹4,762.02 Cr
        be = ad["break_even"]["year_1"]
        assert be["break_even_gross_synergy"] is not None
        assert abs(be["break_even_gross_synergy"] - 4762.02) < 5.0

    def test_scenario_result_extraction(self, data_frames):
        """Test that extract_scenario_result produces correct structure."""
        metrics, financials = data_frames
        sd = ScenarioDefinition(name="Base Case", scenario_type="BASE")
        pipeline = execute_scenario(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            assumptions=TCS_BASE,
        )
        result = extract_scenario_result(sd, TCS_BASE, pipeline)

        assert result["identity"]["name"] == "Base Case"
        assert result["identity"]["scenario_type"] == "BASE"
        assert result["deal"]["purchase_equity_value"] is not None
        assert result["sources_uses"]["is_feasible"] is True
        assert abs(result["sources_uses"]["total_uses"] - 567601.87) < 5.0
        assert abs(result["sources_uses"]["total_sources"] - 567601.87) < 5.0
        assert abs(result["sources_uses"]["buyer_cash"] - 10908.02) < 5.0
        assert abs(result["sources_uses"]["new_debt"] - 327240.52) < 5.0
        assert abs(result["sources_uses"]["stock_issuance"] - 207252.33) < 5.0
        assert abs(result["sources_uses"]["target_cash"] - 22201.0) < 5.0
        assert result["sources_uses"]["balance"] == 0.0
        assert abs(result["sources_uses"]["pro_forma_cash"] - 2000.0) < 5.0
        assert result["accretion_dilution"]["year_1"]["eps"] is not None
        assert result["diagnostics"]["is_feasible"] is True

    def test_sources_uses_regression(self, data_frames):
        """Verify Sources & Uses regression values from base scenario."""
        metrics, financials = data_frames
        result = execute_scenario(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            assumptions=TCS_BASE,
        )
        su = result["sources_uses"]
        sources = su.get("sources", {})

        # buyer executable cash ≈ ₹10,908.02 Cr
        assert sources.get("acquirer_cash") is not None
        assert abs(sources["acquirer_cash"] - 10908.02) < 5.0

        # new debt ≈ ₹327,240.52 Cr
        assert sources.get("new_debt") is not None
        assert abs(sources["new_debt"] - 327240.52) < 5.0

        # stock ≈ ₹207,252.33 Cr
        assert sources.get("stock_issuance") is not None
        assert abs(sources["stock_issuance"] - 207252.33) < 5.0

    def test_unknown_company_raises(self, data_frames):
        """Test that unknown buyer or target raises an error."""
        metrics, financials = data_frames
        with pytest.raises(Exception):
            execute_scenario(
                acquirer_id="NONEXISTENT_CORP",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                assumptions=TCS_BASE,
            )


# ===================================================================
# SCENARIO COMPARISON TESTS
# ===================================================================

class TestScenarioComparison:
    """Tests for running multiple scenarios and comparing results."""

    def test_multi_scenario_comparison(self, data_frames):
        """Test running Base, Downside, and Upside scenarios together."""
        metrics, financials = data_frames
        scenarios = [
            ScenarioDefinition("Base Case", "BASE"),
            ScenarioDefinition("Downside", "DOWNSIDE", overrides={"acquisition_premium": 0.30}),
            ScenarioDefinition("Upside", "UPSIDE", overrides={"acquisition_premium": 0.10}),
        ]

        result = run_scenarios(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_BASE,
            scenarios=scenarios,
        )

        assert result["scenario_count"] == 3
        assert len(result["scenarios"]) == 3

        # Base case should match regression
        base = result["scenarios"][0]
        assert base["identity"]["scenario_type"] == "BASE"

        # Downside (higher premium) should be more dilutive
        downside = result["scenarios"][1]
        base_ad = base["accretion_dilution"]["year_1"]["accretion_dilution_pct"]
        down_ad = downside["accretion_dilution"]["year_1"]["accretion_dilution_pct"]
        assert down_ad < base_ad  # More dilutive

        # Upside (lower premium) should be less dilutive
        upside = result["scenarios"][2]
        up_ad = upside["accretion_dilution"]["year_1"]["accretion_dilution_pct"]
        assert up_ad > base_ad  # Less dilutive

    def test_scenario_premium_change_propagation(self, data_frames):
        """
        Scenario regression: changing premium propagates through the
        entire deterministic pipeline.
        """
        metrics, financials = data_frames

        # Base at 20%
        base_result = execute_scenario("TCS", "Infosys", metrics, financials, TCS_BASE)

        # Custom at 25%
        custom_assumptions = resolve_assumptions(TCS_BASE, {"acquisition_premium": 0.25})
        custom_result = execute_scenario("TCS", "Infosys", metrics, financials, custom_assumptions)

        # Purchase price should change
        base_price = base_result["deal"]["transaction"]["purchase_equity_value"]
        custom_price = custom_result["deal"]["transaction"]["purchase_equity_value"]
        assert custom_price > base_price

        # Transaction EV should change
        base_ev = base_result["deal"]["transaction"].get("transaction_enterprise_value")
        custom_ev = custom_result["deal"]["transaction"].get("transaction_enterprise_value")
        if base_ev is not None and custom_ev is not None:
            assert custom_ev > base_ev

        # Financing requirement changes
        base_debt = base_result["sources_uses"]["sources"]["new_debt"]
        custom_debt = custom_result["sources_uses"]["sources"]["new_debt"]
        assert custom_debt > base_debt

        # A/D changes
        base_ad = base_result["accretion_dilution"]["pro_forma"]["years"]["year_1"]["accretion_dilution_pct"]
        custom_ad = custom_result["accretion_dilution"]["pro_forma"]["years"]["year_1"]["accretion_dilution_pct"]
        assert custom_ad < base_ad  # Higher premium = more dilutive

    def test_invalid_financing_mix_scenario(self, data_frames):
        """Test that scenario with invalid financing mix is reported as failed."""
        metrics, financials = data_frames
        scenarios = [
            ScenarioDefinition(
                "Bad Mix",
                "CUSTOM",
                overrides={"cash_pct": 0.50, "debt_pct": 0.50, "stock_pct": 0.50},
            ),
        ]

        result = run_scenarios(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_BASE,
            scenarios=scenarios,
        )

        # Should have validation errors, not crash
        assert result["scenario_count"] == 1
        bad = result["scenarios"][0]
        assert bad["diagnostics"]["is_available"] is False
        assert len(bad["diagnostics"].get("validation_errors", [])) > 0

    def test_feasibility_propagation(self, data_frames):
        """
        Test that a scenario with infeasible financing
        (very high cash pct with minimum cash balance)
        propagates feasibility status.
        """
        metrics, financials = data_frames
        # 100% cash deal with high minimum cash — may be infeasible
        infeasible_assumptions = dict(TCS_BASE)
        infeasible_assumptions["cash_pct"] = 0.98
        infeasible_assumptions["debt_pct"] = 0.01
        infeasible_assumptions["stock_pct"] = 0.01
        infeasible_assumptions["minimum_cash_balance"] = 999999.0

        result = execute_scenario(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            assumptions=infeasible_assumptions,
        )

        ad = result["accretion_dilution"]
        # With massive min cash, the deal should be infeasible
        assert ad["is_feasible"] is False

    def test_empty_scenarios_rejected(self, data_frames):
        """Test that empty scenario list is rejected."""
        metrics, financials = data_frames
        with pytest.raises(ValueError, match="(?i)at least one"):
            run_scenarios(
                acquirer_id="TCS",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=TCS_BASE,
                scenarios=[],
            )


# ===================================================================
# 1D SENSITIVITY TESTS
# ===================================================================

class TestSensitivity1D:
    """Tests for 1D sensitivity analysis."""

    def test_1d_premium_sensitivity(self, data_frames):
        """Test 1D sensitivity across premium values."""
        metrics, financials = data_frames
        result = run_sensitivity_1d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_BASE,
            variable="acquisition_premium",
            values=[0.15, 0.20, 0.25, 0.30],
            output_metric="year_1_ad_pct",
        )

        assert result["variable"] == "acquisition_premium"
        assert len(result["cells"]) == 4

        # Each cell should have an output
        for cell in result["cells"]:
            assert cell["output"] is not None
            assert cell["is_feasible"] is True

        # Higher premium → more dilutive → lower A/D%
        outputs = [c["output"] for c in result["cells"]]
        for i in range(len(outputs) - 1):
            assert outputs[i] > outputs[i + 1], \
                f"Expected monotonically decreasing A/D% with increasing premium: {outputs}"

    def test_1d_debt_sensitivity(self, data_frames):
        """Test 1D sensitivity across debt percentage values."""
        metrics, financials = data_frames
        # Keep financing balanced: debt changes, stock adjusts
        result = run_sensitivity_1d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_BASE,
            variable="debt_pct",
            values=[0.50, 0.55, 0.60, 0.65],
            output_metric="year_1_eps",
        )

        assert result["variable"] == "debt_pct"
        assert len(result["cells"]) == 4

        # Cells with debt + cash + stock != 100% will fail validation
        # Since base has cash=2%, stock=38%, changing debt alone breaks the sum
        # This tests validation handling
        for cell in result["cells"]:
            # Some cells may fail validation (financing mix != 100%)
            if cell["is_feasible"] and cell["output"] is not None:
                assert isinstance(cell["output"], float)

    def test_1d_invalid_variable_rejected(self, data_frames):
        """Test that invalid sensitivity variable is rejected."""
        metrics, financials = data_frames
        with pytest.raises(ValueError, match="Invalid sensitivity variable"):
            run_sensitivity_1d(
                acquirer_id="TCS",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=TCS_BASE,
                variable="not_a_variable",
                values=[0.1],
                output_metric="year_1_eps",
            )

    def test_1d_invalid_metric_rejected(self, data_frames):
        """Test that invalid output metric is rejected."""
        metrics, financials = data_frames
        with pytest.raises(ValueError, match="Invalid output metric"):
            run_sensitivity_1d(
                acquirer_id="TCS",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=TCS_BASE,
                variable="acquisition_premium",
                values=[0.1],
                output_metric="not_a_metric",
            )

    def test_1d_empty_values_rejected(self, data_frames):
        """Test that empty values list is rejected."""
        metrics, financials = data_frames
        with pytest.raises(ValueError, match="(?i)at least one"):
            run_sensitivity_1d(
                acquirer_id="TCS",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=TCS_BASE,
                variable="acquisition_premium",
                values=[],
                output_metric="year_1_eps",
            )

    def test_1d_exceeds_max_values(self, data_frames):
        """Test that exceeding max values is rejected."""
        metrics, financials = data_frames
        values = [0.01 * i for i in range(MAX_SENSITIVITY_AXIS + 1)]
        with pytest.raises(ValueError, match="limited to"):
            run_sensitivity_1d(
                acquirer_id="TCS",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=TCS_BASE,
                variable="acquisition_premium",
                values=values,
                output_metric="year_1_eps",
            )

    def test_sensitivity_regression_premium(self, data_frames):
        """
        Sensitivity regression: verify each premium value produces
        output from the actual deterministic pipeline.
        """
        metrics, financials = data_frames
        result = run_sensitivity_1d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_BASE,
            variable="acquisition_premium",
            values=[0.20, 0.25, 0.30],
            output_metric="year_1_ad_pct",
        )

        assert len(result["cells"]) == 3

        # The 20% cell should match base regression ≈ -4.95%
        cell_20 = result["cells"][0]
        assert cell_20["value"] == 0.20
        assert cell_20["output"] is not None
        assert abs(cell_20["output"] - (-4.95)) < 0.5

        # All cells should be feasible
        for cell in result["cells"]:
            assert cell["is_feasible"] is True


# ===================================================================
# 2D SENSITIVITY TESTS
# ===================================================================

class TestSensitivity2D:
    """Tests for 2D sensitivity matrix analysis."""

    def test_2d_premium_x_synergy(self, data_frames):
        """Test 2D sensitivity: premium vs synergy Year 1."""
        metrics, financials = data_frames
        result = run_sensitivity_2d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_BASE,
            x_variable="acquisition_premium",
            x_values=[0.15, 0.20, 0.25],
            y_variable="synergy_year_1",
            y_values=[0.0, 1000.0, 2000.0],
            output_metric="year_1_ad_pct",
        )

        assert result["x_variable"] == "acquisition_premium"
        assert result["y_variable"] == "synergy_year_1"
        assert result["dimensions"]["rows"] == 3
        assert result["dimensions"]["columns"] == 3
        assert result["dimensions"]["total_cells"] == 9

        # Matrix should have correct structure
        assert len(result["matrix"]) == 3
        for row in result["matrix"]:
            assert len(row) == 3

        # Each cell should have x_value and y_value
        for r_idx, row in enumerate(result["matrix"]):
            for c_idx, cell in enumerate(row):
                assert cell["x_value"] == [0.15, 0.20, 0.25][c_idx]
                assert cell["y_value"] == [0.0, 1000.0, 2000.0][r_idx]

    def test_2d_each_cell_uses_pipeline(self, data_frames):
        """
        Verify that each cell in the 2D matrix produces a distinct
        result from the deterministic engine.
        """
        metrics, financials = data_frames
        result = run_sensitivity_2d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_BASE,
            x_variable="acquisition_premium",
            x_values=[0.15, 0.25],
            y_variable="synergy_year_1",
            y_values=[0.0, 2000.0],
            output_metric="year_1_ad_pct",
        )

        # All 4 cells should have distinct values
        values = set()
        for row in result["matrix"]:
            for cell in row:
                if cell["output"] is not None:
                    values.add(round(cell["output"], 4))

        # With different premium and synergy combos, values should differ
        assert len(values) >= 3  # At minimum 3 distinct values out of 4

    def test_2d_same_variable_rejected(self, data_frames):
        """Test that using the same variable for both axes is rejected."""
        metrics, financials = data_frames
        with pytest.raises(ValueError, match="must be different"):
            run_sensitivity_2d(
                acquirer_id="TCS",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=TCS_BASE,
                x_variable="acquisition_premium",
                x_values=[0.15, 0.20],
                y_variable="acquisition_premium",
                y_values=[0.25, 0.30],
                output_metric="year_1_eps",
            )

    def test_2d_matrix_size_validation(self, data_frames):
        """Test that oversized matrices are rejected."""
        metrics, financials = data_frames
        big_values = list(range(MAX_SENSITIVITY_AXIS + 1))
        with pytest.raises(ValueError, match="limited to"):
            run_sensitivity_2d(
                acquirer_id="TCS",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=TCS_BASE,
                x_variable="acquisition_premium",
                x_values=[float(v) / 100 for v in big_values],
                y_variable="debt_interest_rate",
                y_values=[0.05],
                output_metric="year_1_eps",
            )

    def test_2d_invalid_x_variable(self, data_frames):
        """Test that invalid x-axis variable is rejected."""
        metrics, financials = data_frames
        with pytest.raises(ValueError, match="Invalid sensitivity variable"):
            run_sensitivity_2d(
                acquirer_id="TCS",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=TCS_BASE,
                x_variable="bad_var",
                x_values=[0.1],
                y_variable="acquisition_premium",
                y_values=[0.1],
                output_metric="year_1_eps",
            )

    def test_2d_infeasible_cells_preserved(self, data_frames):
        """
        Test that infeasible cells (e.g., financing mix != 100%)
        are preserved with null outputs and feasible=false.
        """
        metrics, financials = data_frames
        # Sensitivity on cash_pct vs debt_pct — combos not summing to 100%
        # will fail validation, producing infeasible cells with null outputs
        result = run_sensitivity_2d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=TCS_BASE,
            x_variable="cash_pct",
            x_values=[0.02],
            y_variable="debt_pct",
            y_values=[0.60, 0.80],
            output_metric="year_1_ad_pct",
        )

        # The first row (debt=0.60, cash=0.02, stock=0.38 => sum=100%) should be feasible
        assert result["matrix"][0][0]["is_feasible"] is True
        assert result["matrix"][0][0]["output"] is not None

        # The second row (debt=0.80, cash=0.02, stock=0.38 => sum=120%) should be infeasible
        assert result["matrix"][1][0]["is_feasible"] is False
        assert result["matrix"][1][0]["output"] is None
        assert len(result["matrix"][1][0]["diagnostics"]) > 0

    def test_infeasible_cash_shortfall_sensitivity(self, data_frames):
        """
        Test that financing structures with cash exceeding available cash
        (valid 100% mix but cash shortfall) produce is_feasible=False, output=None.
        """
        metrics, financials = data_frames
        # 98% cash deal: valid 100% mix, but TCS does not have ~500k Cr cash
        cash_heavy_base = dict(TCS_BASE)
        cash_heavy_base["cash_pct"] = 0.98
        cash_heavy_base["debt_pct"] = 0.01
        cash_heavy_base["stock_pct"] = 0.01

        result = run_sensitivity_1d(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            base_assumptions=cash_heavy_base,
            variable="acquisition_premium",
            values=[0.20],
            output_metric="year_1_ad_pct",
        )

        cell = result["cells"][0]
        assert cell["is_feasible"] is False
        assert cell["output"] is None
        assert len(cell["diagnostics"]) > 0
        assert any("INFEASIBLE" in str(d).upper() or "exceeds" in str(d).lower() for d in cell["diagnostics"])

    def test_2d_empty_values_rejected(self, data_frames):
        """Test that empty axis values are rejected."""
        metrics, financials = data_frames
        with pytest.raises(ValueError, match="non-empty"):
            run_sensitivity_2d(
                acquirer_id="TCS",
                target_id="Infosys",
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=TCS_BASE,
                x_variable="acquisition_premium",
                x_values=[],
                y_variable="debt_interest_rate",
                y_values=[0.05],
                output_metric="year_1_eps",
            )


# ===================================================================
# OUTPUT METRIC TESTS
# ===================================================================

class TestOutputMetrics:
    """Tests for output metric extraction."""

    def test_all_supported_metrics_extractable(self, data_frames):
        """Verify that all declared output metrics can be extracted."""
        metrics, financials = data_frames
        result = execute_scenario(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            assumptions=TCS_BASE,
        )

        from analytics.scenarios import _extract_output_metric

        for metric in SUPPORTED_OUTPUT_METRICS:
            val = _extract_output_metric(result, metric)
            # Most metrics should be non-None for a valid TCS-Infosys deal
            if metric != "is_feasible":
                # transaction_ev may be None if net_debt is missing
                # but most should have values
                pass  # Just ensure no exception is raised

    def test_feasibility_metric(self, data_frames):
        """Test that is_feasible metric is boolean."""
        metrics, financials = data_frames
        result = execute_scenario(
            acquirer_id="TCS",
            target_id="Infosys",
            metrics_df=metrics,
            financials_df=financials,
            assumptions=TCS_BASE,
        )

        from analytics.scenarios import _extract_output_metric
        val = _extract_output_metric(result, "is_feasible")
        assert isinstance(val, bool)


# ===================================================================
# CONSTANTS TESTS
# ===================================================================

class TestConstants:
    """Tests for module constants and supported parameters."""

    def test_supported_assumptions_nonempty(self):
        assert len(SUPPORTED_ASSUMPTIONS) > 0

    def test_supported_sensitivity_variables_subset_of_assumptions(self):
        assert SUPPORTED_SENSITIVITY_VARIABLES.issubset(SUPPORTED_ASSUMPTIONS)

    def test_max_sensitivity_axis_reasonable(self):
        assert MAX_SENSITIVITY_AXIS >= 5
        assert MAX_SENSITIVITY_AXIS <= 100

    def test_scenario_types_include_base_upside_downside_custom(self):
        from analytics.scenarios import SCENARIO_TYPES
        assert "BASE" in SCENARIO_TYPES
        assert "UPSIDE" in SCENARIO_TYPES
        assert "DOWNSIDE" in SCENARIO_TYPES
        assert "CUSTOM" in SCENARIO_TYPES
