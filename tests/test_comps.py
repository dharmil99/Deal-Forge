import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics.comps import get_peer_group, peer_statistics, implied_valuation, comps_summary


@pytest.fixture
def synthetic_universe():
    """
    5 peers + 1 target, all same INDUSTRY (Cement), with hand-picked
    EV/EBITDA values so percentiles are easy to verify by hand: 10, 12, 14, 16, 18.
    25th percentile (linear interpolation, pandas default) = 12.0
    median = 14.0
    75th percentile = 16.0

    Also includes OTHER_MATERIALS: same broad `sector` ("Materials") as the
    target but a DIFFERENT `industry` ("Steel") -- this is the regression
    fixture for the sector-vs-industry bug. It must NOT show up in the
    default peer group, which should match on industry, not sector.
    """
    return pd.DataFrame(
        [
            {"company_id": "PEER1", "sector": "Materials", "industry": "Cement", "sector_type": "Industrial", "ev_revenue": 2.0, "ev_ebitda": 10, "pe_ratio": 15, "revenue_latest": 1000, "ebitda_latest": 200, "net_debt_latest": 100, "net_income_latest": 80},
            {"company_id": "PEER2", "sector": "Materials", "industry": "Cement", "sector_type": "Industrial", "ev_revenue": 2.2, "ev_ebitda": 12, "pe_ratio": 17, "revenue_latest": 1100, "ebitda_latest": 210, "net_debt_latest": 120, "net_income_latest": 85},
            {"company_id": "PEER3", "sector": "Materials", "industry": "Cement", "sector_type": "Industrial", "ev_revenue": 2.4, "ev_ebitda": 14, "pe_ratio": 19, "revenue_latest": 1200, "ebitda_latest": 220, "net_debt_latest": 140, "net_income_latest": 90},
            {"company_id": "PEER4", "sector": "Materials", "industry": "Cement", "sector_type": "Industrial", "ev_revenue": 2.6, "ev_ebitda": 16, "pe_ratio": 21, "revenue_latest": 1300, "ebitda_latest": 230, "net_debt_latest": 160, "net_income_latest": 95},
            {"company_id": "PEER5", "sector": "Materials", "industry": "Cement", "sector_type": "Industrial", "ev_revenue": 2.8, "ev_ebitda": 18, "pe_ratio": 23, "revenue_latest": 1400, "ebitda_latest": 240, "net_debt_latest": 180, "net_income_latest": 100},
            {"company_id": "OTHER_MATERIALS", "sector": "Materials", "industry": "Steel", "sector_type": "Industrial", "ev_revenue": 0.5, "ev_ebitda": 4, "pe_ratio": 6, "revenue_latest": 5000, "ebitda_latest": 800, "net_debt_latest": 2000, "net_income_latest": 300},
            {"company_id": "TARGET", "sector": "Materials", "industry": "Cement", "sector_type": "Industrial", "ev_revenue": None, "ev_ebitda": None, "pe_ratio": None, "revenue_latest": 1000, "ebitda_latest": 150, "net_debt_latest": 300, "net_income_latest": 60},
        ]
    )


def test_peer_group_default_matches_industry_not_sector(synthetic_universe):
    """
    Regression test: OTHER_MATERIALS shares the target's broad `sector`
    ("Materials") but is a different `industry` ("Steel") -- it must be
    excluded from the default peer group, which matches on industry.
    """
    peers = get_peer_group(synthetic_universe, target_id="TARGET")
    assert "TARGET" not in set(peers["company_id"])
    assert "OTHER_MATERIALS" not in set(peers["company_id"])
    assert len(peers) == 5


def test_peer_group_explicit_sector_override_includes_wider_set(synthetic_universe):
    """
    Passing `sector` explicitly is a deliberate override to widen the peer
    group -- OTHER_MATERIALS (Steel) SHOULD appear here since both it and
    the target share sector="Materials".
    """
    peers = get_peer_group(synthetic_universe, target_id="TARGET", sector="Materials")
    assert "OTHER_MATERIALS" in set(peers["company_id"])
    assert len(peers) == 6


def test_peer_group_respects_explicit_peer_ids(synthetic_universe):
    peers = get_peer_group(synthetic_universe, target_id="TARGET", peer_ids=["PEER1", "PEER3"])
    assert set(peers["company_id"]) == {"PEER1", "PEER3"}


def test_peer_statistics_percentiles_match_manual_calc(synthetic_universe):
    peers = get_peer_group(synthetic_universe, target_id="TARGET")
    stats = peer_statistics(peers)
    assert stats["peer_count"] == 5
    assert stats["small_sample_warning"] is False  # 5 is the threshold, not below it
    assert abs(stats["ev_ebitda"]["median"] - 14.0) < 1e-9
    assert abs(stats["ev_ebitda"]["p25"] - 12.0) < 1e-9
    assert abs(stats["ev_ebitda"]["p75"] - 16.0) < 1e-9


def test_small_sample_warning_triggers_below_threshold(synthetic_universe):
    peers = get_peer_group(synthetic_universe, target_id="TARGET", peer_ids=["PEER1", "PEER2"])
    stats = peer_statistics(peers)
    assert stats["peer_count"] == 2
    assert stats["small_sample_warning"] is True


def test_implied_valuation_ev_ebitda_formula(synthetic_universe):
    target_row = synthetic_universe[synthetic_universe["company_id"] == "TARGET"].iloc[0]
    peers = get_peer_group(synthetic_universe, target_id="TARGET")
    stats = peer_statistics(peers)
    val = implied_valuation(target_row, stats, percentile="median")
    # Implied EV = median EV/EBITDA (14.0) * target EBITDA (150) = 2100
    assert abs(val["ev_ebitda"]["implied_ev"] - 2100) < 1e-9
    # Implied Equity Value = Implied EV - target net debt (300) = 1800
    assert abs(val["ev_ebitda"]["implied_equity_value"] - 1800) < 1e-9


def test_implied_valuation_pe_formula_has_no_net_debt_adjustment(synthetic_universe):
    target_row = synthetic_universe[synthetic_universe["company_id"] == "TARGET"].iloc[0]
    peers = get_peer_group(synthetic_universe, target_id="TARGET")
    stats = peer_statistics(peers)
    val = implied_valuation(target_row, stats, percentile="median")
    # median P/E = 19.0, target net income = 60 -> implied equity value = 1140
    # (P/E is already an equity multiple -- no EV bridge / net debt subtraction)
    assert abs(val["pe_ratio"]["implied_equity_value"] - 1140) < 1e-9


def test_comps_summary_end_to_end(synthetic_universe):
    summary = comps_summary(synthetic_universe, target_id="TARGET")
    assert summary["peer_count"] == 5
    assert summary["small_sample_warning"] is False
    assert set(summary["peer_group"]) == {"PEER1", "PEER2", "PEER3", "PEER4", "PEER5"}
    assert "ev_ebitda" in summary["implied_valuation"]
    assert "pe_ratio" in summary["implied_valuation"]
