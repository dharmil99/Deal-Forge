"""
valuation.py

Phase 5: Valuation Summary.

Combines the three valuation methodologies — Comparable Companies (comps),
Precedent Transactions (precedents), and Discounted Cash Flow (DCF) — into
a single structured output for one target company.

DESIGN PRINCIPLE: these three methodologies are EXPECTED to disagree,
sometimes substantially, for capital-intensive or high-growth companies.
This module does NOT calculate a blended/weighted average or declare one
methodology "best". It preserves each methodology's range, surfacing
divergence as information rather than noise to be reconciled away.
See docs/methodology.md (Phase 5 section) for the full rationale.

ARCHITECTURE:
  - All financial formulas live in their respective modules (comps.py,
    precedents.py, dcf.py). This module only orchestrates -- it calls
    existing functions and assembles their output.
  - No formulas are duplicated here.
  - The structured output is designed to be consumed directly by a
    Phase 9 FastAPI endpoint and a React frontend without further transformation.

DATA FLOW:
  metrics_df      <- compute_metrics() from screening.py
  transactions_df <- load_transactions() from precedents.py
  financials_df   <- raw long-format financials (optional; enables DCF)
                     If omitted, DCF only runs when full dcf_params are supplied.
"""

from __future__ import annotations

import sys
from pathlib import Path

_PROJECT_ROOT = str(Path(__file__).resolve().parents[1])
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import pandas as pd

# -- Reuse existing analytics modules -- no financial logic lives here.
from analytics.comps import get_peer_group, peer_statistics, implied_valuation
from analytics.precedents import filter_transactions, transaction_statistics, implied_valuation_from_precedents
from analytics.dcf import dcf_valuation


def _build_comps_section(
    metrics_df: pd.DataFrame,
    target_id: str,
    target_row: pd.Series,
    peer_ids: list[str] | None,
    sector: str | None,
) -> tuple[dict, list[str]]:
    """
    Runs the full comps workflow and returns a structured section plus any warnings.

    Returns three implied-equity values per multiple (P25 / median / P75) so the
    caller has a valuation range, not just a single point.
    """
    warnings_out: list[str] = []

    peers = get_peer_group(metrics_df, target_id, sector=sector, peer_ids=peer_ids)
    stats = peer_statistics(peers)

    peer_count = stats["peer_count"]
    small_sample = stats["small_sample_warning"]
    if small_sample:
        warnings_out.append(
            f"comps: only {peer_count} peer(s) in the comparable-companies group "
            f"(threshold: 5) -- percentile statistics are not statistically meaningful "
            f"at this sample size."
        )

    if target_row.get("shares_outstanding_is_stale"):
        fallback_yr = target_row.get("shares_outstanding_fallback_year")
        warnings_out.append(
            f"comps/data_quality: shares_outstanding for {target_id} is from "
            f"FY{fallback_yr} (latest year was blank) -- P/E may be slightly imprecise."
        )

    multiples: dict = {}
    valuation_ranges: dict = {}

    for multiple_key in ("ev_revenue", "ev_ebitda", "pe_ratio"):
        m_stats = stats.get(multiple_key, {})
        multiples[multiple_key] = {
            "p25": m_stats.get("p25"),
            "median": m_stats.get("median"),
            "p75": m_stats.get("p75"),
            "n": m_stats.get("n", 0),
        }

        # Compute implied equity at each of the three percentile points.
        range_vals: dict = {}
        for label, pct_key in (("low", "p25"), ("mid", "median"), ("high", "p75")):
            implied = implied_valuation(target_row, stats, percentile=pct_key)
            entry = implied.get(multiple_key)
            range_vals[label] = {
                "multiple": m_stats.get(pct_key),
                "implied_equity_value": entry["implied_equity_value"] if entry else None,
            }
        valuation_ranges[multiple_key] = range_vals

        # Warn when a specific multiple is fully unavailable for the target.
        if m_stats.get("n", 0) == 0 and peer_count > 0:
            warnings_out.append(
                f"comps: {multiple_key} multiple unavailable -- "
                f"no peers have non-null values for this metric."
            )

    # Sector-type check: EV/EBITDA comps are not meaningful for Financial-sector targets.
    target_sector_type = target_row.get("sector_type")
    if target_sector_type == "Financial":
        warnings_out.append(
            "comps: target is a Financial-sector company (bank/NBFC/insurance) -- "
            "EV/EBITDA comps are not meaningful; interest is a core operating cost, "
            "not a financing add-back. EV/EBITDA valuation range should be disregarded."
        )

    return (
        {
            "peer_count": peer_count,
            "peer_group": peers["company_id"].tolist(),
            "small_sample_warning": small_sample,
            "multiples": multiples,
            "valuation": valuation_ranges,
        },
        warnings_out,
    )


