"""
dcf.py

Phase 4.5: Discounted Cash Flow valuation.

FCFF = EBIT x (1 - Tax Rate) + D&A - CapEx - Change in NWC
TV = FCFF_(final year) x (1 + g) / (WACC - g)
EV = PV(explicit FCFF) + PV(TV)
Equity Value = EV - Net Debt

DATA GAPS AND HOW THEY'RE HANDLED (see docs/methodology.md for the full
writeup once this module is validated against real data):

  - CapEx is not a stored field. Approximated as cash used in investing
    activity (-cfi from the cash flow statement), floored at zero. This
    overstates CapEx whenever a company made acquisitions/investments
    (not pure capex) in that period -- a disclosed simplification.
  - Change in NWC: no working capital data (receivables/payables/
    inventory) exists in the schema. ASSUMED ZERO for V0. This is a real
    simplification, not a neutral default -- it understates FCFF for a
    genuinely growing company, which typically needs more working
    capital as it scales.
  - WACC defaults to a CAPM estimate with disclosed assumptions
    (risk-free rate, equity risk premium, beta=1.0) rather than silently
    requiring the caller to already have one -- but every input is a
    named, overridable parameter, never hidden inside the formula.
"""

from __future__ import annotations

import pandas as pd


def compute_wacc(
    market_cap_cr: float,
    total_debt_cr: float,
    interest_expense_cr: float,
    tax_rate: float,
    risk_free_rate: float = 0.07,
    equity_risk_premium: float = 0.06,
    beta: float = 1.0,
) -> dict:
    """
    CAPM-based WACC estimate.
    Cost of Equity = risk_free_rate + beta * equity_risk_premium
    Cost of Debt (pre-tax) = interest_expense / total_debt (proxy; ideally
      average debt over the period, but only latest-year figures are
      available in V0)
    Cost of Debt (after-tax) = pre-tax cost of debt * (1 - tax_rate)
    Weights = market_cap / (market_cap + total_debt), and the complement
    """
    cost_of_equity = risk_free_rate + beta * equity_risk_premium

    cost_of_debt_pretax = (interest_expense_cr / total_debt_cr) if total_debt_cr > 0 else 0.0
    cost_of_debt_after_tax = cost_of_debt_pretax * (1 - tax_rate)

    total_capital = market_cap_cr + total_debt_cr
    equity_weight = (market_cap_cr / total_capital) if total_capital > 0 else 1.0
    debt_weight = (total_debt_cr / total_capital) if total_capital > 0 else 0.0

    wacc = equity_weight * cost_of_equity + debt_weight * cost_of_debt_after_tax

    return {
        "cost_of_equity": cost_of_equity,
        "cost_of_debt_pretax": cost_of_debt_pretax,
        "cost_of_debt_after_tax": cost_of_debt_after_tax,
        "equity_weight": equity_weight,
        "debt_weight": debt_weight,
        "wacc": wacc,
    }


def project_fcff(
    latest_revenue_cr: float,
    revenue_growth: float,
    ebitda_margin: float,
    da_pct_revenue: float,
    capex_pct_revenue: float,
    tax_rate: float,
    forecast_years: int = 5,
) -> pd.DataFrame:
    """
    Builds a simple flat-assumption forecast: revenue grows at a constant
    rate, margin/D&A%/CapEx% held flat at their (defaulted-or-overridden)
    starting values. Change in NWC is assumed zero throughout -- see
    module docstring.
    """
    rows = []
    revenue = latest_revenue_cr

    for year in range(1, forecast_years + 1):
        revenue = revenue * (1 + revenue_growth)
        ebitda = revenue * ebitda_margin
        da = revenue * da_pct_revenue
        ebit = ebitda - da
        tax_expense = max(ebit, 0) * tax_rate  # no tax benefit assumed on a loss-making forecast year
        nopat = ebit - tax_expense
        capex = revenue * capex_pct_revenue
        change_nwc = 0.0  # V0 simplification -- see module docstring
        fcff = nopat + da - capex - change_nwc

        rows.append(
            {
                "forecast_year": year,
                "revenue": revenue,
                "ebitda": ebitda,
                "da": da,
                "ebit": ebit,
                "tax_expense": tax_expense,
                "nopat": nopat,
                "capex": capex,
                "change_nwc": change_nwc,
                "fcff": fcff,
            }
        )

    return pd.DataFrame(rows)


