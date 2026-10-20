"""
precedents.py

Phase 4: Precedent Transactions Analysis.

Filters historical M&A transactions (by sector/industry/date/deal size),
computes EV/Revenue and EV/EBITDA multiples paid in those deals, their
25th/median/75th percentiles, and applies them to a target to derive an
implied valuation. Mirrors Section 9 of the spec, and mirrors comps.py's
architecture deliberately (peer stats -> percentiles -> implied valuation)
since the underlying statistical logic is the same, just applied to deal
multiples instead of trading multiples.

IMPORTANT -- DATA MATURITY: this module ships with a SEED dataset of 4
real, individually-sourced transactions (see data/transactions.csv and its
source_note column for citations). This is nowhere near enough for
meaningful percentile statistics on its own -- it exists to prove the
analytics logic is correct against real numbers, the same way Phase 1-3
proved correctness before scaling up. Expand transactions.csv over time
using the same schema as more deals are sourced. The small-sample warning
below will keep firing (correctly) until there's real depth per sector.

DEAL SCALING NOTE: not every disclosed deal is a 100%-ownership
transaction. Where `stake_acquired_pct < 100`, this module derives an
IMPLIED 100%-basis enterprise value as `deal_value / (stake_pct / 100)`.
This is a standard, widely-used precedent-transaction technique, but it
ignores control premium dynamics (a controlling stake often costs
disproportionately more per share than a minority stake would) -- so
treat the implied EV as an approximation, not a precise figure. Deals
already at 100% (stake_acquired_pct == 100) pass through deal_value
unchanged.
"""

from __future__ import annotations

import pandas as pd

SMALL_SAMPLE_THRESHOLD = 5  # identical threshold to comps.py, same reasoning


def load_transactions(path: str = "data/transactions.csv") -> pd.DataFrame:
    """
    Loads transactions.csv and computes derived fields:
      implied_ev_cr        -- deal_value scaled to 100%-ownership basis
      ev_revenue            -- implied_ev_cr / target_revenue_cr
      ev_ebitda             -- implied_ev_cr / target_ebitda_cr (often blank
                                -- EBITDA at time of a private/M&A deal is
                                rarely disclosed publicly, unlike revenue)
    """
    df = pd.read_csv(path, parse_dates=["announcement_date"])

    df["implied_ev_cr"] = df.apply(
        lambda r: r["deal_value_cr"] / (r["stake_acquired_pct"] / 100) if pd.notna(r["stake_acquired_pct"]) and r["stake_acquired_pct"] > 0 else None,
        axis=1,
    )
    df["ev_revenue"] = df.apply(
        lambda r: (r["implied_ev_cr"] / r["target_revenue_cr"]) if pd.notna(r.get("target_revenue_cr")) and r["target_revenue_cr"] != 0 else None,
        axis=1,
    )
    df["ev_ebitda"] = df.apply(
        lambda r: (r["implied_ev_cr"] / r["target_ebitda_cr"]) if pd.notna(r.get("target_ebitda_cr")) and r["target_ebitda_cr"] != 0 else None,
        axis=1,
    )
    return df


def filter_transactions(
    transactions_df: pd.DataFrame,
    sector: str | None = None,
    industry: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    min_deal_value_cr: float | None = None,
    max_deal_value_cr: float | None = None,
) -> pd.DataFrame:
    """Apply any combination of filters; all optional, matches Section 9's spec."""
    df = transactions_df.copy()

    if sector:
        df = df[df["sector"] == sector]
    if industry:
        df = df[df["industry"] == industry]
    if start_date:
        df = df[df["announcement_date"] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df["announcement_date"] <= pd.to_datetime(end_date)]
    if min_deal_value_cr is not None:
        df = df[df["deal_value_cr"] >= min_deal_value_cr]
    if max_deal_value_cr is not None:
        df = df[df["deal_value_cr"] <= max_deal_value_cr]

    return df


def transaction_statistics(filtered_df: pd.DataFrame) -> dict:
    """25th/median/75th percentile for EV/Revenue and EV/EBITDA, plus sample size."""
    n = len(filtered_df)
    stats = {"transaction_count": n, "small_sample_warning": n < SMALL_SAMPLE_THRESHOLD}

    for m in ("ev_revenue", "ev_ebitda"):
        values = filtered_df[m].dropna()
        if len(values) == 0:
            stats[m] = {"p25": None, "median": None, "p75": None, "n": 0}
        else:
            stats[m] = {
                "p25": values.quantile(0.25),
                "median": values.quantile(0.50),
                "p75": values.quantile(0.75),
                "n": len(values),
            }
    return stats


def implied_valuation_from_precedents(
    target_revenue_cr: float,
    target_ebitda_cr: float | None,
    target_net_debt_cr: float,
    stats: dict,
    percentile: str = "median",
) -> dict:
    """
    Applies precedent-transaction multiples to a target's own financials.
    Both methods derive Implied EV, then Implied Equity Value = Implied EV
    - target's own net debt (the target being valued, not the historical
    deal targets used to build the multiple).
    """
    results = {}

    ev_rev_mult = stats.get("ev_revenue", {}).get(percentile)
    if ev_rev_mult is not None and pd.notna(target_revenue_cr):
        implied_ev = ev_rev_mult * target_revenue_cr
        results["ev_revenue"] = {
            "multiple_used": ev_rev_mult,
            "implied_ev": implied_ev,
            "implied_equity_value": implied_ev - target_net_debt_cr,
        }

    ev_ebitda_mult = stats.get("ev_ebitda", {}).get(percentile)
    if ev_ebitda_mult is not None and target_ebitda_cr is not None and pd.notna(target_ebitda_cr):
        implied_ev = ev_ebitda_mult * target_ebitda_cr
        results["ev_ebitda"] = {
            "multiple_used": ev_ebitda_mult,
            "implied_ev": implied_ev,
            "implied_equity_value": implied_ev - target_net_debt_cr,
        }

    return results


if __name__ == "__main__":
    import sys

    data_dir = sys.argv[1] if len(sys.argv) > 1 else "data"
    sector_filter = sys.argv[2] if len(sys.argv) > 2 else None

    txns = load_transactions(f"{data_dir}/transactions.csv")
    filtered = filter_transactions(txns, sector=sector_filter)
    stats = transaction_statistics(filtered)

    print(f"Transactions loaded: {len(txns)} total" + (f", {len(filtered)} matching sector='{sector_filter}'" if sector_filter else ""))
    if stats["small_sample_warning"]:
        print(f"WARNING: only {stats['transaction_count']} transaction(s) -- below the {SMALL_SAMPLE_THRESHOLD}-deal threshold for reliable percentiles. This is a SEED dataset; expand data/transactions.csv with more sourced deals for meaningful statistics.")

    print("\nTransaction multiples (25th / median / 75th):")
    for m in ("ev_revenue", "ev_ebitda"):
        s = stats[m]
        if s["n"] > 0:
            print(f"  {m}: {s['p25']:.2f} / {s['median']:.2f} / {s['p75']:.2f}  (n={s['n']})")
        else:
            print(f"  {m}: no data available in this filtered set")

    print("\nIndividual transactions in this set:")
    cols = ["transaction_id", "acquirer", "target", "announcement_date", "deal_value_cr", "stake_acquired_pct", "implied_ev_cr", "ev_revenue", "ev_ebitda"]
    print(filtered[cols].to_string(index=False))