def _build_precedents_section(
    transactions_df: pd.DataFrame,
    target_row: pd.Series,
    sector: str | None,
) -> tuple[dict, list[str]]:
    """
    Runs the precedents workflow and returns a structured section plus any warnings.

    EV/EBITDA is included only when target EBITDA is not None AND at least one
    transaction has ev_ebitda. Otherwise it is set to None with an explicit warning.
    """
    warnings_out: list[str] = []

    # If raw transactions DataFrame was passed directly without load_transactions(), derive multiple columns.
    if "ev_revenue" not in transactions_df.columns and "deal_value_cr" in transactions_df.columns:
        transactions_df = transactions_df.copy()
        if "implied_ev_cr" not in transactions_df.columns:
            transactions_df["implied_ev_cr"] = transactions_df.apply(
                lambda r: r["deal_value_cr"] / (r["stake_acquired_pct"] / 100) if pd.notna(r.get("stake_acquired_pct")) and r["stake_acquired_pct"] > 0 else None,
                axis=1,
            )
        if "ev_revenue" not in transactions_df.columns:
            transactions_df["ev_revenue"] = transactions_df.apply(
                lambda r: (r["implied_ev_cr"] / r["target_revenue_cr"]) if pd.notna(r.get("target_revenue_cr")) and r["target_revenue_cr"] != 0 else None,
                axis=1,
            )
        if "ev_ebitda" not in transactions_df.columns:
            transactions_df["ev_ebitda"] = transactions_df.apply(
                lambda r: (r["implied_ev_cr"] / r["target_ebitda_cr"]) if pd.notna(r.get("target_ebitda_cr")) and r["target_ebitda_cr"] != 0 else None,
                axis=1,
            )

    # Filter by sector if requested; otherwise use the full dataset.
    filtered = filter_transactions(transactions_df, sector=sector)
    stats = transaction_statistics(filtered)

    txn_count = stats["transaction_count"]
    small_sample = stats["small_sample_warning"]
    if small_sample:
        warnings_out.append(
            f"precedents: only {txn_count} transaction(s) in the filtered set "
            f"(threshold: 5) -- percentile statistics are not statistically meaningful. "
            f"This is a seed dataset; expand data/transactions.csv for reliable statistics."
        )

    target_ebitda = target_row.get("ebitda_latest")
    target_revenue = target_row.get("revenue_latest")
    target_net_debt = target_row.get("net_debt_latest", 0) or 0

    ev_ebitda_stats = stats.get("ev_ebitda", {})
    ev_ebitda_n = ev_ebitda_stats.get("n", 0)
    if ev_ebitda_n == 0:
        warnings_out.append(
            "precedents: EV/EBITDA precedent multiple unavailable -- no transaction "
            "in the current dataset has target_ebitda_cr populated. "
            "Expand transactions.csv with EBITDA data to enable this methodology."
        )

    # Build multiples summary.
    multiples: dict = {}
    for mkey in ("ev_revenue", "ev_ebitda"):
        m = stats.get(mkey, {})
        multiples[mkey] = {
            "p25": m.get("p25"),
            "median": m.get("median"),
            "p75": m.get("p75"),
            "n": m.get("n", 0),
        }

    # Build valuation ranges at P25 / median / P75.
    valuation_ranges: dict = {}
    for mkey in ("ev_revenue", "ev_ebitda"):
        m_stats = stats.get(mkey, {})
        if m_stats.get("n", 0) == 0:
            valuation_ranges[mkey] = None
            continue

        range_vals: dict = {}
        for label, pct_key in (("low", "p25"), ("mid", "median"), ("high", "p75")):
            implied = implied_valuation_from_precedents(
                target_revenue_cr=target_revenue,
                target_ebitda_cr=target_ebitda,
                target_net_debt_cr=target_net_debt,
                stats=stats,
                percentile=pct_key,
            )
            entry = implied.get(mkey)
            range_vals[label] = {
                "multiple": m_stats.get(pct_key),
                "implied_equity_value": entry["implied_equity_value"] if entry else None,
            }
        valuation_ranges[mkey] = range_vals

    return (
        {
            "transaction_count": txn_count,
            "small_sample_warning": small_sample,
            "multiples": multiples,
            "valuation": valuation_ranges,
        },
        warnings_out,
    )


