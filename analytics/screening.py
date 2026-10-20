"""
screening.py

Phase 2: Target Screening.

Computes acquisition-screening metrics for the Industrial-sector universe
and lets the user filter/rank candidates. Financial-sector companies
(banks/NBFCs) are excluded here -- EV/EBITDA is not meaningful for them.
See docs/data-dictionary.md and docs/methodology.md for the full rationale.

CORE METRICS (per company, computed from all available fiscal years):
  revenue_cagr        -- (last_revenue / first_revenue)^(1/n_years) - 1
  ebitda_margin        -- latest fiscal year, EBITDA / Revenue
  ev_ebitda            -- (latest market cap + latest net debt) / latest EBITDA
  net_debt_ebitda      -- latest net debt / latest EBITDA

SCREENING SCORE:
  A composite of percentile-ranks across the four metrics above, 0-100.
  This is an ILLUSTRATIVE, MODEL-DEFINED heuristic -- not an objective
  "best target" judgment. It exists to let a user rank/sort a shortlist,
  not to declare a winner.
"""

from __future__ import annotations

import pandas as pd


def compute_metrics(financials_df: pd.DataFrame, companies_df: pd.DataFrame, sector_df: pd.DataFrame) -> pd.DataFrame:
    """
    Collapse the long-format financials.csv (company_id x fiscal_year) into
    one row per company with the four screening metrics, joined against
    sector_mapping for sector/sector_type.
    """
    rows = []
    for company_id, g in financials_df.groupby("company_id"):
        g = g.dropna(subset=["fiscal_year"]).sort_values("fiscal_year")
        if g.empty:
            continue

        first, last = g.iloc[0], g.iloc[-1]
        n_years = last["fiscal_year"] - first["fiscal_year"]

        # Revenue CAGR -- needs a positive starting revenue and at least 1 year span.
        revenue_cagr = None
        if n_years > 0 and pd.notna(first["revenue"]) and first["revenue"] > 0 and pd.notna(last["revenue"]):
            revenue_cagr = (last["revenue"] / first["revenue"]) ** (1 / n_years) - 1

        ebitda_margin = last.get("ebitda_margin_derived")
        latest_ebitda = last.get("ebitda_derived")
        latest_net_debt = last.get("net_debt_derived")
        latest_net_income = last.get("net_income")

        # shares_outstanding is sometimes blank for the MOST RECENT fiscal
        # year even when net income/price are already updated (Screener
        # hasn't published the latest adjusted share count yet). Fall back
        # to the most recent prior year that has a value rather than
        # dropping the company from every P/E-based calculation entirely.
        # Share counts rarely move much year-to-year outside a buyback or
        # split, so this is a disclosed approximation, not silent guesswork.
        latest_shares = None
        shares_fallback_year = None
        for _, r in g.iloc[::-1].iterrows():
            if pd.notna(r.get("shares_outstanding")):
                latest_shares = r.get("shares_outstanding")
                shares_fallback_year = r.get("fiscal_year")
                break
        shares_is_stale = shares_fallback_year is not None and shares_fallback_year != last["fiscal_year"]

        rows.append(
            {
                "company_id": company_id,
                "latest_fiscal_year": last["fiscal_year"],
                "years_of_history": n_years,
                "revenue_latest": last.get("revenue"),
                "revenue_cagr": revenue_cagr,
                "ebitda_latest": latest_ebitda,
                "ebitda_margin": ebitda_margin,
                "net_debt_latest": latest_net_debt,
                "net_income_latest": latest_net_income,
                "shares_outstanding_latest": latest_shares,
                "shares_outstanding_fallback_year": shares_fallback_year,
                "shares_outstanding_is_stale": shares_is_stale,
            }
        )

    metrics = pd.DataFrame(rows)

    # Join company identity (for market cap/price -> EV, P/E) and sector mapping.
    merged = metrics.merge(
        companies_df[["company_id", "company_name", "market_cap_latest", "current_price"]], on="company_id", how="left"
    )
    merged = merged.merge(sector_df[["company_id", "sector", "industry", "sector_type", "ticker"]], on="company_id", how="left")

    # EV = latest market cap + latest net debt.
    merged["ev"] = merged["market_cap_latest"] + merged["net_debt_latest"]

    merged["ev_ebitda"] = merged.apply(
        lambda r: (r["ev"] / r["ebitda_latest"]) if pd.notna(r["ebitda_latest"]) and r["ebitda_latest"] != 0 else None,
        axis=1,
    )
    merged["net_debt_ebitda"] = merged.apply(
        lambda r: (r["net_debt_latest"] / r["ebitda_latest"]) if pd.notna(r["ebitda_latest"]) and r["ebitda_latest"] != 0 else None,
        axis=1,
    )
    merged["ev_revenue"] = merged.apply(
        lambda r: (r["ev"] / r["revenue_latest"]) if pd.notna(r["revenue_latest"]) and r["revenue_latest"] != 0 else None,
        axis=1,
    )

    # EPS: net_income_latest is in Rs Cr (10^7 Rs); shares_outstanding_latest
    # is a raw share count -- convert Cr to Rs before dividing, or EPS comes
    # out ~10 million times too small.
    def _eps(r):
        if pd.notna(r["net_income_latest"]) and pd.notna(r["shares_outstanding_latest"]) and r["shares_outstanding_latest"] != 0:
            return (r["net_income_latest"] * 1e7) / r["shares_outstanding_latest"]
        return None

    merged["eps"] = merged.apply(_eps, axis=1)
    merged["pe_ratio"] = merged.apply(
        lambda r: (r["current_price"] / r["eps"]) if pd.notna(r["eps"]) and r["eps"] != 0 and pd.notna(r["current_price"]) else None,
        axis=1,
    )

    return merged


