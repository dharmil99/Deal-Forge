"""
test_deal_model.py

Unit and regression tests for Phase 6: Deal Builder (analytics/deal_model.py).

Tests are organized into:
  1. Basic deal creation & dictionary structure
  2. Purchase price & acquisition premium logic
  3. Transaction enterprise value (positive debt, net cash, missing debt)
  4. Financing mix validation & funding amounts
  5. Synergy ramp calculations
  6. Data integrity, warnings, & missing data handling
  7. Real-data universe integration (TCS / Infosys)
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from analytics.deal_model import build_deal, build_deal_from_universe, extract_company_profile
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
        "cash": 2000.0,
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
        "shares_outstanding": 4e7,
        "current_price": 100.0,
        "eps": 3.75,
    }


# ---------------------------------------------------------------------------
# 1. Basic Deal Creation & Output Structure
# ---------------------------------------------------------------------------

def test_basic_deal_creation(synthetic_acquirer, synthetic_target):
    """Deal dictionary must contain all required top-level sections."""
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        acquisition_premium=0.20,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
    )
    for section in ("acquirer", "target", "transaction", "financing", "synergies", "warnings"):
        assert section in deal, f"Missing section: {section}"

    assert deal["acquirer"]["company_id"] == "AcquirerCo"
    assert deal["target"]["company_id"] == "TargetCo"


def test_transaction_section_fields(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        acquisition_premium=0.25,
    )
    txn = deal["transaction"]
    expected_fields = (
        "target_standalone_equity_value",
        "acquisition_premium",
        "purchase_equity_value",
        "offer_price_per_share",
        "target_net_debt",
        "transaction_enterprise_value",
        "transaction_fees",
        "total_transaction_value",
    )
    for field in expected_fields:
        assert field in txn, f"Missing transaction field: {field}"


def test_financing_section_fields(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        acquisition_premium=0.20,
        cash_pct=0.60,
        debt_pct=0.20,
        stock_pct=0.20,
    )
    fin = deal["financing"]
    expected_fields = (
        "funding_amount",
        "cash_pct",
        "debt_pct",
        "stock_pct",
        "cash_amount",
        "debt_amount",
        "stock_amount",
        "stock_consideration_value",
        "new_debt_amount",
    )
    for field in expected_fields:
        assert field in fin, f"Missing financing field: {field}"


# ---------------------------------------------------------------------------
# 2. Purchase Price & Acquisition Premium Logic
# ---------------------------------------------------------------------------

def test_purchase_equity_value_derived_from_premium(synthetic_acquirer, synthetic_target):
    """Target equity 4000 + 25% premium = 5000 purchase equity value."""
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        acquisition_premium=0.25,
    )
    txn = deal["transaction"]
    assert abs(txn["purchase_equity_value"] - 5000.0) < 1e-4
    assert abs(txn["acquisition_premium"] - 0.25) < 1e-4


def test_explicit_purchase_equity_value_takes_precedence(synthetic_acquirer, synthetic_target):
    """Explicit purchase price of 6000 overrides premium; implied premium is (6000/4000) - 1 = 50%."""
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=6000.0,
        acquisition_premium=0.20,  # Deliberately conflicting
    )
    txn = deal["transaction"]
    assert txn["purchase_equity_value"] == 6000.0
    assert abs(txn["acquisition_premium"] - 0.50) < 1e-4
    # Should warn about override
    assert any("overrides" in w.lower() for w in deal["warnings"])


def test_explicit_purchase_equity_value_without_premium(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=4800.0,
    )
    txn = deal["transaction"]
    assert txn["purchase_equity_value"] == 4800.0
    assert abs(txn["acquisition_premium"] - 0.20) < 1e-4


def test_offer_price_per_share_calculation(synthetic_acquirer, synthetic_target):
    """Purchase equity 5000 Cr, shares 4e7 -> 5000 * 1e7 / 4e7 = 1250 Rs/share."""
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=5000.0,
    )
    assert abs(deal["transaction"]["offer_price_per_share"] - 1250.0) < 1e-4


def test_missing_target_equity_and_no_purchase_price_raises_error(synthetic_acquirer):
    target_no_equity = {"company_id": "TargetNoEq"}
    with pytest.raises(ValueError, match="Cannot determine purchase_equity_value"):
        build_deal(acquirer=synthetic_acquirer, target=target_no_equity)


def test_negative_purchase_equity_value_raises_error(synthetic_acquirer, synthetic_target):
    with pytest.raises(ValueError, match="must be positive"):
        build_deal(acquirer=synthetic_acquirer, target=synthetic_target, purchase_equity_value=-100.0)


def test_negative_premium_generates_discount_warning(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        acquisition_premium=-0.10,
    )
    assert deal["transaction"]["purchase_equity_value"] == 3600.0
    assert any("negative acquisition premium" in w.lower() or "discount" in w.lower() for w in deal["warnings"])


# ---------------------------------------------------------------------------
# 3. Transaction Enterprise Value (TEV) & Net Debt
# ---------------------------------------------------------------------------

def test_transaction_enterprise_value_positive_debt(synthetic_acquirer, synthetic_target):
    """Purchase equity 5000 + target net debt 500 = TEV 5500."""
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=5000.0,
    )
    assert abs(deal["transaction"]["transaction_enterprise_value"] - 5500.0) < 1e-4


def test_transaction_enterprise_value_net_cash(synthetic_acquirer, synthetic_target):
    """Target in net cash position (-200 Cr): Purchase equity 5000 + (-200) = TEV 4800."""
    tgt_net_cash = dict(synthetic_target, net_debt=-200.0)
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=tgt_net_cash,
        purchase_equity_value=5000.0,
    )
    assert abs(deal["transaction"]["transaction_enterprise_value"] - 4800.0) < 1e-4


def test_missing_target_debt_does_not_silently_become_zero(synthetic_acquirer, synthetic_target):
    """When target net_debt is None, TEV must be None and a warning must be emitted."""
    tgt_no_debt = dict(synthetic_target, net_debt=None, total_debt=None, cash=None)
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=tgt_no_debt,
        purchase_equity_value=5000.0,
    )
    assert deal["transaction"]["target_net_debt"] is None
    assert deal["transaction"]["transaction_enterprise_value"] is None
    assert any("net_debt is missing" in w.lower() for w in deal["warnings"])


def test_transaction_fees_and_total_transaction_value(synthetic_acquirer, synthetic_target):
    """Purchase equity 5000 + fees 150 = total transaction value 5150."""
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=5000.0,
        transaction_fees=150.0,
    )
    txn = deal["transaction"]
    assert txn["transaction_fees"] == 150.0
    assert txn["total_transaction_value"] == 5150.0


# ---------------------------------------------------------------------------
# 4. Financing Mix Validation & Consideration Amounts
# ---------------------------------------------------------------------------

def test_financing_mix_sums_to_100_percent(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=5000.0,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
    )
    fin = deal["financing"]
    assert fin["cash_amount"] == 2500.0
    assert fin["debt_amount"] == 1500.0
    assert fin["new_debt_amount"] == 1500.0
    assert fin["stock_amount"] == 1000.0
    assert fin["stock_consideration_value"] == 1000.0


def test_invalid_financing_mix_sum_raises_error(synthetic_acquirer, synthetic_target):
    with pytest.raises(ValueError, match="must sum to exactly 1.0"):
        build_deal(
            acquirer=synthetic_acquirer,
            target=synthetic_target,
            cash_pct=0.50,
            debt_pct=0.50,
            stock_pct=0.20,  # Sum = 1.20
        )


def test_negative_financing_pct_raises_error(synthetic_acquirer, synthetic_target):
    with pytest.raises(ValueError, match="between 0.0 and 1.0"):
        build_deal(
            acquirer=synthetic_acquirer,
            target=synthetic_target,
            cash_pct=-0.10,
            debt_pct=1.10,
            stock_pct=0.0,
        )


def test_all_cash_financing(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=4000.0,
        cash_pct=1.0,
        debt_pct=0.0,
        stock_pct=0.0,
    )
    fin = deal["financing"]
    assert fin["cash_amount"] == 4000.0
    assert fin["debt_amount"] == 0.0
    assert fin["stock_amount"] == 0.0


def test_all_stock_financing(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=4000.0,
        cash_pct=0.0,
        debt_pct=0.0,
        stock_pct=1.0,
    )
    fin = deal["financing"]
    assert fin["cash_amount"] == 0.0
    assert fin["debt_amount"] == 0.0
    assert fin["stock_amount"] == 4000.0
    assert fin["stock_consideration_value"] == 4000.0


# ---------------------------------------------------------------------------
# 5. Synergy Ramp Calculations
# ---------------------------------------------------------------------------

def test_synergy_ramp_default_schedule(synthetic_acquirer, synthetic_target):
    """Annual run-rate 300 Cr: Year 1 = 99 (33%), Year 2 = 201 (67%), Year 3 = 300 (100%)."""
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        expected_annual_synergies=300.0,
    )
    syn = deal["synergies"]
    assert syn["annual_run_rate"] == 300.0
    assert abs(syn["year_1"] - 99.0) < 1e-4
    assert abs(syn["year_2"] - 201.0) < 1e-4
    assert abs(syn["year_3"] - 300.0) < 1e-4


def test_synergy_ramp_custom_schedule(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        expected_annual_synergies=500.0,
        synergy_ramp_year_1=0.25,
        synergy_ramp_year_2=0.75,
        synergy_ramp_year_3=1.0,
    )
    syn = deal["synergies"]
    assert syn["year_1"] == 125.0
    assert syn["year_2"] == 375.0
    assert syn["year_3"] == 500.0


def test_zero_synergies(synthetic_acquirer, synthetic_target):
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        expected_annual_synergies=0.0,
    )
    syn = deal["synergies"]
    assert syn["annual_run_rate"] == 0.0
    assert syn["year_1"] == 0.0
    assert syn["year_2"] == 0.0
    assert syn["year_3"] == 0.0


# ---------------------------------------------------------------------------
# 6. Data Integrity & Diagnostics
# ---------------------------------------------------------------------------

def test_cash_exceeding_acquirer_balance_triggers_warning(synthetic_acquirer, synthetic_target):
    """Acquirer cash is 2000 Cr; cash consideration is 3000 Cr -> should warn."""
    deal = build_deal(
        acquirer=synthetic_acquirer,
        target=synthetic_target,
        purchase_equity_value=5000.0,
        cash_pct=0.60,  # 3000 Cr cash consideration
        debt_pct=0.40,
        stock_pct=0.0,
    )
    assert any("exceeds acquirer standalone cash balance" in w for w in deal["warnings"])


def test_missing_target_ebitda_triggers_warning(synthetic_acquirer, synthetic_target):
    tgt_no_ebitda = dict(synthetic_target, ebitda=None)
    deal = build_deal(acquirer=synthetic_acquirer, target=tgt_no_ebitda)
    assert any("ebitda is missing" in w.lower() for w in deal["warnings"])
    assert deal["target"]["ebitda"] is None


def test_missing_target_shares_disables_offer_price_per_share(synthetic_acquirer, synthetic_target):
    tgt_no_shares = dict(synthetic_target, shares_outstanding=None)
    deal = build_deal(acquirer=synthetic_acquirer, target=tgt_no_shares)
    assert deal["transaction"]["offer_price_per_share"] is None
    assert any("shares_outstanding is missing" in w.lower() for w in deal["warnings"])


def test_target_total_debt_and_cash_preservation(synthetic_acquirer):
    """
    Phase 7 prerequisite: target total_debt and cash must be preserved in deal['target'],
    known values must be accurate, and missing debt must remain None rather than 0.
    """
    # Known cash and total debt
    tgt_known = {
        "company_id": "TargetKnown",
        "equity_value": 3000.0,
        "cash": 400.0,
        "total_debt": 900.0,
        "net_debt": 500.0,
    }
    deal_known = build_deal(acquirer=synthetic_acquirer, target=tgt_known)
    assert "total_debt" in deal_known["target"]
    assert "cash" in deal_known["target"]
    assert deal_known["target"]["total_debt"] == 900.0
    assert deal_known["target"]["cash"] == 400.0
    assert deal_known["target"]["net_debt"] == 500.0

    # Missing debt and cash (unknown borrowings)
    tgt_missing = {
        "company_id": "TargetMissing",
        "equity_value": 3000.0,
        "total_debt": None,
        "cash": None,
        "net_debt": None,
    }
    deal_missing = build_deal(acquirer=synthetic_acquirer, target=tgt_missing)
    assert "total_debt" in deal_missing["target"]
    assert "cash" in deal_missing["target"]
    assert deal_missing["target"]["total_debt"] is None
    assert deal_missing["target"]["cash"] is None
    assert deal_missing["target"]["net_debt"] is None
    # Crucial check: missing debt must NOT have been silently converted to zero
    assert deal_missing["target"]["total_debt"] is not 0
    assert deal_missing["target"]["total_debt"] is not 0.0


# ---------------------------------------------------------------------------
# 7. Real Data Integration
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_REAL_DATA_AVAILABLE = (_DATA_DIR / "financials.csv").exists()


@pytest.mark.skipif(not _REAL_DATA_AVAILABLE, reason="data/ directory not present")
def test_real_data_deal_builder_tcs_acquiring_infosys():
    """End-to-end regression on actual production data: TCS acquiring Infosys."""
    companies = pd.read_csv(_DATA_DIR / "companies.csv")
    financials = pd.read_csv(_DATA_DIR / "financials.csv")
    sectors = pd.read_csv(_DATA_DIR / "sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    deal = build_deal_from_universe(
        acquirer_id="TCS",
        target_id="Infosys",
        metrics_df=metrics,
        financials_df=financials,
        acquisition_premium=0.20,
        cash_pct=0.50,
        debt_pct=0.30,
        stock_pct=0.20,
        transaction_fees=500.0,
        expected_annual_synergies=1200.0,
    )

    assert deal["acquirer"]["company_id"] == "TCS"
    assert deal["target"]["company_id"] == "Infosys"

    txn = deal["transaction"]
    assert txn["target_standalone_equity_value"] > 0
    assert abs(txn["acquisition_premium"] - 0.20) < 1e-4
    assert txn["purchase_equity_value"] > txn["target_standalone_equity_value"]
    assert txn["transaction_fees"] == 500.0
    assert txn["total_transaction_value"] == txn["purchase_equity_value"] + 500.0

    # Infosys net debt is negative (net cash)
    assert txn["target_net_debt"] < 0
    assert txn["transaction_enterprise_value"] < txn["purchase_equity_value"]

    fin = deal["financing"]
    assert fin["funding_amount"] == txn["purchase_equity_value"]
    assert abs(fin["cash_amount"] + fin["debt_amount"] + fin["stock_amount"] - txn["purchase_equity_value"]) < 1e-4

    syn = deal["synergies"]
    assert syn["annual_run_rate"] == 1200.0
    assert syn["year_3"] == 1200.0
