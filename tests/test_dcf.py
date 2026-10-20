import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics.dcf import compute_wacc, project_fcff, terminal_value, discount_to_present, dcf_valuation


def test_wacc_formula_matches_manual_calc():
    result = compute_wacc(
        market_cap_cr=8000,
        total_debt_cr=2000,
        interest_expense_cr=160,  # 8% pretax cost of debt on 2000
        tax_rate=0.25,
        risk_free_rate=0.07,
        equity_risk_premium=0.06,
        beta=1.0,
    )
    # Cost of equity = 0.07 + 1.0*0.06 = 0.13
    assert abs(result["cost_of_equity"] - 0.13) < 1e-9
    # Cost of debt pretax = 160/2000 = 0.08; after-tax = 0.08*0.75 = 0.06
    assert abs(result["cost_of_debt_pretax"] - 0.08) < 1e-9
    assert abs(result["cost_of_debt_after_tax"] - 0.06) < 1e-9
    # Weights: E = 8000/10000 = 0.8, D = 2000/10000 = 0.2
    assert abs(result["equity_weight"] - 0.8) < 1e-9
    assert abs(result["debt_weight"] - 0.2) < 1e-9
    # WACC = 0.8*0.13 + 0.2*0.06 = 0.104 + 0.012 = 0.116
    assert abs(result["wacc"] - 0.116) < 1e-9


def test_wacc_handles_zero_debt():
    result = compute_wacc(market_cap_cr=5000, total_debt_cr=0, interest_expense_cr=0, tax_rate=0.25)
    assert result["cost_of_debt_pretax"] == 0.0
    assert abs(result["equity_weight"] - 1.0) < 1e-9
    assert abs(result["wacc"] - result["cost_of_equity"]) < 1e-9


def test_project_fcff_matches_manual_calc():
    """
    Cross-checks the forecast against an independent, plain-Python
    recomputation of the same formula (not just re-reading the code back),
    across 3 years with round input numbers.
    """
    forecast = project_fcff(
        latest_revenue_cr=1000,
        revenue_growth=0.10,
        ebitda_margin=0.20,
        da_pct_revenue=0.05,
        capex_pct_revenue=0.06,
        tax_rate=0.25,
        forecast_years=3,
    )

    revenue = 1000.0
    expected_fcff = []
    for _ in range(3):
        revenue *= 1.10
        ebitda = revenue * 0.20
        da = revenue * 0.05
        ebit = ebitda - da
        tax_expense = ebit * 0.25
        nopat = ebit - tax_expense
        capex = revenue * 0.06
        fcff = nopat + da - capex - 0.0
        expected_fcff.append(fcff)

    for i, expected in enumerate(expected_fcff):
        assert abs(forecast["fcff"].iloc[i] - expected) < 1e-6

    # Change in NWC assumed zero throughout, per V0 simplification.
    assert (forecast["change_nwc"] == 0.0).all()


def test_terminal_value_formula():
    tv = terminal_value(final_year_fcff=136.4275, wacc=0.13, terminal_growth=0.05)
    expected = 136.4275 * 1.05 / (0.13 - 0.05)
    assert abs(tv - expected) < 1e-6


def test_terminal_value_raises_when_growth_exceeds_wacc():
    with pytest.raises(ValueError):
        terminal_value(final_year_fcff=100, wacc=0.08, terminal_growth=0.08)
    with pytest.raises(ValueError):
        terminal_value(final_year_fcff=100, wacc=0.08, terminal_growth=0.10)


def test_discount_to_present_matches_manual_calc():
    fcff_series = pd.Series([100.0, 110.0, 121.0])
    wacc = 0.10
    result = discount_to_present(fcff_series, terminal_value_undiscounted=2000.0, wacc=wacc)

    expected_pv_fcff = 100 / 1.10 + 110 / 1.10**2 + 121 / 1.10**3
    expected_pv_tv = 2000 / 1.10**3

    assert abs(result["pv_explicit_fcff"] - expected_pv_fcff) < 1e-6
    assert abs(result["pv_terminal_value"] - expected_pv_tv) < 1e-6
    assert abs(result["enterprise_value"] - (expected_pv_fcff + expected_pv_tv)) < 1e-6