def _build_dcf_section(
    target_row: pd.Series,
    financials_df: pd.DataFrame | None,
    dcf_params: dict | None,
) -> tuple[dict | None, list[str]]:
    """
    Runs the DCF and returns a structured section plus any warnings.

    DCF requires several inputs (tax rate, D&A%, CapEx%) that only come from
    raw financials. If financials_df is omitted AND dcf_params does not supply
    all required keys, DCF is skipped and a warning is added.

    Returns (None, [warning]) if DCF cannot run.
    """
    warnings_out: list[str] = []

    # Required keys that ARE available in metrics_df.
    latest_revenue = target_row.get("revenue_latest")
    net_debt = target_row.get("net_debt_latest")
    shares = target_row.get("shares_outstanding_latest")
    market_cap = target_row.get("market_cap_latest")
    ebitda_margin = target_row.get("ebitda_margin")
    revenue_growth = target_row.get("revenue_cagr")

    # Required keys that need raw financials unless overridden.
    total_debt = None
    interest_expense = None
    da_pct = None
    capex_pct = None
    tax_rate = None

    if financials_df is not None:
        company_id = target_row.get("company_id")
        fin = financials_df[financials_df["company_id"] == company_id].sort_values("fiscal_year")
        if not fin.empty:
            latest = fin.iloc[-1]
            pbt = latest.get("pbt")
            tax = latest.get("tax")
            if pd.notna(pbt) and pbt > 0 and pd.notna(tax):
                tax_rate = min(max(float(tax) / float(pbt), 0.0), 0.40)
            else:
                tax_rate = 0.25  # disclosed default when PBT is missing/negative

            if pd.notna(latest.get("depreciation")) and pd.notna(latest.get("revenue")) and float(latest["revenue"]) > 0:
                da_pct = float(latest["depreciation"]) / float(latest["revenue"])
            else:
                da_pct = 0.03  # disclosed default when depreciation is missing

            if pd.notna(latest.get("cfi")) and pd.notna(latest.get("revenue")) and float(latest["revenue"]) > 0:
                capex_pct = max(-float(latest["cfi"]), 0.0) / float(latest["revenue"])
            else:
                capex_pct = 0.05  # disclosed default

            total_debt = float(latest["total_debt"]) if pd.notna(latest.get("total_debt")) else 0.0
            interest_expense = float(latest["interest"]) if pd.notna(latest.get("interest")) else 0.0

    # Apply explicit overrides from dcf_params (highest priority).
    params = dict(dcf_params) if dcf_params else {}
    total_debt = params.pop("total_debt_cr", total_debt)
    interest_expense = params.pop("interest_expense_cr", interest_expense)
    da_pct = params.pop("da_pct_revenue", da_pct)
    capex_pct = params.pop("capex_pct_revenue", capex_pct)
    tax_rate = params.pop("tax_rate", tax_rate)
    net_debt = params.pop("net_debt_cr", net_debt)
    shares = params.pop("shares_outstanding", shares)
    market_cap = params.pop("market_cap_cr", market_cap)
    ebitda_margin = params.pop("ebitda_margin", ebitda_margin)
    revenue_growth = params.pop("revenue_growth", revenue_growth)
    latest_revenue = params.pop("latest_revenue_cr", latest_revenue)

    # Check we have everything needed.
    missing = [
        k for k, v in [
            ("latest_revenue_cr", latest_revenue),
            ("ebitda_margin", ebitda_margin),
            ("revenue_growth", revenue_growth),
            ("da_pct_revenue", da_pct),
            ("capex_pct_revenue", capex_pct),
            ("tax_rate", tax_rate),
        ] if v is None or (isinstance(v, float) and pd.isna(v))
    ]
    if missing:
        warnings_out.append(
            f"dcf: cannot run -- missing required input(s): {missing}. "
            f"Pass financials_df or supply dcf_params with the missing keys."
        )
        return None, warnings_out

    try:
        result = dcf_valuation(
            latest_revenue_cr=float(latest_revenue),
            net_debt_cr=float(net_debt) if pd.notna(net_debt) else 0.0,
            shares_outstanding=float(shares) if shares and pd.notna(shares) else None,
            market_cap_cr=float(market_cap) if pd.notna(market_cap) else 0.0,
            total_debt_cr=float(total_debt) if total_debt is not None and pd.notna(total_debt) else 0.0,
            interest_expense_cr=float(interest_expense) if interest_expense is not None and pd.notna(interest_expense) else 0.0,
            ebitda_margin=float(ebitda_margin),
            da_pct_revenue=float(da_pct),
            capex_pct_revenue=float(capex_pct),
            tax_rate=float(tax_rate),
            revenue_growth=float(revenue_growth) if pd.notna(revenue_growth) else 0.08,
            **params,  # forward remaining overrides (terminal_growth, forecast_years, wacc, beta, etc.)
        )
    except Exception as exc:  # noqa: BLE001
        warnings_out.append(f"dcf: computation failed -- {exc}")
        return None, warnings_out

    # Propagate DCF-internal warnings with source tag.
    for w in result.get("warnings", []):
        warnings_out.append(f"dcf: {w}")

    wacc_detail = result.get("wacc_detail") or {}
    section = {
        "implied_ev": result["implied_ev"],
        "implied_equity_value": result["implied_equity_value"],
        "implied_value_per_share": result.get("implied_value_per_share"),
        "wacc": result["wacc_used"],
        "terminal_growth": result["terminal_growth"],
        "assumptions": {
            "revenue_growth": float(revenue_growth) if pd.notna(revenue_growth) else 0.08,
            "ebitda_margin": float(ebitda_margin),
            "da_pct_revenue": float(da_pct),
            "capex_pct_revenue": float(capex_pct),
            "tax_rate": float(tax_rate),
            "forecast_years": result["forecast"].shape[0],
        },
        "wacc_detail": wacc_detail,
        "pv_explicit_fcff": result["pv_explicit_fcff"],
        "pv_terminal_value": result["pv_terminal_value"],
        "warnings": result.get("warnings", []),
    }
    return section, warnings_out


