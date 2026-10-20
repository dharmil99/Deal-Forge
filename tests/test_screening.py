import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics.screening import compute_metrics, screen, add_screening_score


@pytest.fixture
def synthetic_financials():
    # Company A: revenue doubles over 4 years -> CAGR = 2^(1/4) - 1 ≈ 18.92%
    # Company B: flat revenue -> CAGR = 0%
    # shares_outstanding is a raw count; net_income is in Rs Cr (see EPS formula).
    return pd.DataFrame(
        [
            {"company_id": "A", "fiscal_year": 2022, "revenue": 1000, "ebitda_derived": 150, "ebitda_margin_derived": 0.15, "net_debt_derived": 300, "net_income": 80, "shares_outstanding": 1e8},
            {"company_id": "A", "fiscal_year": 2026, "revenue": 2000, "ebitda_derived": 400, "ebitda_margin_derived": 0.20, "net_debt_derived": 500, "net_income": 250, "shares_outstanding": 1e8},
            {"company_id": "B", "fiscal_year": 2022, "revenue": 500, "ebitda_derived": 50, "ebitda_margin_derived": 0.10, "net_debt_derived": 100, "net_income": 20, "shares_outstanding": 5e7},
            {"company_id": "B", "fiscal_year": 2026, "revenue": 500, "ebitda_derived": 60, "ebitda_margin_derived": 0.12, "net_debt_derived": 150, "net_income": 25, "shares_outstanding": 5e7},
        ]
    )


@pytest.fixture
def synthetic_companies():
    return pd.DataFrame(
        [
            {"company_id": "A", "company_name": "Alpha Industries", "market_cap_latest": 5000, "current_price": 500},
            {"company_id": "B", "company_name": "Beta Corp", "market_cap_latest": 600, "current_price": 120},
        ]
    )


@pytest.fixture
def synthetic_sectors():
    return pd.DataFrame(
        [
            {"company_id": "A", "sector": "Materials", "industry": "Cement", "sector_type": "Industrial", "ticker": "ALPHA"},
            {"company_id": "B", "sector": "Materials", "industry": "Cement", "sector_type": "Industrial", "ticker": "BETA"},
        ]
    )


def test_revenue_cagr_matches_manual_calc(synthetic_financials, synthetic_companies, synthetic_sectors):
    metrics = compute_metrics(synthetic_financials, synthetic_companies, synthetic_sectors)
    row_a = metrics[metrics["company_id"] == "A"].iloc[0]
    expected_cagr = (2000 / 1000) ** (1 / 4) - 1  # ~0.1892
    assert abs(row_a["revenue_cagr"] - expected_cagr) < 1e-9

    row_b = metrics[metrics["company_id"] == "B"].iloc[0]
    assert abs(row_b["revenue_cagr"] - 0.0) < 1e-9


def test_ev_and_ev_ebitda_formula(synthetic_financials, synthetic_companies, synthetic_sectors):
    metrics = compute_metrics(synthetic_financials, synthetic_companies, synthetic_sectors)
    row_a = metrics[metrics["company_id"] == "A"].iloc[0]
    # EV = market cap (5000) + latest net debt (500) = 5500
    assert row_a["ev"] == 5500
    # EV/EBITDA = 5500 / 400 = 13.75
    assert abs(row_a["ev_ebitda"] - 13.75) < 1e-9


def test_net_debt_ebitda_formula(synthetic_financials, synthetic_companies, synthetic_sectors):
    metrics = compute_metrics(synthetic_financials, synthetic_companies, synthetic_sectors)
    row_a = metrics[metrics["company_id"] == "A"].iloc[0]
    # Net Debt / EBITDA = 500 / 400 = 1.25
    assert abs(row_a["net_debt_ebitda"] - 1.25) < 1e-9


def test_screen_filters_correctly(synthetic_financials, synthetic_companies, synthetic_sectors):
    metrics = compute_metrics(synthetic_financials, synthetic_companies, synthetic_sectors)
    # Company A: CAGR ~18.9%, passes a 10% threshold. Company B: 0%, fails.
    result = screen(metrics, min_revenue_cagr=0.10)
    assert set(result["company_id"]) == {"A"}