def screen(
    metrics_df: pd.DataFrame,
    sector: str | None = None,
    min_revenue_cagr: float | None = None,
    min_ebitda_margin: float | None = None,
    max_ev_ebitda: float | None = None,
    max_net_debt_ebitda: float | None = None,
    industrial_only: bool = True,
) -> pd.DataFrame:
    """
    Apply screening filters. All thresholds are optional -- pass only the
    ones you want to enforce. `industrial_only=True` (default) excludes
    Financial-sector companies, per the V0 scope decision.
    """
    df = metrics_df.copy()

    if industrial_only:
        df = df[df["sector_type"] == "Industrial"]

    if sector:
        df = df[df["sector"] == sector]
    if min_revenue_cagr is not None:
        df = df[df["revenue_cagr"] >= min_revenue_cagr]
    if min_ebitda_margin is not None:
        df = df[df["ebitda_margin"] >= min_ebitda_margin]
    if max_ev_ebitda is not None:
        df = df[df["ev_ebitda"] <= max_ev_ebitda]
    if max_net_debt_ebitda is not None:
        df = df[df["net_debt_ebitda"] <= max_net_debt_ebitda]

    return df


def add_screening_score(metrics_df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds four percentile-rank subscores (0-100, higher = more attractive on
    that dimension) plus a composite illustrative_screening_score, computed
    RELATIVE TO THE UNIVERSE PASSED IN (so score against the full Industrial
    set, not a pre-filtered shortlist, or percentiles become meaningless).
    """
    df = metrics_df.copy()

    df["growth_score"] = df["revenue_cagr"].rank(pct=True) * 100
    df["margin_score"] = df["ebitda_margin"].rank(pct=True) * 100
    # Cheaper EV/EBITDA is better -> rank ascending value as descending score.
    df["valuation_score"] = (-df["ev_ebitda"]).rank(pct=True) * 100
    # Lower leverage is better.
    df["leverage_score"] = (-df["net_debt_ebitda"]).rank(pct=True) * 100

    score_cols = ["growth_score", "margin_score", "valuation_score", "leverage_score"]
    df["illustrative_screening_score"] = df[score_cols].mean(axis=1, skipna=True)

    return df


if __name__ == "__main__":
    import sys

    data_dir = sys.argv[1] if len(sys.argv) > 1 else "data"

    companies = pd.read_csv(f"{data_dir}/companies.csv")
    financials = pd.read_csv(f"{data_dir}/financials.csv")
    sectors = pd.read_csv(f"{data_dir}/sector_mapping.csv")

    metrics = compute_metrics(financials, companies, sectors)
    scored = add_screening_score(metrics[metrics["sector_type"] == "Industrial"])

    # Example screen matching the spec's own worked example:
    # Revenue CAGR > 10%, EBITDA Margin > 15%, EV/EBITDA < 15x, Net Debt/EBITDA < 3x
    example = screen(scored, min_revenue_cagr=0.10, min_ebitda_margin=0.15, max_ev_ebitda=15, max_net_debt_ebitda=3)

    print(f"Full Industrial universe: {len(scored)} companies")
    print(f"Passing example screen (CAGR>10%, Margin>15%, EV/EBITDA<15x, ND/EBITDA<3x): {len(example)} companies\n")

    cols = ["company_id", "sector", "revenue_cagr", "ebitda_margin", "ev_ebitda", "net_debt_ebitda", "illustrative_screening_score"]
    print(example[cols].sort_values("illustrative_screening_score", ascending=False).to_string(index=False))

    scored.to_csv(f"{data_dir}/screening_results.csv", index=False)
    print(f"\nWrote {data_dir}/screening_results.csv (full universe, all metrics + scores)")