def terminal_value(final_year_fcff: float, wacc: float, terminal_growth: float) -> float:
    """
    TV as of the END of the explicit forecast period (not yet discounted
    to present). Raises if terminal_growth >= wacc, which would make the
    Gordon Growth denominator zero or negative -- a real DCF input error,
    not something to silently produce a nonsense (or infinite) number for.
    """
    if terminal_growth >= wacc:
        raise ValueError(f"terminal_growth ({terminal_growth}) must be less than WACC ({wacc}) -- Gordon Growth formula is undefined otherwise.")
    return final_year_fcff * (1 + terminal_growth) / (wacc - terminal_growth)


def discount_to_present(fcff_series: pd.Series, terminal_value_undiscounted: float, wacc: float) -> dict:
    """
    Discounts each year's FCFF and the terminal value back to present
    using WACC. Terminal value is discounted at the SAME power as the
    final forecast year, since it's valued as of the end of that year.
    """
    n = len(fcff_series)
    pv_fcff = sum(fcff / ((1 + wacc) ** t) for t, fcff in enumerate(fcff_series, start=1))
    pv_terminal_value = terminal_value_undiscounted / ((1 + wacc) ** n)
    enterprise_value = pv_fcff + pv_terminal_value

    return {
        "pv_explicit_fcff": pv_fcff,
        "pv_terminal_value": pv_terminal_value,
        "enterprise_value": enterprise_value,
    }


def dcf_valuation(
    latest_revenue_cr: float,
    net_debt_cr: float,
    shares_outstanding: float,
    market_cap_cr: float,
    total_debt_cr: float,
    interest_expense_cr: float,
    ebitda_margin: float,
    da_pct_revenue: float,
    capex_pct_revenue: float,
    tax_rate: float,
    revenue_growth: float,
    terminal_growth: float = 0.05,
    forecast_years: int = 5,
    wacc: float | None = None,
    risk_free_rate: float = 0.07,
    equity_risk_premium: float = 0.06,
    beta: float = 1.0,
) -> dict:
    """
    Orchestrates the full DCF: WACC (computed unless explicitly overridden)
    -> forecast -> terminal value -> discounting -> implied EV/equity
    value/per-share value.
    """
    wacc_detail = None
    if wacc is None:
        wacc_detail = compute_wacc(
            market_cap_cr=market_cap_cr,
            total_debt_cr=total_debt_cr,
            interest_expense_cr=interest_expense_cr,
            tax_rate=tax_rate,
            risk_free_rate=risk_free_rate,
            equity_risk_premium=equity_risk_premium,
            beta=beta,
        )
        wacc = wacc_detail["wacc"]

    forecast = project_fcff(
        latest_revenue_cr=latest_revenue_cr,
        revenue_growth=revenue_growth,
        ebitda_margin=ebitda_margin,
        da_pct_revenue=da_pct_revenue,
        capex_pct_revenue=capex_pct_revenue,
        tax_rate=tax_rate,
        forecast_years=forecast_years,
    )

    tv = terminal_value(forecast["fcff"].iloc[-1], wacc, terminal_growth)
    discounted = discount_to_present(forecast["fcff"], tv, wacc)

    implied_ev = discounted["enterprise_value"]
    implied_equity_value = implied_ev - net_debt_cr
    implied_value_per_share = (implied_equity_value * 1e7) / shares_outstanding if shares_outstanding else None

    # Assumption sanity checks -- surfaced explicitly rather than left to
    # produce a silently nonsensical implied value. NOPAT + D&A can never
    # exceed EBITDA by construction, so if CapEx% alone exceeds EBITDA
    # margin, FCFF is guaranteed negative every forecast year regardless
    # of any other assumption -- this is a red flag about the CapEx
    # assumption (often the -cfi proxy picking up non-recurring
    # investments/stake purchases, not steady-state capex), not a
    # meaningful valuation result.
    warnings = []
    if capex_pct_revenue > ebitda_margin:
        warnings.append(
            f"CapEx assumption ({capex_pct_revenue*100:.1f}% of revenue) exceeds EBITDA margin "
            f"({ebitda_margin*100:.1f}%) -- FCFF is structurally negative every forecast year "
            f"regardless of other assumptions. This often means the CapEx proxy (cash used in "
            f"investing activity) is picking up non-recurring stake purchases or acquisitions "
            f"rather than steady-state capex. Consider overriding capex_pct_revenue explicitly "
            f"before trusting this DCF output."
        )
    if (forecast["fcff"] < 0).any():
        first_negative_year = forecast[forecast["fcff"] < 0]["forecast_year"].iloc[0]
        warnings.append(
            f"Forecast FCFF is negative starting in year {first_negative_year} -- a flat-growth "
            f"DCF may not suit a company in an active investment/growth phase. Implied valuation "
            f"below should not be trusted without reviewing the assumptions."
        )
    if implied_equity_value < 0:
        warnings.append("Implied equity value is negative -- not a meaningful valuation output. Review the warnings above before using this result.")

    return {
        "wacc_used": wacc,
        "wacc_detail": wacc_detail,
        "terminal_growth": terminal_growth,
        "forecast": forecast,
        "terminal_value_undiscounted": tv,
        "pv_explicit_fcff": discounted["pv_explicit_fcff"],
        "pv_terminal_value": discounted["pv_terminal_value"],
        "implied_ev": implied_ev,
        "implied_equity_value": implied_equity_value,
        "implied_value_per_share": implied_value_per_share,
        "warnings": warnings,
    }