def _build_valuation_table(
    comps: dict,
    precedents: dict,
    dcf: dict | None,
) -> list[dict]:
    """
    Builds the football-field summary table: one row per methodology,
    showing Low / Mid / High implied equity values (Rs Cr).

    DCF is a single-point estimate; Low and High are None.
    """
    rows = []

    method_map = [
        ("Comps \u2014 EV/Revenue",      comps.get("valuation", {}).get("ev_revenue")),
        ("Comps \u2014 EV/EBITDA",       comps.get("valuation", {}).get("ev_ebitda")),
        ("Comps \u2014 P/E",             comps.get("valuation", {}).get("pe_ratio")),
        ("Precedents \u2014 EV/Revenue", precedents.get("valuation", {}).get("ev_revenue")),
        ("Precedents \u2014 EV/EBITDA",  precedents.get("valuation", {}).get("ev_ebitda")),
    ]

    for label, val_range in method_map:
        if val_range is None:
            rows.append({
                "methodology": label,
                "low_multiple": None,
                "mid_multiple": None,
                "high_multiple": None,
                "low": None,
                "mid": None,
                "high": None,
                "available": False,
            })
        else:
            rows.append({
                "methodology": label,
                "low_multiple": (val_range.get("low") or {}).get("multiple"),
                "mid_multiple": (val_range.get("mid") or {}).get("multiple"),
                "high_multiple": (val_range.get("high") or {}).get("multiple"),
                "low": (val_range.get("low") or {}).get("implied_equity_value"),
                "mid": (val_range.get("mid") or {}).get("implied_equity_value"),
                "high": (val_range.get("high") or {}).get("implied_equity_value"),
                "available": True,
            })

    dcf_equity = dcf["implied_equity_value"] if dcf else None
    rows.append({
        "methodology": "DCF",
        "low_multiple": None,
        "mid_multiple": None,
        "high_multiple": None,
        "low": None,
        "mid": dcf_equity,
        "high": None,
        "available": dcf is not None,
    })

    return rows


