import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics.precedents import load_transactions, filter_transactions, transaction_statistics, implied_valuation_from_precedents

REAL_TXN_PATH = Path(__file__).resolve().parents[1] / "data" / "transactions.csv"


@pytest.fixture
def synthetic_transactions(tmp_path):
    """
    5 synthetic deals, hand-picked EV/Revenue values for easy percentile
    verification: 1.0, 1.5, 2.0, 2.5, 3.0 -> p25=1.5, median=2.0, p75=2.5
    Includes one deal with stake_acquired_pct=50 to test the 100%-basis
    scaling formula explicitly.
    """
    df = pd.DataFrame(
        [
            {"transaction_id": "S1", "announcement_date": "2022-01-01", "acquirer": "AcqA", "target": "TgtA", "sector": "Test", "industry": "Widgets", "stake_acquired_pct": 100, "deal_value_cr": 1000, "target_revenue_cr": 1000, "target_ebitda_cr": 200},
            {"transaction_id": "S2", "announcement_date": "2022-06-01", "acquirer": "AcqB", "target": "TgtB", "sector": "Test", "industry": "Widgets", "stake_acquired_pct": 100, "deal_value_cr": 1500, "target_revenue_cr": 1000, "target_ebitda_cr": 250},
            {"transaction_id": "S3", "announcement_date": "2023-01-01", "acquirer": "AcqC", "target": "TgtC", "sector": "Test", "industry": "Widgets", "stake_acquired_pct": 100, "deal_value_cr": 2000, "target_revenue_cr": 1000, "target_ebitda_cr": 300},
            {"transaction_id": "S4", "announcement_date": "2023-06-01", "acquirer": "AcqD", "target": "TgtD", "sector": "Test", "industry": "Widgets", "stake_acquired_pct": 100, "deal_value_cr": 2500, "target_revenue_cr": 1000, "target_ebitda_cr": 350},
            {"transaction_id": "S5", "announcement_date": "2024-01-01", "acquirer": "AcqE", "target": "TgtE", "sector": "Test", "industry": "Widgets", "stake_acquired_pct": 100, "deal_value_cr": 3000, "target_revenue_cr": 1000, "target_ebitda_cr": 400},
            # Partial-stake deal: paid 600 Cr for 50% -> implied 100%-basis EV = 1200
            {"transaction_id": "S6", "announcement_date": "2024-06-01", "acquirer": "AcqF", "target": "TgtF", "sector": "Test", "industry": "Widgets", "stake_acquired_pct": 50, "deal_value_cr": 600, "target_revenue_cr": 1000, "target_ebitda_cr": 150},
        ]
    )
    path = tmp_path / "synthetic_transactions.csv"
    df.to_csv(path, index=False)
    return path


def test_partial_stake_scales_to_implied_100pct_ev(synthetic_transactions):
    df = load_transactions(str(synthetic_transactions))
    row = df[df["transaction_id"] == "S6"].iloc[0]
    # 600 Cr for 50% -> implied 100%-basis EV = 600 / 0.5 = 1200
    assert abs(row["implied_ev_cr"] - 1200) < 1e-9
    # EV/Revenue = 1200 / 1000 = 1.2
    assert abs(row["ev_revenue"] - 1.2) < 1e-9


def test_full_stake_deal_passes_through_unchanged(synthetic_transactions):
    df = load_transactions(str(synthetic_transactions))
    row = df[df["transaction_id"] == "S1"].iloc[0]
    assert abs(row["implied_ev_cr"] - 1000) < 1e-9
    assert abs(row["ev_revenue"] - 1.0) < 1e-9
    assert abs(row["ev_ebitda"] - 5.0) < 1e-9  # 1000/200


def test_percentiles_match_manual_calc(synthetic_transactions):
    df = load_transactions(str(synthetic_transactions))
    filtered = filter_transactions(df, sector="Test")
    stats = transaction_statistics(filtered)
    assert stats["transaction_count"] == 6
    # EV/Revenue values across all 6: 1.0, 1.5, 2.0, 2.5, 3.0, 1.2
    # sorted: 1.0, 1.2, 1.5, 2.0, 2.5, 3.0
    values = sorted([1.0, 1.5, 2.0, 2.5, 3.0, 1.2])
    expected_median = pd.Series(values).quantile(0.50)
    assert abs(stats["ev_revenue"]["median"] - expected_median) < 1e-9


def test_small_sample_warning(synthetic_transactions):
    df = load_transactions(str(synthetic_transactions))
    filtered = filter_transactions(df, sector="Test", max_deal_value_cr=1500)
    stats = transaction_statistics(filtered)
    assert stats["transaction_count"] < 5
    assert stats["small_sample_warning"] is True


def test_filter_by_date_range(synthetic_transactions):
    df = load_transactions(str(synthetic_transactions))
    filtered = filter_transactions(df, start_date="2023-01-01", end_date="2023-12-31")
    assert set(filtered["transaction_id"]) == {"S3", "S4"}


def test_implied_valuation_ev_revenue_formula():
    stats = {"ev_revenue": {"p25": 1.5, "median": 2.0, "p75": 2.5, "n": 5}}
    result = implied_valuation_from_precedents(
        target_revenue_cr=1000, target_ebitda_cr=None, target_net_debt_cr=300, stats=stats, percentile="median"
    )
    # Implied EV = 2.0 * 1000 = 2000; Implied Equity = 2000 - 300 = 1700
    assert abs(result["ev_revenue"]["implied_ev"] - 2000) < 1e-9
    assert abs(result["ev_revenue"]["implied_equity_value"] - 1700) < 1e-9


def test_implied_valuation_skips_ev_ebitda_when_target_ebitda_missing():
    stats = {"ev_revenue": {"p25": 1.5, "median": 2.0, "p75": 2.5, "n": 5}, "ev_ebitda": {"p25": 8, "median": 10, "p75": 12, "n": 5}}
    result = implied_valuation_from_precedents(
        target_revenue_cr=1000, target_ebitda_cr=None, target_net_debt_cr=300, stats=stats, percentile="median"
    )
    assert "ev_revenue" in result
    assert "ev_ebitda" not in result  # target's own EBITDA wasn't provided


# --- Real seed data validation ---

def test_real_transactions_csv_loads_and_matches_sourced_figures():
    """
    Validates the actual seed data in data/transactions.csv against the
    figures cited in source_note -- catches a transcription error in the
    real file, not just formula bugs in synthetic data.
    """
    df = load_transactions(str(REAL_TXN_PATH))
    assert len(df) == 4

    kesoram = df[df["transaction_id"] == "T001"].iloc[0]
    assert kesoram["deal_value_cr"] == 7600
    assert abs(kesoram["ev_revenue"] - (7600 / 3740.5)) < 1e-6

    india_cements = df[df["transaction_id"] == "T002"].iloc[0]
    # Partial stake (55.49%) -- implied 100%-basis EV should exceed deal_value_cr
    assert india_cements["implied_ev_cr"] > india_cements["deal_value_cr"]

    wonder_wallcare = df[df["transaction_id"] == "T003"].iloc[0]
    # No target revenue disclosed -> ev_revenue must be null, not a fabricated number
    assert pd.isna(wonder_wallcare["ev_revenue"])