def test_dcf_valuation_end_to_end_with_explicit_wacc():
    """
    Full orchestration, WACC supplied explicitly (bypassing compute_wacc)
    so the test isolates the forecast->TV->discount->equity value chain.
    """
    result = dcf_valuation(
        latest_revenue_cr=1000,
        net_debt_cr=300,
        shares_outstanding=1e8,
        market_cap_cr=5000,  # unused when wacc is explicit, but required by signature
        total_debt_cr=500,
        interest_expense_cr=40,
        ebitda_margin=0.20,
        da_pct_revenue=0.05,
        capex_pct_revenue=0.06,
        tax_rate=0.25,
        revenue_growth=0.10,
        terminal_growth=0.05,
        forecast_years=3,
        wacc=0.13,
    )
    assert result["wacc_used"] == 0.13
    assert result["wacc_detail"] is None  # explicit WACC -> no CAPM breakdown computed
    assert result["implied_ev"] > 0
    assert result["implied_equity_value"] == result["implied_ev"] - 300
    # EPS-style unit conversion check: implied_value_per_share = (equity_value_cr * 1e7) / shares
    expected_per_share = (result["implied_equity_value"] * 1e7) / 1e8
    assert abs(result["implied_value_per_share"] - expected_per_share) < 1e-6


def test_dcf_valuation_computes_wacc_when_not_supplied():
    result = dcf_valuation(
        latest_revenue_cr=1000,
        net_debt_cr=300,
        shares_outstanding=1e8,
        market_cap_cr=8000,
        total_debt_cr=2000,
        interest_expense_cr=160,
        ebitda_margin=0.20,
        da_pct_revenue=0.05,
        capex_pct_revenue=0.06,
        tax_rate=0.25,
        revenue_growth=0.10,
    )
    assert result["wacc_detail"] is not None
    # Matches the manual CAPM/WACC calc from test_wacc_formula_matches_manual_calc
    assert abs(result["wacc_used"] - 0.116) < 1e-9


def test_dcf_warns_when_capex_exceeds_ebitda_margin():
    """
    Regression test for the real Adani Enterprises case: CapEx proxy
    (27.5% of revenue) exceeded EBITDA margin (13.9%), guaranteeing
    structurally negative FCFF every year. The module must surface this
    as an explicit warning rather than silently returning a nonsensical
    negative implied equity value with no explanation.
    """
    result = dcf_valuation(
        latest_revenue_cr=1000,
        net_debt_cr=300,
        shares_outstanding=1e8,
        market_cap_cr=5000,
        total_debt_cr=500,
        interest_expense_cr=40,
        ebitda_margin=0.14,  # mirrors Adani Enterprises' real ~13.9% margin
        da_pct_revenue=0.06,
        capex_pct_revenue=0.28,  # mirrors the real ~27.5% CapEx proxy that exceeded margin
        tax_rate=0.28,
        revenue_growth=0.12,
        wacc=0.111,
    )
    assert len(result["warnings"]) > 0
    assert any("CapEx assumption" in w for w in result["warnings"])
    assert any("negative" in w.lower() for w in result["warnings"])
    assert result["implied_equity_value"] < 0


def test_dcf_no_warnings_for_healthy_assumptions():
    result = dcf_valuation(
        latest_revenue_cr=1000,
        net_debt_cr=300,
        shares_outstanding=1e8,
        market_cap_cr=8000,
        total_debt_cr=2000,
        interest_expense_cr=160,
        ebitda_margin=0.20,
        da_pct_revenue=0.05,
        capex_pct_revenue=0.06,  # well below EBITDA margin -- healthy case
        tax_rate=0.25,
        revenue_growth=0.10,
    )
    assert result["warnings"] == []
    assert result["implied_equity_value"] > 0
