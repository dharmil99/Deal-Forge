"""
test_accretion_dilution.py

Unit and regression tests for Phase 8: Accretion / Dilution Analysis
(analytics/accretion_dilution.py).

Test categories:
  1. Standalone EPS (Buyer and Target)
  2. Consideration & Share Count (New shares, Pro-forma shares, Buyer price usage)
  3. Financing Costs (New debt interest, foregone cash interest, after-tax impact)
  4. Synergies (Gross to after-tax, 3-year ramp)
  5. Pro-Forma Net Income & EPS
  6. Accretion & Dilution Scenarios (Accretive, Dilutive, Neutral, Zero-synergy, Increasing synergy)
  7. Break-Even Synergy Derivation & Validation
  8. Missing Data, Invalid Rates & Zero/Negative Share Count Handling
  9. Executable Cash Constraint (Phase 7 executable cash vs unfeasible requested cash)
  10. Phase 6 & Phase 7 Integration
  11. Real-Data Regression: TCS acquiring Infosys
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from analytics.accretion_dilution import (
    calculate_accretion_dilution,
    calculate_accretion_dilution_from_universe,
    calculate_break_even_synergies,
    calculate_new_shares_issued,
    calculate_standalone_eps,
)
from analytics.deal_model import build_deal
from analytics.screening import compute_metrics
from analytics.sources_uses import build_sources_and_uses


# ---------------------------------------------------------------------------
# Synthetic Test Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def synthetic_buyer():
    return {
        "company_id": "BuyerCo",
        "company_name": "Buyer Corporation",
        "net_income": 1000.0,          # Rs Cr
        "diluted_shares": 100.0,        # 100 Cr shares
        "shares_outstanding": 100.0,
        "share_price": 50.0,            # Rs per share -> Standalone EPS = 10.0
        "current_price": 50.0,
        "cash": 800.0,                  # Rs Cr
    }


@pytest.fixture
def synthetic_target():
    return {
        "company_id": "TargetCo",
        "company_name": "Target Enterprise",
        "net_income": 300.0,           # Rs Cr
        "diluted_shares": 50.0,         # 50 Cr shares
        "shares_outstanding": 50.0,
        "share_price": 40.0,            # Rs per share -> Standalone EPS = 6.0
        "current_price": 40.0,
        "cash": 100.0,
    }


# ---------------------------------------------------------------------------
# 1. Standalone EPS (Buyer and Target)
# ---------------------------------------------------------------------------

def test_buyer_standalone_eps(synthetic_buyer):
    eps = calculate_standalone_eps(synthetic_buyer["net_income"], synthetic_buyer["diluted_shares"])
    assert eps == 10.0  # 1000 / 100 = 10.0


def test_target_standalone_eps(synthetic_target):
    eps = calculate_standalone_eps(synthetic_target["net_income"], synthetic_target["diluted_shares"])
    assert eps == 6.0   # 300 / 50 = 6.0


def test_standalone_eps_raw_shares_scaling():
    # Net income: 49210 Cr, Shares: 3,618,087,518 raw shares -> EPS = ~136.01
    eps = calculate_standalone_eps(49210.0, 3618087518.0)
    assert abs(eps - 136.011) < 0.01


# ---------------------------------------------------------------------------
# 2. Consideration & Share Count
# ---------------------------------------------------------------------------

def test_new_shares_calculation():
    # Stock consideration: 500 Cr, Buyer share price: 50 Rs -> 10 Cr shares
    new_shares = calculate_new_shares_issued(500.0, 50.0, buyer_shares_is_raw=False)
    assert new_shares == 10.0


def test_stock_consideration_uses_buyer_share_price_not_target():
    # Even if target share price is 25.0, new shares MUST divide by buyer share price (50.0)
    buyer_px = 50.0
    stock_val = 500.0
    new_shares = calculate_new_shares_issued(stock_val, buyer_px, buyer_shares_is_raw=False)
    assert new_shares == 10.0  # 500 / 50, not 500 / 25


def test_pro_forma_share_count(synthetic_buyer, synthetic_target):
    res = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target=synthetic_target,
        stock_consideration_value=500.0,
        new_debt=0.0,
        buyer_cash_used=0.0,
    )
    assert res["pro_forma"]["new_shares_issued"] == 10.0
    assert res["pro_forma"]["pro_forma_shares"] == 110.0  # 100 + 10


# ---------------------------------------------------------------------------
# 3. Financing Costs (New Debt Interest & Foregone Cash Interest)
# ---------------------------------------------------------------------------

def test_new_debt_interest():
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": 100.0, "share_price": 50.0},
        target={"net_income": 300.0, "diluted_shares": 50.0, "share_price": 40.0},
        new_debt=1000.0,
        debt_interest_rate=0.08,
        tax_rate=0.25,
    )
    # 1000 * 0.08 = 80.0
    assert res["financing"]["debt_interest"] == 80.0


def test_after_tax_debt_interest():
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": 100.0, "share_price": 50.0},
        target={"net_income": 300.0, "diluted_shares": 50.0, "share_price": 40.0},
        new_debt=1000.0,
        debt_interest_rate=0.08,
        tax_rate=0.25,
    )
    # 80.0 * (1 - 0.25) = 60.0
    assert res["financing"]["after_tax_debt_interest"] == 60.0


def test_foregone_cash_interest():
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": 100.0, "share_price": 50.0, "cash": 500.0},
        target={"net_income": 300.0, "diluted_shares": 50.0, "share_price": 40.0},
        buyer_cash_used=400.0,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.25,
    )
    # 400 * 0.05 = 20.0
    assert res["financing"]["foregone_interest"] == 20.0


def test_after_tax_foregone_interest():
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": 100.0, "share_price": 50.0, "cash": 500.0},
        target={"net_income": 300.0, "diluted_shares": 50.0, "share_price": 40.0},
        buyer_cash_used=400.0,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.25,
    )
    # 20.0 * (1 - 0.25) = 15.0
    assert res["financing"]["after_tax_foregone_interest"] == 15.0


# ---------------------------------------------------------------------------
# 4. Synergies
# ---------------------------------------------------------------------------

def test_after_tax_synergy():
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": 100.0, "share_price": 50.0},
        target={"net_income": 300.0, "diluted_shares": 50.0, "share_price": 40.0},
        synergy_year_1=100.0,
        tax_rate=0.25,
    )
    # 100 * (1 - 0.25) = 75.0
    assert res["synergies"]["after_tax_year_1"] == 75.0


def test_increasing_synergy_across_years():
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": 100.0, "share_price": 50.0},
        target={"net_income": 300.0, "diluted_shares": 50.0, "share_price": 40.0},
        synergy_year_1=100.0,
        synergy_year_2=200.0,
        synergy_year_3=300.0,
        tax_rate=0.25,
    )
    assert res["synergies"]["gross_year_1"] == 100.0
    assert res["synergies"]["gross_year_2"] == 200.0
    assert res["synergies"]["gross_year_3"] == 300.0
    assert res["synergies"]["after_tax_year_1"] == 75.0
    assert res["synergies"]["after_tax_year_2"] == 150.0
    assert res["synergies"]["after_tax_year_3"] == 225.0


# ---------------------------------------------------------------------------
# 5. Pro-Forma Net Income & EPS
# ---------------------------------------------------------------------------

def test_pro_forma_net_income(synthetic_buyer, synthetic_target):
    # Buyer NI = 1000, Target NI = 300, Synergy = 100 gross (75 net)
    # New debt = 500 (40 int, 30 net int), Cash used = 200 (10 int, 7.5 net int)
    # Pro Forma NI = 1000 + 300 + 75 - 30 - 7.5 = 1337.5
    res = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target=synthetic_target,
        new_debt=500.0,
        buyer_cash_used=200.0,
        synergy_year_1=100.0,
        debt_interest_rate=0.08,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.25,
    )
    y1 = res["pro_forma"]["years"]["year_1"]
    assert y1["pro_forma_net_income"] == 1337.5


def test_pro_forma_eps(synthetic_buyer, synthetic_target):
    # Pro Forma NI = 1337.5, Stock = 500 (10 shares issued) -> Pro Forma Shares = 110
    # Pro Forma EPS = 1337.5 / 110 = 12.15909
    res = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target=synthetic_target,
        stock_consideration_value=500.0,
        new_debt=500.0,
        buyer_cash_used=200.0,
        synergy_year_1=100.0,
        debt_interest_rate=0.08,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.25,
    )
    y1 = res["pro_forma"]["years"]["year_1"]
    assert abs(y1["pro_forma_eps"] - (1337.5 / 110.0)) < 1e-4


# ---------------------------------------------------------------------------
# 6. Accretion & Dilution Scenarios
# ---------------------------------------------------------------------------

def test_accretion_calculation(synthetic_buyer, synthetic_target):
    # Buyer EPS = 10.0, Pro Forma EPS = 12.159 -> Accretion = +21.59% [ACCRETIVE]
    res = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target=synthetic_target,
        stock_consideration_value=500.0,
        new_debt=500.0,
        buyer_cash_used=200.0,
        synergy_year_1=100.0,
        tax_rate=0.25,
    )
    y1 = res["pro_forma"]["years"]["year_1"]
    assert y1["status"] == "ACCRETIVE"
    assert y1["eps_change"] > 0.0
    assert y1["accretion_dilution_pct"] > 0.0


def test_dilution_calculation(synthetic_buyer, synthetic_target):
    # Issue massive stock (e.g. 2000 Cr at 50 Rs = 40 shares, total 140 shares)
    # Heavy debt interest: 3000 Cr debt at 15% rate = 450 int (337.5 net)
    # NI = 1000 + 300 - 337.5 = 962.5 / 140 = 6.875 < 10.0 -> DILUTIVE
    res = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target=synthetic_target,
        stock_consideration_value=2000.0,
        new_debt=3000.0,
        debt_interest_rate=0.15,
        tax_rate=0.25,
    )
    y1 = res["pro_forma"]["years"]["year_1"]
    assert y1["status"] == "DILUTIVE"
    assert y1["eps_change"] < 0.0
    assert y1["accretion_dilution_pct"] < 0.0


def test_zero_synergy_scenario(synthetic_buyer, synthetic_target):
    res = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target=synthetic_target,
        stock_consideration_value=500.0,
        new_debt=500.0,
        synergy_year_1=0.0,
    )
    y1 = res["pro_forma"]["years"]["year_1"]
    assert y1["gross_synergy"] == 0.0
    assert y1["after_tax_synergy"] == 0.0


# ---------------------------------------------------------------------------
# 7. Break-Even Synergy Derivation & Validation
# ---------------------------------------------------------------------------

def test_break_even_synergy():
    # Buyer Standalone EPS = 10.0, Pro Forma Shares = 110.0 -> Required NI = 1100.0
    # Buyer NI = 1000.0, Target NI = 50.0, Debt int = 60.0 -> Base NI = 1000 + 50 - 60 = 990.0
    # Required after-tax synergy = 1100 - 990 = 110.0
    # Tax rate = 0.25 -> Required gross synergy = 110 / 0.75 = 146.6667
    be = calculate_break_even_synergies(
        buyer_standalone_eps=10.0,
        pro_forma_shares=110.0,
        buyer_net_income=1000.0,
        target_net_income=50.0,
        after_tax_debt_interest=60.0,
        after_tax_foregone_interest=0.0,
        tax_rate=0.25,
        shares_is_raw=False,
    )
    assert abs(be["required_pro_forma_net_income"] - 1100.0) < 1e-4
    assert abs(be["break_even_after_tax_synergy"] - 110.0) < 1e-4
    assert abs(be["break_even_gross_synergy"] - (110.0 / 0.75)) < 1e-4
    assert be["synergies_required"] is True

    # Validate that applying break-even gross synergy produces EXACTLY buyer standalone EPS (10.0)
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": 100.0, "share_price": 50.0},
        target={"net_income": 50.0, "diluted_shares": 50.0, "share_price": 40.0},
        stock_consideration_value=500.0,  # 10 shares -> 110 total
        new_debt=1000.0,                  # 80 int, 60 net
        debt_interest_rate=0.08,
        tax_rate=0.25,
        synergy_year_1=be["break_even_gross_synergy"],
    )
    y1 = res["pro_forma"]["years"]["year_1"]
    assert abs(y1["pro_forma_eps"] - 10.0) < 1e-4
    assert abs(y1["eps_change"]) < 1e-4


# ---------------------------------------------------------------------------
# 8. Missing Data, Invalid Rates & Zero/Negative Share Count Handling
# ---------------------------------------------------------------------------

def test_missing_buyer_net_income(synthetic_target):
    res = calculate_accretion_dilution(
        buyer={"net_income": None, "diluted_shares": 100.0, "share_price": 50.0},
        target=synthetic_target,
    )
    assert res["is_available"] is False
    assert res["standalone"]["buyer_eps"] is None
    assert any("buyer: net income is missing" in d for d in res["diagnostics"])


def test_missing_target_net_income(synthetic_buyer):
    res = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target={"net_income": None, "diluted_shares": 50.0, "share_price": 40.0},
    )
    assert res["is_available"] is False
    assert any("target: net income is missing" in d for d in res["diagnostics"])


def test_missing_buyer_shares(synthetic_target):
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": None, "share_price": 50.0},
        target=synthetic_target,
    )
    assert res["is_available"] is False
    assert any("buyer: diluted share count is missing" in d for d in res["diagnostics"])


def test_missing_target_shares(synthetic_buyer):
    res = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target={"net_income": 300.0, "diluted_shares": None, "share_price": 40.0},
    )
    assert res["standalone"]["target_eps"] is None
    assert any("target: diluted share count is missing" in d for d in res["diagnostics"])


def test_neutral_accretion_dilution_status(synthetic_buyer, synthetic_target):
    # When Target PE == Buyer PE and funded 100% stock at buyer price with 0 synergies, EPS change is 0.0
    # Buyer EPS = 10.0 (1000 / 100), Target EPS = 6.0 (300 / 50)
    # If buyer buys target at PE = 10.0 (Equity value = 3000), issues 60 shares at 50 Rs.
    # Total NI = 1300, Total shares = 160 -> EPS = 1300 / 160 = 8.125 (dilutive)
    # But if break-even synergy is added:
    be = calculate_break_even_synergies(
        buyer_standalone_eps=10.0,
        pro_forma_shares=110.0,
        buyer_net_income=1000.0,
        target_net_income=100.0,
        after_tax_debt_interest=0.0,
        after_tax_foregone_interest=0.0,
        tax_rate=0.25,
        shares_is_raw=False,
    )
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": 100.0, "share_price": 50.0},
        target={"net_income": 100.0, "diluted_shares": 50.0, "share_price": 40.0},
        stock_consideration_value=500.0,  # 10 shares -> 110 shares total
        synergy_year_1=be["break_even_gross_synergy"],
        tax_rate=0.25,
    )
    assert res["pro_forma"]["years"]["year_1"]["status"] == "NEUTRAL"
    assert abs(res["pro_forma"]["years"]["year_1"]["eps_change"]) < 1e-4


def test_missing_buyer_share_price_when_stock_consideration_positive(synthetic_target):
    res = calculate_accretion_dilution(
        buyer={"net_income": 1000.0, "diluted_shares": 100.0, "share_price": None},
        target=synthetic_target,
        stock_consideration_value=500.0,
    )
    assert res["is_available"] is False
    assert any("buyer: share price is missing" in d for d in res["diagnostics"])


def test_zero_or_negative_shares_handling():
    assert calculate_standalone_eps(1000.0, 0.0) is None
    assert calculate_standalone_eps(1000.0, -50.0) is None


def test_invalid_tax_rate_raises():
    with pytest.raises(ValueError, match="tax_rate"):
        calculate_accretion_dilution(buyer={}, target={}, tax_rate=1.0)
    with pytest.raises(ValueError, match="tax_rate"):
        calculate_accretion_dilution(buyer={}, target={}, tax_rate=-0.05)


def test_invalid_interest_rate_raises():
    with pytest.raises(ValueError, match="debt_interest_rate"):
        calculate_accretion_dilution(buyer={}, target={}, debt_interest_rate=-0.02)
    with pytest.raises(ValueError, match="foregone_cash_interest_rate"):
        calculate_accretion_dilution(buyer={}, target={}, foregone_cash_interest_rate=-0.01)


# ---------------------------------------------------------------------------
# 9. Executable Cash Constraint (Phase 7 Cash Capping)
# ---------------------------------------------------------------------------

def test_buyer_cash_constraint_uses_executable_cash():
    """Foregone interest must reflect actual executable cash, not unfeasible requested cash."""
    buyer = {"net_income": 1000.0, "diluted_shares": 100.0, "share_price": 50.0, "cash": 200.0}
    target = {"net_income": 300.0, "diluted_shares": 50.0, "share_price": 40.0}

    # Simulate Phase 7 Sources & Uses where acquirer cash is capped at 200 Cr
    su = {
        "sources": {
            "acquirer_cash": 200.0,    # Capped at available cash (200 Cr)
            "new_debt": 500.0,
            "stock_issuance": 500.0,
        }
    }

    res = calculate_accretion_dilution(
        buyer=buyer,
        target=target,
        sources_uses=su,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.25,
    )

    # Foregone interest should be 200 * 0.05 = 10.0, not based on 500 Cr requested
    assert res["financing"]["buyer_cash_used"] == 200.0
    assert res["financing"]["foregone_interest"] == 10.0


# ---------------------------------------------------------------------------
# 10. Phase 6 & Phase 7 Integration
# ---------------------------------------------------------------------------

def test_phase6_deal_and_phase7_sources_uses_integration(synthetic_buyer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_buyer,
        target=synthetic_target,
        purchase_equity_value=2000.0,
        cash_pct=0.20,
        debt_pct=0.50,
        stock_pct=0.30,
        expected_annual_synergies=100.0,
    )
    su = build_sources_and_uses(deal)

    res = calculate_accretion_dilution(
        buyer=deal["acquirer"],
        target=deal["target"],
        deal=deal,
        sources_uses=su,
        tax_rate=0.25,
    )

    assert res["is_available"] is True
    assert res["financing"]["new_debt"] == su["sources"]["new_debt"]
    assert res["financing"]["buyer_cash_used"] == su["sources"]["acquirer_cash"]
    assert res["financing"]["stock_consideration_value"] == su["sources"]["stock_issuance"]
    assert res["synergies"]["gross_year_3"] == 100.0


# ---------------------------------------------------------------------------
# 11. Real-Data Regression: TCS acquiring Infosys
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_REAL_DATA_AVAILABLE = (_DATA_DIR / "financials.csv").exists()


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_real_data_tcs_acquiring_infosys():
    """End-to-end integration on real production data: TCS acquiring Infosys."""
    companies = pd.read_csv(_DATA_DIR / "companies.csv")
    financials = pd.read_csv(_DATA_DIR / "financials.csv")
    sectors = pd.read_csv(_DATA_DIR / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    res = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        acquisition_premium=0.20,
        cash_pct=0.02,
        debt_pct=0.60,
        stock_pct=0.38,
        expected_annual_synergies=2000.0,
        debt_interest_rate=0.08,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.25,
    )

    assert res["is_available"] is True

    # Standalone checks
    assert abs(res["standalone"]["buyer_eps"] - 136.01) < 0.1
    assert abs(res["standalone"]["target_eps"] - 72.75) < 0.1

    # Pro-forma shares increased by newly issued shares
    assert res["pro_forma"]["new_shares_issued"] > 0.0
    assert res["pro_forma"]["pro_forma_shares"] > res["buyer"]["diluted_shares"]

    # Projection years present
    y1 = res["pro_forma"]["years"]["year_1"]
    y2 = res["pro_forma"]["years"]["year_2"]
    y3 = res["pro_forma"]["years"]["year_3"]

    assert y1["pro_forma_eps"] > 0.0
    assert y2["pro_forma_eps"] > y1["pro_forma_eps"]  # Synergies increase over time
    assert y3["pro_forma_eps"] > y2["pro_forma_eps"]

    # Break-even synergy is calculated
    be1 = res["break_even"]["year_1"]
    assert be1["break_even_gross_synergy"] > 0.0


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_financing_mix_propagation_changes_financing_structure():
    """Verify that changing cash_pct, debt_pct, and stock_pct actually alters financing and shares."""
    companies = pd.read_csv(_DATA_DIR / "companies.csv")
    financials = pd.read_csv(_DATA_DIR / "financials.csv")
    sectors = pd.read_csv(_DATA_DIR / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    res_default = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
    )

    res_alt = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        cash_pct=0.02,
        debt_pct=0.60,
        stock_pct=0.38,
    )

    # Debt should differ significantly
    assert res_alt["financing"]["new_debt"] != res_default["financing"]["new_debt"]
    assert res_alt["financing"]["new_debt"] > res_default["financing"]["new_debt"]

    # Stock consideration and pro-forma shares should differ
    assert res_alt["financing"]["stock_consideration_value"] != res_default["financing"]["stock_consideration_value"]
    assert res_alt["pro_forma"]["pro_forma_shares"] != res_default["pro_forma"]["pro_forma_shares"]
    assert res_alt["pro_forma"]["pro_forma_shares"] > res_default["pro_forma"]["pro_forma_shares"]

    # Resulting EPS and accretion/dilution must differ
    y1_def = res_default["pro_forma"]["years"]["year_1"]
    y1_alt = res_alt["pro_forma"]["years"]["year_1"]
    assert y1_def["pro_forma_eps"] != y1_alt["pro_forma_eps"]
    assert y1_def["accretion_dilution_pct"] != y1_alt["accretion_dilution_pct"]


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_rate_changes_affect_calculations():
    """Verify that debt-rate, cash-yield, and tax-rate affect the correct calculations."""
    companies = pd.read_csv(_DATA_DIR / "companies.csv")
    financials = pd.read_csv(_DATA_DIR / "financials.csv")
    sectors = pd.read_csv(_DATA_DIR / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    base = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        cash_pct=0.02,
        debt_pct=0.60,
        stock_pct=0.38,
        debt_interest_rate=0.08,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.25,
    )

    # 1. Higher debt interest rate -> higher interest expense, lower pro-forma EPS
    higher_debt_rate = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        cash_pct=0.02,
        debt_pct=0.60,
        stock_pct=0.38,
        debt_interest_rate=0.12,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.25,
    )
    assert higher_debt_rate["financing"]["debt_interest"] > base["financing"]["debt_interest"]
    assert (
        higher_debt_rate["pro_forma"]["years"]["year_1"]["pro_forma_eps"]
        < base["pro_forma"]["years"]["year_1"]["pro_forma_eps"]
    )

    # 2. Higher cash yield -> higher foregone interest, lower pro-forma EPS
    higher_cash_yield = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        cash_pct=0.02,
        debt_pct=0.60,
        stock_pct=0.38,
        debt_interest_rate=0.08,
        foregone_cash_interest_rate=0.10,
        tax_rate=0.25,
    )
    assert higher_cash_yield["financing"]["foregone_interest"] > base["financing"]["foregone_interest"]
    assert (
        higher_cash_yield["pro_forma"]["years"]["year_1"]["pro_forma_eps"]
        < base["pro_forma"]["years"]["year_1"]["pro_forma_eps"]
    )

    # 3. Higher tax rate -> greater interest tax shield (lower after-tax debt interest)
    higher_tax_rate = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        cash_pct=0.02,
        debt_pct=0.60,
        stock_pct=0.38,
        debt_interest_rate=0.08,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.30,
    )
    assert higher_tax_rate["financing"]["after_tax_debt_interest"] < base["financing"]["after_tax_debt_interest"]


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_synergy_overrides_propagate_correctly():
    """Verify that explicit synergy_year_1/2/3 overrides propagate into pro-forma years."""
    companies = pd.read_csv(_DATA_DIR / "companies.csv")
    financials = pd.read_csv(_DATA_DIR / "financials.csv")
    sectors = pd.read_csv(_DATA_DIR / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    res = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        cash_pct=0.02,
        debt_pct=0.60,
        stock_pct=0.38,
        synergy_year_1=1000.0,
        synergy_year_2=1500.0,
        synergy_year_3=2500.0,
    )

    assert res["pro_forma"]["years"]["year_1"]["gross_synergy"] == 1000.0
    assert res["pro_forma"]["years"]["year_2"]["gross_synergy"] == 1500.0
    assert res["pro_forma"]["years"]["year_3"]["gross_synergy"] == 2500.0
    assert res["pro_forma"]["years"]["year_1"]["after_tax_synergy"] == 750.0  # 1000 * (1 - 0.25)


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_phase7_validated_scenario_matches_executable_financing():
    """Verify Phase 8 consumes exact executable financing matching the Phase 7 validated scenario."""
    companies = pd.read_csv(_DATA_DIR / "companies.csv")
    financials = pd.read_csv(_DATA_DIR / "financials.csv")
    sectors = pd.read_csv(_DATA_DIR / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    res = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        acquisition_premium=0.20,
        cash_pct=0.02,
        debt_pct=0.60,
        stock_pct=0.38,
        transaction_fees=500.0,
        refinance_target_debt=True,
        use_target_cash=True,
        debt_issuance_fee_pct=0.02,
        minimum_cash_balance=1000.0,
        debt_interest_rate=0.08,
        foregone_cash_interest_rate=0.05,
        tax_rate=0.25,
        expected_annual_synergies=2000.0,
    )

    # Phase 7 validated values:
    # Acquirer Existing Cash: ₹10,908.0 Cr
    # New Debt Financing:     ₹327,240.5 Cr
    # Stock Consideration:    ₹207,252.3 Cr
    assert abs(res["financing"]["buyer_cash_used"] - 10908.0) < 1.0
    assert abs(res["financing"]["new_debt"] - 327240.5) < 1.0
    assert abs(res["financing"]["stock_consideration_value"] - 207252.3) < 1.0
    assert res["is_feasible"] is True
    assert res["pro_forma"]["years"]["year_1"]["status"] == "DILUTIVE"


# ---------------------------------------------------------------------------
# 12. Feasible vs Infeasible Transaction Accretion/Dilution Labeling
# ---------------------------------------------------------------------------

def test_feasible_transaction_preserves_accretive_dilutive_labels(synthetic_buyer, synthetic_target):
    """Feasible transactions must preserve standard [ACCRETIVE] / [DILUTIVE] labels."""
    # Feasible accretive deal: cash used (200 Cr) < buyer cash (800 Cr)
    res_acc = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target=synthetic_target,
        stock_consideration_value=200.0,
        new_debt=100.0,
        buyer_cash_used=200.0,
        synergy_year_1=100.0,
        tax_rate=0.25,
    )
    assert res_acc["is_feasible"] is True
    y1_acc = res_acc["pro_forma"]["years"]["year_1"]
    assert y1_acc["status"] == "ACCRETIVE"
    assert y1_acc["is_feasible"] is True

    # Feasible dilutive deal: cash used (100 Cr) < buyer cash (800 Cr)
    res_dil = calculate_accretion_dilution(
        buyer=synthetic_buyer,
        target=synthetic_target,
        stock_consideration_value=1500.0,
        new_debt=1000.0,
        buyer_cash_used=100.0,
        debt_interest_rate=0.12,
        synergy_year_1=0.0,
        tax_rate=0.25,
    )
    assert res_dil["is_feasible"] is True
    y1_dil = res_dil["pro_forma"]["years"]["year_1"]
    assert y1_dil["status"] == "DILUTIVE"
    assert y1_dil["is_feasible"] is True


def test_infeasible_transaction_marked_non_executable_illustrative():
    """Infeasible transactions must preserve calculations but mark status non-executable/illustrative."""
    # Buyer has 100 Cr cash, but deal requires 500 Cr cash
    buyer = {
        "company_id": "CashPoorBuyer",
        "net_income": 1000.0,
        "diluted_shares": 100.0,
        "share_price": 50.0,
        "cash": 100.0,
    }
    target = {
        "company_id": "TargetCo",
        "net_income": 200.0,
        "diluted_shares": 50.0,
        "share_price": 30.0,
    }

    su_infeasible = {
        "sources": {
            "acquirer_cash": 100.0,       # Capped executable
            "new_debt": 200.0,
            "stock_issuance": 300.0,
        },
        "reconciliation": {
            "is_feasible": False,
            "sources_uses_balanced": False,
        },
        "warnings": [
            "feasibility: financing structure is INFEASIBLE. Acquirer cash required (Rs 500.0 Cr) exceeds available acquirer cash (Rs 100.0 Cr)."
        ],
    }

    res = calculate_accretion_dilution(
        buyer=buyer,
        target=target,
        sources_uses=su_infeasible,
        synergy_year_1=50.0,
        tax_rate=0.25,
    )

    # 1. Feasibility flag is False
    assert res["is_feasible"] is False
    assert res["financing"]["is_feasible"] is False

    # 2. Financial calculations are NOT suppressed / deleted
    y1 = res["pro_forma"]["years"]["year_1"]
    assert y1["pro_forma_eps"] is not None
    assert y1["pro_forma_eps"] > 0.0
    assert y1["accretion_dilution_pct"] is not None
    assert y1["is_feasible"] is False

    # 3. Result is NOT simply [ACCRETIVE] or [DILUTIVE]
    assert y1["status"] not in ("ACCRETIVE", "DILUTIVE")
    assert y1["status"] == "NON-EXECUTABLE / ILLUSTRATIVE"

    # 4. Underlying modelled direction is preserved
    assert y1["modelled_status"] in ("ACCRETIVE", "DILUTIVE", "NEUTRAL")

    # 5. Explanatory diagnostic present with preferred terminology
    assert any("Requested / Illustrative Structure" in d for d in res["diagnostics"])
    assert any("Executable Transaction" in d for d in res["diagnostics"])
    # Existing feasibility warnings must remain
    assert any("INFEASIBLE" in d for d in res["diagnostics"])


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_tcs_infosys_default_infeasible_labeled_illustrative():
    """TCS -> Infosys default 50% cash structure is infeasible and must be labeled illustrative."""
    companies = pd.read_csv(_DATA_DIR / "companies.csv")
    financials = pd.read_csv(_DATA_DIR / "financials.csv")
    sectors = pd.read_csv(_DATA_DIR / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    res = calculate_accretion_dilution_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
    )

    assert res["is_feasible"] is False
    y1 = res["pro_forma"]["years"]["year_1"]
    assert y1["status"] == "NON-EXECUTABLE / ILLUSTRATIVE"
    assert y1["status"] not in ("ACCRETIVE", "DILUTIVE")
    assert y1["pro_forma_eps"] is not None
    assert y1["accretion_dilution_pct"] is not None
    assert y1["modelled_status"] == "ACCRETIVE"
    assert any("Requested / Illustrative Structure" in d for d in res["diagnostics"])


