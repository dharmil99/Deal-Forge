"""
test_sources_uses.py

Unit and regression tests for Phase 7: Sources & Uses (analytics/sources_uses.py).

Tests are organized into:
  1. Sources = Uses Exact Balance & Tolerances
  2. Consideration Modes (All-Cash, All-Stock, Mixed 50/30/20)
  3. Target Debt Treatment (Rollover vs Refinancing vs Unknown Debt Error)
  4. Debt Issuance Fees
  5. Cash Reconciliation & Liquidity Constraints (Depletion & Minimum Buffer Warnings)
  6. Target Cash Sweep & Unknown Cash Handling
  7. Other Uses & Other Sources
  8. Missing Data Non-Zero Integrity
  9. Real-Data Regressions (TCS acquiring Infosys: infeasible vs feasible, debt refinancing, cash sweep, capping, no plug)
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from analytics.deal_model import build_deal
from analytics.sources_uses import (
    build_sources_and_uses,
    build_sources_and_uses_from_universe,
    calculate_financing_fees,
    reconcile_pro_forma_cash,
)
from analytics.screening import compute_metrics


# ---------------------------------------------------------------------------
# Synthetic Test Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def synthetic_acquirer():
    return {
        "company_id": "AcquirerCo",
        "company_name": "Acquirer Corporation",
        "revenue": 5000.0,
        "ebitda": 1200.0,
        "net_income": 800.0,
        "market_cap": 15000.0,
        "cash": 4000.0,
        "total_debt": 1000.0,
        "shares_outstanding": 1e8,
        "current_price": 150.0,
        "eps": 8.0,
    }


@pytest.fixture
def synthetic_target():
    return {
        "company_id": "TargetCo",
        "company_name": "Target Enterprise",
        "revenue": 1000.0,
        "ebitda": 250.0,
        "net_income": 150.0,
        "enterprise_value": 4500.0,
        "equity_value": 4000.0,
        "net_debt": 500.0,
        "cash": 300.0,
        "total_debt": 800.0,
        "shares_outstanding": 4e7,
        "current_price": 100.0,
        "eps": 3.75,
    }


@pytest.fixture
def synthetic_deal_no_fees(synthetic_acquirer, synthetic_target):
    """Clean deal with zero fees to test natural balance."""
    return build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=5000.0,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
        transaction_fees=0.0,
    )


@pytest.fixture
def synthetic_deal_with_fees(synthetic_acquirer, synthetic_target):
    return build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=5000.0,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
        transaction_fees=150.0,
    )


# ---------------------------------------------------------------------------
# 1. Sources = Uses Exact Balance & Tolerance
# ---------------------------------------------------------------------------

def test_sources_uses_exact_balance(synthetic_deal_no_fees):
    """When sources equal uses exactly, difference is zero and balanced is True."""
    su = build_sources_and_uses(synthetic_deal_no_fees)
    rec = su["reconciliation"]
    assert rec["sources_uses_balanced"] is True
    assert abs(rec["difference"]) < 1e-4
    assert su["uses"]["total_uses"] == 5000.0
    assert su["sources"]["total_sources"] == 5000.0


def test_sources_uses_reconciliation_tolerance(synthetic_deal_no_fees):
    """Difference strictly within tolerance (1e-4) is balanced; outside is not."""
    # Balanced default
    su_balanced = build_sources_and_uses(synthetic_deal_no_fees)
    assert su_balanced["reconciliation"]["sources_uses_balanced"] is True

    # Slightly unbalanced by explicit override within 1e-4 tolerance
    su_within = build_sources_and_uses(synthetic_deal_no_fees, new_debt=1500.00005)
    assert su_within["reconciliation"]["sources_uses_balanced"] is True

    # Unbalanced by 1.0 (outside 1e-4)
    su_unbalanced = build_sources_and_uses(synthetic_deal_no_fees, new_debt=1501.0)
    assert su_unbalanced["reconciliation"]["sources_uses_balanced"] is False
    assert abs(su_unbalanced["reconciliation"]["difference"] - 1.0) < 1e-4


# ---------------------------------------------------------------------------
# 2. Consideration Modes (All-Cash, All-Stock, Mixed 50/30/20)
# ---------------------------------------------------------------------------

def test_all_cash_deal_sources_uses(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=4000.0,
        cash_pct=1.0,
        debt_pct=0.0,
        stock_pct=0.0,
        transaction_fees=0.0,
    )
    su = build_sources_and_uses(deal)
    assert su["sources"]["acquirer_cash"] == 4000.0
    assert su["sources"]["new_debt"] == 0.0
    assert su["sources"]["stock_issuance"] == 0.0
    assert su["uses"]["purchase_equity_value"] == 4000.0
    assert su["reconciliation"]["sources_uses_balanced"] is True


def test_all_stock_deal_sources_uses(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=4000.0,
        cash_pct=0.0,
        debt_pct=0.0,
        stock_pct=1.0,
        transaction_fees=0.0,
    )
    su = build_sources_and_uses(deal)
    assert su["sources"]["acquirer_cash"] == 0.0
    assert su["sources"]["new_debt"] == 0.0
    assert su["sources"]["stock_issuance"] == 4000.0
    assert su["uses"]["purchase_equity_value"] == 4000.0
    assert su["reconciliation"]["sources_uses_balanced"] is True


def test_mixed_50_30_20_financing_sources_uses(synthetic_deal_no_fees):
    su = build_sources_and_uses(synthetic_deal_no_fees)
    s = su["sources"]
    u = su["uses"]
    assert s["acquirer_cash"] == 2500.0
    assert s["new_debt"] == 1500.0
    assert s["stock_issuance"] == 1000.0
    assert u["purchase_equity_value"] == 5000.0
    assert su["reconciliation"]["sources_uses_balanced"] is True


# ---------------------------------------------------------------------------
# 3. Target Debt Treatment (Rollover vs Refinancing vs Unknown Debt Error)
# ---------------------------------------------------------------------------

def test_target_debt_rollover_not_included_in_uses(synthetic_deal_no_fees):
    """When refinance_target_debt=False, target debt is assumed/rolled over and NOT a cash use."""
    su = build_sources_and_uses(synthetic_deal_no_fees, refinance_target_debt=False)
    assert su["uses"]["target_debt_refinancing"] == 0.0
    assert su["uses"]["total_uses"] == 5000.0


def test_target_debt_refinancing_included_in_uses(synthetic_deal_no_fees):
    """When refinance_target_debt=True, target debt (800 Cr) is added to Uses and funded."""
    su = build_sources_and_uses(
        synthetic_deal_no_fees,
        refinance_target_debt=True,
    )
    assert su["uses"]["target_debt_refinancing"] == 800.0
    assert su["uses"]["total_uses"] == 5800.0
    assert su["sources"]["total_sources"] == 5800.0
    assert su["reconciliation"]["sources_uses_balanced"] is True


def test_unknown_target_debt_raises_value_error_when_refinancing(synthetic_acquirer):
    """If target debt is unknown/None, refinance_target_debt=True must raise ValueError."""
    tgt_unknown_debt = {
        "company_id": "TargetNoDebtInfo",
        "equity_value": 4000.0,
        "total_debt": None,
        "net_debt": None,
        "cash": None,
    }
    deal = build_deal(acquirer=synthetic_acquirer, target=tgt_unknown_debt, purchase_equity_value=4000.0)
    with pytest.raises(ValueError, match="Cannot refinance target debt"):
        build_sources_and_uses(deal, refinance_target_debt=True)


# ---------------------------------------------------------------------------
# 4. Debt Issuance Fees
# ---------------------------------------------------------------------------

def test_calculate_financing_fees():
    """2% fee on 1500 Cr new debt = 30 Cr."""
    fees = calculate_financing_fees(1500.0, 0.02)
    assert abs(fees - 30.0) < 1e-4


def test_calculate_financing_fees_negative_raises():
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_financing_fees(-100.0, 0.02)
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_financing_fees(100.0, -0.01)


def test_debt_issuance_fees_in_sources_uses(synthetic_deal_no_fees):
    """Debt issuance fee is added to Uses and funded via the Net Funding Requirement."""
    su = build_sources_and_uses(
        synthetic_deal_no_fees,
        debt_issuance_fee_pct=0.02,
    )
    assert su["uses"]["debt_issuance_fees"] > 0.0
    assert su["reconciliation"]["sources_uses_balanced"] is True
    assert abs(su["reconciliation"]["difference"]) < 1e-4


# ---------------------------------------------------------------------------
# 5. Cash Reconciliation & Liquidity Constraints
# ---------------------------------------------------------------------------

def test_reconcile_pro_forma_cash_normal():
    res = reconcile_pro_forma_cash(
        acquirer_cash=4000.0,
        target_cash=300.0,
        cash_sources=2500.0,
        min_buffer=500.0,
    )
    assert res["pre_deal_acquirer_cash"] == 4000.0
    assert res["pro_forma_acquirer_cash"] == 1500.0
    assert res["pro_forma_combined_cash"] == 1800.0
    assert len(res["warnings"]) == 0


def test_cash_depletion_warning(synthetic_deal_no_fees):
    """Acquirer cash is 4000 Cr; if cash contribution is 4500 Cr, warning triggers."""
    su = build_sources_and_uses(
        synthetic_deal_no_fees,
        acquirer_cash=4500.0,
    )
    assert any("exceeds pre-deal acquirer cash balance" in w for w in su["warnings"])
    assert su["cash_reconciliation"]["cash_deficit"] == 500.0


def test_minimum_cash_balance_warning(synthetic_deal_no_fees):
    """Acquirer cash 4000 - 2500 used = 1500 remaining. If min_buffer is 2000, warning triggers."""
    su = build_sources_and_uses(
        synthetic_deal_no_fees,
        minimum_cash_balance=2000.0,
    )
    assert any("falls below minimum required cash buffer" in w for w in su["warnings"])
    assert su["cash_reconciliation"]["buffer_shortfall"] == 500.0


# ---------------------------------------------------------------------------
# 6. Target Cash Sweep & Unknown Cash Handling
# ---------------------------------------------------------------------------

def test_target_cash_sweep_included_in_sources(synthetic_deal_no_fees):
    """Target cash of 300 Cr is swept into Sources when use_target_cash=True."""
    su = build_sources_and_uses(
        synthetic_deal_no_fees,
        use_target_cash=True,
    )
    assert su["sources"]["target_cash_sweep"] == 300.0
    assert su["cash_reconciliation"]["target_cash_used"] == 300.0
    assert su["cash_reconciliation"]["pro_forma_target_cash_remaining"] == 0.0
    # Net funding requirement reduced by sweep
    assert su["funding_base"]["net_funding_requirement"] == 4700.0
    assert su["reconciliation"]["sources_uses_balanced"] is True


def test_unknown_target_cash_does_not_silently_become_zero(synthetic_acquirer):
    """When target cash is None and use_target_cash=True, records diagnostic warning."""
    tgt_unknown_cash = {
        "company_id": "TargetNoCash",
        "equity_value": 4000.0,
        "cash": None,
        "total_debt": 500.0,
        "net_debt": 500.0,
    }
    deal = build_deal(acquirer=synthetic_acquirer, target=tgt_unknown_cash, purchase_equity_value=4000.0)
    su = build_sources_and_uses(deal, use_target_cash=True)
    assert su["sources"]["target_cash_sweep"] == 0.0
    assert any("target cash is unknown/None" in w for w in su["warnings"])


# ---------------------------------------------------------------------------
# 7. Other Uses & Other Sources
# ---------------------------------------------------------------------------

def test_other_uses_and_other_sources(synthetic_deal_no_fees):
    su = build_sources_and_uses(
        synthetic_deal_no_fees,
        other_uses=200.0,
        other_sources=200.0,
    )
    assert su["uses"]["other_uses"] == 200.0
    assert su["sources"]["other_sources"] == 200.0
    assert su["uses"]["total_uses"] == 5200.0
    assert su["sources"]["total_sources"] == 5200.0
    assert su["reconciliation"]["sources_uses_balanced"] is True


def test_negative_other_uses_or_sources_raises(synthetic_deal_no_fees):
    with pytest.raises(ValueError, match="cannot be negative"):
        build_sources_and_uses(synthetic_deal_no_fees, other_uses=-50.0)
    with pytest.raises(ValueError, match="cannot be negative"):
        build_sources_and_uses(synthetic_deal_no_fees, other_sources=-50.0)


# ---------------------------------------------------------------------------
# 8. Missing Data Non-Zero Integrity
# ---------------------------------------------------------------------------

def test_missing_acquirer_cash_preserves_none(synthetic_target):
    acq_no_cash = {
        "company_id": "AcqNoCash",
        "market_cap": 10000.0,
        "cash": None,
    }
    deal = build_deal(acquirer=acq_no_cash, target=synthetic_target, purchase_equity_value=4000.0)
    su = build_sources_and_uses(deal)
    assert su["cash_reconciliation"]["pre_deal_acquirer_cash"] is None
    assert su["cash_reconciliation"]["pro_forma_acquirer_cash"] is None
    assert any("pre-deal acquirer cash is unknown" in w for w in su["warnings"])


# ---------------------------------------------------------------------------
# 9. Real Data Regressions (TCS acquiring Infosys)
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_REAL_DATA_AVAILABLE = (_DATA_DIR / "financials.csv").exists()


@pytest.fixture(scope="module")
def tcs_infosys_universe():
    if not _REAL_DATA_AVAILABLE:
        pytest.skip("data/ directory not present")
    companies = pd.read_csv(_DATA_DIR / "companies.csv")
    financials = pd.read_csv(_DATA_DIR / "financials.csv")
    sectors = pd.read_csv(_DATA_DIR / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)
    return metrics, financials


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_tcs_infosys_acquirer_cash_capped_and_marked_infeasible(tcs_infosys_universe):
    """Default 50/30/20 mix requires ~271k Cr cash; TCS has only 12,908 Cr -> infeasible."""
    metrics, financials = tcs_infosys_universe
    su = build_sources_and_uses_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        acquisition_premium=0.20,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
        transaction_fees=500.0,
        refinance_target_debt=True,
        use_target_cash=True,
        debt_issuance_fee_pct=0.02,
        minimum_cash_balance=1000.0,
    )

    s = su["sources"]
    rec = su["reconciliation"]
    crec = su["cash_reconciliation"]

    # 1. Acquirer cash is capped at actual available balance (12,908 Cr), NEVER 270k+ Cr
    assert s["acquirer_cash"] == 12908.0

    # 2. Transaction is marked infeasible
    assert rec["is_feasible"] is False
    assert rec["sources_uses_balanced"] is False
    assert "INFEASIBLE" in rec["status"]

    # 3. Exact funding shortfall is reported
    assert rec["funding_shortfall"] > 250000.0
    assert abs(rec["difference"] - (-rec["funding_shortfall"])) < 1e-4

    # 4. Pro-forma cash is NOT negative
    assert crec["pro_forma_acquirer_cash"] == 0.0
    assert crec["cash_deficit"] > 250000.0


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_tcs_infosys_debt_refinancing_and_cash_sweep(tcs_infosys_universe):
    """Target debt (9,176 Cr) is a Use when refinanced, and target cash (22,201 Cr) is swept."""
    metrics, financials = tcs_infosys_universe
    su = build_sources_and_uses_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        acquisition_premium=0.20,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
        transaction_fees=500.0,
        refinance_target_debt=True,
        use_target_cash=True,
        debt_issuance_fee_pct=0.02,
    )

    u = su["uses"]
    s = su["sources"]
    fb = su["funding_base"]

    assert u["target_debt_refinancing"] == 9176.0
    assert s["target_cash_sweep"] == 22201.0
    assert fb["target_cash_sweep"] == 22201.0
    assert fb["gross_uses_ex_debt_fees"] == u["purchase_equity_value"] + 9176.0 + 500.0


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_tcs_infosys_no_unexplained_plug(tcs_infosys_universe):
    """The requested funding structure balances Total Uses to 0.0 difference without any plug."""
    metrics, financials = tcs_infosys_universe
    su = build_sources_and_uses_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        acquisition_premium=0.20,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
        transaction_fees=500.0,
        refinance_target_debt=True,
        use_target_cash=True,
        debt_issuance_fee_pct=0.02,
    )

    req = su["requested_financing"]
    u = su["uses"]

    # Requested sources match Total Uses exactly
    assert abs(req["total_requested_sources"] - u["total_uses"]) < 1e-4


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_tcs_infosys_feasible_balanced_scenario(tcs_infosys_universe):
    """When cash required <= 12,908 Cr, transaction is BALANCED & EXECUTABLE with diff == 0.0."""
    metrics, financials = tcs_infosys_universe
    # 2% cash of ~540k Cr Net Funding Requirement is ~10,908 Cr <= 12,908 Cr
    su = build_sources_and_uses_from_universe(
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
    )

    rec = su["reconciliation"]
    crec = su["cash_reconciliation"]

    assert rec["is_feasible"] is True
    assert rec["sources_uses_balanced"] is True
    assert abs(rec["difference"]) < 1e-4
    assert rec["status"] == "BALANCED & EXECUTABLE"
    assert crec["pro_forma_acquirer_cash"] >= 1000.0