if __name__ == "__main__":
    import sys

    sys.path.insert(0, ".")
    from analytics.screening import compute_metrics

    data_dir = sys.argv[1] if len(sys.argv) > 1 else "data"
    target = sys.argv[2] if len(sys.argv) > 2 else None

    companies = pd.read_csv(f"{data_dir}/companies.csv")
    financials = pd.read_csv(f"{data_dir}/financials.csv")
    sectors = pd.read_csv(f"{data_dir}/sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    if target is None:
        print("Usage: python analytics/dcf.py <data_dir> <target_company_id>")
        sys.exit(0)

    row = metrics[metrics["company_id"] == target].iloc[0]
    fin = financials[financials["company_id"] == target].sort_values("fiscal_year")
    latest = fin.iloc[-1]

    tax_rate = latest["tax"] / latest["pbt"] if latest["pbt"] and latest["pbt"] > 0 else 0.25
    tax_rate = min(max(tax_rate, 0.0), 0.40)  # sanity-bound to a plausible range
    da_pct_revenue = latest["depreciation"] / latest["revenue"]
    capex_pct_revenue = max(-latest["cfi"], 0) / latest["revenue"] if pd.notna(latest["cfi"]) else 0.05

    result = dcf_valuation(
        latest_revenue_cr=row["revenue_latest"],
        net_debt_cr=row["net_debt_latest"],
        shares_outstanding=row["shares_outstanding_latest"],
        market_cap_cr=row["market_cap_latest"],
        total_debt_cr=latest["total_debt"] if pd.notna(latest["total_debt"]) else 0,
        interest_expense_cr=latest["interest"],
        ebitda_margin=row["ebitda_margin"],
        da_pct_revenue=da_pct_revenue,
        capex_pct_revenue=capex_pct_revenue,
        tax_rate=tax_rate,
        revenue_growth=row["revenue_cagr"] if pd.notna(row["revenue_cagr"]) else 0.08,
    )

    print(f"DCF for {target}")
    print(f"WACC used: {result['wacc_used']*100:.2f}%")
    if result["wacc_detail"]:
        d = result["wacc_detail"]
        print(f"  (Cost of Equity {d['cost_of_equity']*100:.2f}%, Cost of Debt after-tax {d['cost_of_debt_after_tax']*100:.2f}%, E-weight {d['equity_weight']*100:.1f}%, D-weight {d['debt_weight']*100:.1f}%)")
    print(f"Terminal growth: {result['terminal_growth']*100:.2f}%")
    print(f"\nAssumptions used: revenue growth={row['revenue_cagr']*100:.2f}%, EBITDA margin={row['ebitda_margin']*100:.2f}%, tax rate={tax_rate*100:.2f}%, D&A%={da_pct_revenue*100:.2f}%, CapEx%={capex_pct_revenue*100:.2f}%")

    if result["warnings"]:
        print(f"\n{'='*70}\nWARNING(S) -- review before trusting this output:\n{'='*70}")
        for w in result["warnings"]:
            print(f"  - {w}")
        print("=" * 70)

    print(f"\nPV of explicit FCFF: Rs {result['pv_explicit_fcff']:.1f} Cr")
    print(f"PV of terminal value: Rs {result['pv_terminal_value']:.1f} Cr")
    print(f"Implied EV: Rs {result['implied_ev']:.1f} Cr")
    print(f"Implied Equity Value: Rs {result['implied_equity_value']:.1f} Cr")
    if result["implied_value_per_share"]:
        print(f"Implied Value/Share: Rs {result['implied_value_per_share']:.2f}")
    print(f"\nActual market cap: Rs {row['market_cap_latest']:.1f} Cr")
