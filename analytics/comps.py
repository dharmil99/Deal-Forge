"""
comps.py

Phase 3: Comparable Companies Analysis.

Given a target company and a peer group (same sector by default, or an
explicit list), computes peer trading multiples (EV/Revenue, EV/EBITDA,
P/E), their 25th/median/75th percentiles, and applies them to the target
to derive an implied valuation range. Mirrors Section 8 of the spec.

IMPORTANT: percentile statistics are only as meaningful as the sample size
behind them. A 2-3 company "peer group" producing a median is not a
statistically meaningful comparable-companies analysis -- it's two numbers
with a percentile function run over them. This module surfaces the peer
count explicitly and flags small samples rather than silently presenting
a median with the same visual confidence as a 20-company one.
"""

from __future__ import annotations

import pandas as pd

SMALL_SAMPLE_THRESHOLD = 5  # peer groups below this size get flagged


def get_peer_group(
    metrics_df: pd.DataFrame,
    target_id: str,
    sector: str | None = None,
    industry: str | None = None,
    peer_ids: list[str] | None = None,
) -> pd.DataFrame:
    """
    Returns the peer group, excluding the target itself.

    Selection priority:
      1. `peer_ids` given -> use exactly that list (hand-picked peer group).
      2. `sector` given -> broad sector-wide comparison (deliberate override;
         use when you want a wider set on purpose, e.g. cross-industry M&A).
      3. `industry` given -> explicit industry-level match.
      4. default -> target's own `industry` (NOT `sector`). Industry is the
         financially meaningful grouping for comps (Cement vs Cement, Steel
         vs Steel) -- `sector` is a much coarser bucket (e.g. "Materials"
         includes Cement, Steel, Coal, Zinc, Copper, Aluminium all together)
         and produces peer groups that look plausible in size but mix
         businesses with genuinely different trading multiples.
    """
    if peer_ids is not None:
        peers = metrics_df[metrics_df["company_id"].isin(peer_ids)]
    elif sector is not None:
        peers = metrics_df[(metrics_df["sector"] == sector) & (metrics_df["sector_type"] == "Industrial")]
    else:
        if industry is None:
            target_rows = metrics_df[metrics_df["company_id"] == target_id]
            if target_rows.empty:
                raise ValueError(f"Target '{target_id}' not found in metrics_df")
            industry = target_rows.iloc[0]["industry"]
        peers = metrics_df[(metrics_df["industry"] == industry) & (metrics_df["sector_type"] == "Industrial")]

    return peers[peers["company_id"] != target_id].copy()


def peer_statistics(peer_df: pd.DataFrame, multiples: list[str] = ("ev_revenue", "ev_ebitda", "pe_ratio")) -> dict:
    """
    25th/median/75th percentile for each requested multiple, plus the
    sample size and a small-sample flag.
    """
    n = len(peer_df)
    stats = {"peer_count": n, "small_sample_warning": n < SMALL_SAMPLE_THRESHOLD}

    for m in multiples:
        values = peer_df[m].dropna()
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