def test_screening_score_ranks_stronger_company_higher(synthetic_financials, synthetic_companies, synthetic_sectors):
    metrics = compute_metrics(synthetic_financials, synthetic_companies, synthetic_sectors)
    scored = add_screening_score(metrics)
    score_a = scored[scored["company_id"] == "A"]["illustrative_screening_score"].iloc[0]
    score_b = scored[scored["company_id"] == "B"]["illustrative_screening_score"].iloc[0]
    # A has higher growth and margin; B has a cheaper EV/EBITDA and similar
    # leverage -- but in this synthetic setup A should still score higher
    # overall since it dominates on 2 of 4 dimensions.
    assert score_a > score_b


def test_eps_and_pe_ratio_formula(synthetic_financials, synthetic_companies, synthetic_sectors):
    metrics = compute_metrics(synthetic_financials, synthetic_companies, synthetic_sectors)
    row_a = metrics[metrics["company_id"] == "A"].iloc[0]
    # EPS = (net_income_cr * 1e7) / shares_outstanding = (250 * 1e7) / 1e8 = 25.0
    assert abs(row_a["eps"] - 25.0) < 1e-9
    # P/E = current_price / EPS = 500 / 25 = 20.0
    assert abs(row_a["pe_ratio"] - 20.0) < 1e-9


def test_shares_outstanding_falls_back_to_prior_year_when_latest_is_missing():
    """
    Regression test for the real UltraTech case: shares_outstanding is NaN
    for the latest fiscal year (Screener hasn't published the updated count
    yet) even though net_income and price are current. EPS/P-E should still
    compute using the most recent prior year's share count, not come back
    NaN and silently drop the company from P/E-based comps.
    """
    financials = pd.DataFrame(
        [
            {"company_id": "C", "fiscal_year": 2024, "revenue": 1000, "ebitda_derived": 150, "ebitda_margin_derived": 0.15, "net_debt_derived": 200, "net_income": 70, "shares_outstanding": 2.0e8},
            {"company_id": "C", "fiscal_year": 2025, "revenue": 1100, "ebitda_derived": 170, "ebitda_margin_derived": 0.155, "net_debt_derived": 220, "net_income": 80, "shares_outstanding": 2.05e8},
            {"company_id": "C", "fiscal_year": 2026, "revenue": 1200, "ebitda_derived": 190, "ebitda_margin_derived": 0.158, "net_debt_derived": 240, "net_income": 90, "shares_outstanding": None},
        ]
    )
    companies = pd.DataFrame([{"company_id": "C", "company_name": "Charlie Cement", "market_cap_latest": 8000, "current_price": 780}])
    sectors = pd.DataFrame([{"company_id": "C", "sector": "Materials", "industry": "Cement", "sector_type": "Industrial", "ticker": "CHARLIE"}])

    metrics = compute_metrics(financials, companies, sectors)
    row = metrics[metrics["company_id"] == "C"].iloc[0]

    # Falls back to FY2025's share count (2.05e8), not NaN.
    assert row["shares_outstanding_latest"] == 2.05e8
    assert row["shares_outstanding_fallback_year"] == 2025
    assert bool(row["shares_outstanding_is_stale"]) is True

    # EPS uses latest net_income (90, from FY2026) with the FALLBACK share count.
    expected_eps = (90 * 1e7) / 2.05e8
    assert abs(row["eps"] - expected_eps) < 1e-6
    assert pd.notna(row["pe_ratio"])  # no longer NaN


def test_ev_revenue_formula(synthetic_financials, synthetic_companies, synthetic_sectors):
    metrics = compute_metrics(synthetic_financials, synthetic_companies, synthetic_sectors)
    row_a = metrics[metrics["company_id"] == "A"].iloc[0]
    # EV/Revenue = 5500 / 2000 = 2.75
    assert abs(row_a["ev_revenue"] - 2.75) < 1e-9


def test_industrial_only_excludes_financials(synthetic_financials, synthetic_companies, synthetic_sectors):
    sectors_with_bank = synthetic_sectors.copy()
    sectors_with_bank.loc[sectors_with_bank["company_id"] == "B", "sector_type"] = "Financial"
    metrics = compute_metrics(synthetic_financials, synthetic_companies, sectors_with_bank)
    result = screen(metrics, industrial_only=True)
    assert "B" not in set(result["company_id"])
    assert "A" in set(result["company_id"])