def valuation_summary(
    target_id: str,
    metrics_df: pd.DataFrame,
    transactions_df: pd.DataFrame,
    financials_df: pd.DataFrame | None = None,
    peer_ids: list[str] | None = None,
    comps_percentile: str = "median",
    sector: str | None = None,
    precedents_percentile: str = "median",
    dcf_params: dict | None = None,
) -> dict:
    """
    Unified valuation summary for a single target company.

    Combines Comparable Companies, Precedent Transactions, and DCF into a
    structured output that exposes each methodology's valuation range
    independently -- no blended "fair value" is produced.

    Parameters
    ----------
    target_id : str
        company_id as it appears in metrics_df (and companies.csv).
    metrics_df : pd.DataFrame
        Output of screening.compute_metrics() -- one row per company with
        EV, multiples, sector, and market data.
    transactions_df : pd.DataFrame
        Output of precedents.load_transactions() -- M&A deal dataset.
    financials_df : pd.DataFrame | None
        Long-format annual financials (from financials.csv). Required for
        DCF to derive tax rate, D&A%, and CapEx% automatically. If None,
        DCF only runs when dcf_params supplies those values explicitly.
    peer_ids : list[str] | None
        Explicit list of peer company_ids. Overrides industry-based peer
        selection if provided.
    comps_percentile : str
        Which percentile to highlight in the comps output ("p25", "median",
        "p75"). Does not affect the ranges, which always include all three.
    sector : str | None
        Sector filter applied to both comps (overrides industry-match) and
        precedent transactions (filters the deal dataset). None = no filter.
    precedents_percentile : str
        Which percentile to highlight in precedents output.
    dcf_params : dict | None
        Optional overrides for any dcf_valuation() argument. Keys match
        dcf_valuation() parameter names. Use to override CapEx%, WACC,
        terminal growth, etc. when the auto-derived defaults are unsuitable
        (e.g. for conglomerates where -cfi overstates CapEx).

    Returns
    -------
    dict with keys: target, comps, precedents, dcf, valuation_table,
                    warnings, data_quality.

    Raises
    ------
    ValueError
        If target_id is not found in metrics_df.
    """
    # -- Locate target ---------------------------------------------------------
    target_rows = metrics_df[metrics_df["company_id"] == target_id]
    if target_rows.empty:
        raise ValueError(
            f"Target '{target_id}' not found in metrics_df. "
            f"Check that compute_metrics() was run with a sector_mapping that includes this company."
        )
    target_row = target_rows.iloc[0]

    all_warnings: list[str] = []

    # Warn when critical financial fields are missing for the target.
    if pd.isna(target_row.get("ebitda_latest")):
        all_warnings.append(
            "data_quality: target EBITDA is missing -- EV/EBITDA comps and "
            "precedent EV/EBITDA will be unavailable."
        )
    if pd.isna(target_row.get("net_debt_latest")):
        all_warnings.append(
            "data_quality: target net_debt is missing (unknown Borrowings) -- "
            "EV and implied equity values derived from EV multiples may be unreliable. "
            "net_debt treated as 0 where required to avoid propagating NaN."
        )

    # -- Section: target identity ----------------------------------------------
    target_section = {
        "company_id": target_id,
        "sector": target_row.get("sector"),
        "industry": target_row.get("industry"),
        "sector_type": target_row.get("sector_type"),
        "market_cap_latest": target_row.get("market_cap_latest"),
        "current_price": target_row.get("current_price"),
        "ev": target_row.get("ev"),
        "net_debt_latest": target_row.get("net_debt_latest"),
        "revenue_latest": target_row.get("revenue_latest"),
        "ebitda_latest": target_row.get("ebitda_latest"),
        "ebitda_margin": target_row.get("ebitda_margin"),
        "revenue_cagr": target_row.get("revenue_cagr"),
    }

    # -- Section: comparable companies -----------------------------------------
    comps_section, comps_warnings = _build_comps_section(
        metrics_df=metrics_df,
        target_id=target_id,
        target_row=target_row,
        peer_ids=peer_ids,
        sector=sector,
    )
    all_warnings.extend(comps_warnings)

    # -- Section: precedent transactions ---------------------------------------
    precedents_section, precedents_warnings = _build_precedents_section(
        transactions_df=transactions_df,
        target_row=target_row,
        sector=sector,
    )
    all_warnings.extend(precedents_warnings)

    # -- Section: DCF ----------------------------------------------------------
    dcf_section, dcf_warnings = _build_dcf_section(
        target_row=target_row,
        financials_df=financials_df,
        dcf_params=dcf_params,
    )
    all_warnings.extend(dcf_warnings)

    # -- Football-field table --------------------------------------------------
    valuation_table = _build_valuation_table(comps_section, precedents_section, dcf_section)

    # -- Data quality summary --------------------------------------------------
    ev_rev_n = (precedents_section.get("multiples") or {}).get("ev_revenue", {}).get("n", 0)
    ev_ebitda_n = (precedents_section.get("multiples") or {}).get("ev_ebitda", {}).get("n", 0)

    data_quality = {
        "peer_count": comps_section.get("peer_count", 0),
        "comps_small_sample": comps_section.get("small_sample_warning", False),
        "comps_ev_ebitda_available": (
            (comps_section.get("multiples") or {}).get("ev_ebitda", {}).get("n", 0) > 0
        ),
        "comps_pe_available": (
            (comps_section.get("multiples") or {}).get("pe_ratio", {}).get("n", 0) > 0
        ),
        "precedent_count": precedents_section.get("transaction_count", 0),
        "precedents_small_sample": precedents_section.get("small_sample_warning", False),
        "precedent_ev_revenue_count": ev_rev_n,
        "precedent_ev_ebitda_count": ev_ebitda_n,
        "precedent_ev_revenue_available": ev_rev_n > 0,
        "precedent_ev_ebitda_available": ev_ebitda_n > 0,
        "shares_outstanding_is_stale": bool(target_row.get("shares_outstanding_is_stale")),
        "dcf_available": dcf_section is not None,
        "dcf_has_warnings": bool(
            dcf_section is not None and dcf_section.get("warnings")
        ),
        "target_ebitda_available": pd.notna(target_row.get("ebitda_latest")),
        "target_net_debt_available": pd.notna(target_row.get("net_debt_latest")),
    }

    return {
        "target": target_section,
        "comps": comps_section,
        "precedents": precedents_section,
        "dcf": dcf_section,
        "valuation_table": valuation_table,
        "warnings": all_warnings,
        "data_quality": data_quality,
    }