def implied_valuation(target_row: pd.Series, stats: dict, percentile: str = "median") -> dict:
    """
    Applies peer multiples to the target's own financials to derive an
    implied enterprise/equity value under each methodology.

    - EV/Revenue and EV/EBITDA -> Implied EV, then Implied Equity Value =
      Implied EV - Target Net Debt.
    - P/E -> applies directly to target Net Income to get Implied Equity
      Value (P/E is already an equity-value multiple, no EV bridge needed).
    """
    results = {}

    ev_revenue_mult = stats.get("ev_revenue", {}).get(percentile)
    if ev_revenue_mult is not None and pd.notna(target_row.get("revenue_latest")):
        implied_ev = ev_revenue_mult * target_row["revenue_latest"]
        results["ev_revenue"] = {
            "multiple_used": ev_revenue_mult,
            "implied_ev": implied_ev,
            "implied_equity_value": implied_ev - target_row.get("net_debt_latest", 0),
        }

    ev_ebitda_mult = stats.get("ev_ebitda", {}).get(percentile)
    if ev_ebitda_mult is not None and pd.notna(target_row.get("ebitda_latest")):
        implied_ev = ev_ebitda_mult * target_row["ebitda_latest"]
        results["ev_ebitda"] = {
            "multiple_used": ev_ebitda_mult,
            "implied_ev": implied_ev,
            "implied_equity_value": implied_ev - target_row.get("net_debt_latest", 0),
        }

    pe_mult = stats.get("pe_ratio", {}).get(percentile)
    if pe_mult is not None and pd.notna(target_row.get("net_income_latest")):
        implied_equity_value = pe_mult * target_row["net_income_latest"]
        results["pe_ratio"] = {
            "multiple_used": pe_mult,
            "implied_equity_value": implied_equity_value,
        }

    return results


def comps_summary(
    metrics_df: pd.DataFrame,
    target_id: str,
    sector: str | None = None,
    industry: str | None = None,
    peer_ids: list[str] | None = None,
    percentile: str = "median",
) -> dict:
    """
    Orchestrates the full comps workflow for one target: peer group ->
    peer statistics -> implied valuation. This is the function a
    frontend/API call would hit directly.
    """
    target_rows = metrics_df[metrics_df["company_id"] == target_id]
    if target_rows.empty:
        raise ValueError(f"Target '{target_id}' not found in metrics_df")
    target_row = target_rows.iloc[0]

    peers = get_peer_group(metrics_df, target_id, sector=sector, industry=industry, peer_ids=peer_ids)
    stats = peer_statistics(peers)
    valuation = implied_valuation(target_row, stats, percentile=percentile)

    return {
        "target_id": target_id,
        "target_sector": target_row.get("sector"),
        "target_industry": target_row.get("industry"),
        "peer_count": stats["peer_count"],
        "small_sample_warning": stats["small_sample_warning"],
        "peer_group": peers["company_id"].tolist(),
        "peer_statistics": stats,
        "implied_valuation": valuation,
    }


if __name__ == "__main__":
    import sys

    from screening import compute_metrics

    data_dir = sys.argv[1] if len(sys.argv) > 1 else "data"
    target = sys.argv[2] if len(sys.argv) > 2 else None

    companies = pd.read_csv(f"{data_dir}/companies.csv")
    financials = pd.read_csv(f"{data_dir}/financials.csv")
    sectors = pd.read_csv(f"{data_dir}/sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    if target is None:
        print("Usage: python analytics/comps.py <data_dir> <target_company_id>")
        print("\nExample company_ids from your universe:")
        print(metrics[metrics["sector_type"] == "Industrial"]["company_id"].head(10).tolist())
        sys.exit(0)

    summary = comps_summary(metrics, target)

    print(f"Target: {summary['target_id']} (sector: {summary['target_sector']}, industry: {summary['target_industry']})")
    print(f"Peer group ({summary['peer_count']} companies, matched on industry): {summary['peer_group']}")
    if summary["small_sample_warning"]:
        print(f"WARNING: peer group has fewer than {SMALL_SAMPLE_THRESHOLD} companies -- percentiles below are not statistically robust.")

    print("\nPeer multiples (25th / median / 75th):")
    for m in ("ev_revenue", "ev_ebitda", "pe_ratio"):
        s = summary["peer_statistics"][m]
        if s["n"] > 0:
            print(f"  {m}: {s['p25']:.2f} / {s['median']:.2f} / {s['p75']:.2f}  (n={s['n']})")
        else:
            print(f"  {m}: no data available among peers")

    print("\nImplied valuation (using median multiple):")
    for method, vals in summary["implied_valuation"].items():
        print(f"  via {method}: multiple={vals['multiple_used']:.2f}x -> implied equity value = Rs {vals['implied_equity_value']:.1f} Cr")