# ---------------------------------------------------------------------------
# CLI: consistent with other analytics modules
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    sys.path.insert(0, ".")

    from analytics.screening import compute_metrics
    from analytics.precedents import load_transactions

    data_dir = sys.argv[1] if len(sys.argv) > 1 else "data"
    target = sys.argv[2] if len(sys.argv) > 2 else None

    if target is None:
        print("Usage: python analytics/valuation.py <data_dir> <target_company_id>")
        sys.exit(0)

    companies = pd.read_csv(f"{data_dir}/companies.csv")
    financials = pd.read_csv(f"{data_dir}/financials.csv")
    sectors = pd.read_csv(f"{data_dir}/sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)
    transactions = load_transactions(f"{data_dir}/transactions.csv")

    result = valuation_summary(
        target_id=target,
        metrics_df=metrics,
        transactions_df=transactions,
        financials_df=financials,
    )

    tgt = result["target"]
    print(f"\n{'='*72}")
    print(f"  VALUATION SUMMARY: {target}")
    print(f"{'='*72}")
    print(f"  Sector: {tgt['sector']}  |  Industry: {tgt['industry']}")
    print(f"  Market Cap: Rs {tgt['market_cap_latest']:,.1f} Cr  |  EV: Rs {tgt['ev']:,.1f} Cr")
    print(f"  Revenue: Rs {tgt['revenue_latest']:,.1f} Cr  |  EBITDA Margin: {(tgt['ebitda_margin'] or 0)*100:.1f}%")
    print(f"  Revenue CAGR: {(tgt['revenue_cagr'] or 0)*100:.1f}%")

    if result["warnings"]:
        print(f"\n{'='*72}")
        print("  WARNINGS")
        print(f"{'='*72}")
        for w in result["warnings"]:
            print(f"  ! {w}")

    print(f"\n{'='*72}")
    print("  FOOTBALL FIELD (Implied Equity Value, Rs Cr)")
    print(f"{'='*72}")
    print(f"  {'Methodology':<30}  {'Low':>15}  {'Mid':>15}  {'High':>15}")
    print(f"  {'-'*30}  {'-'*15}  {'-'*15}  {'-'*15}")
    for row in result["valuation_table"]:
        def _fmt(v):
            return f"{v:>15,.0f}" if v is not None else f"{'—':>15}"
        print(f"  {row['methodology']:<30}  {_fmt(row['low'])}  {_fmt(row['mid'])}  {_fmt(row['high'])}")

    print(f"\n  Actual market cap: Rs {tgt['market_cap_latest']:,.0f} Cr")

    dq = result["data_quality"]
    print(f"\n{'='*72}")
    print("  DATA QUALITY")
    print(f"{'='*72}")
    print(f"  Comparable peers:          {dq['peer_count']} {'(small sample)' if dq['comps_small_sample'] else ''}")
    print(f"  Precedent transactions:    {dq['precedent_count']} (EV/Rev: {dq['precedent_ev_revenue_count']}, EV/EBITDA: {dq['precedent_ev_ebitda_count']})")
    print(f"  DCF available:             {'Yes' if dq['dcf_available'] else 'No'}")
    print(f"  DCF has warnings:          {'Yes' if dq['dcf_has_warnings'] else 'No'}")
    print(f"{'='*72}\n")
