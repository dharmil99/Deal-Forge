"""
deal_model.py

Phase 6: Deal Builder.

Represents an M&A acquisition transaction between an Acquirer and a Target,
incorporating transaction pricing assumptions, financing mix, and cost synergies.
Produces a clean, structured Deal dictionary that serves as the foundation for:
  - Phase 7: Sources & Uses (funding structure & balance sheet reconciliation)
  - Phase 8: Accretion / Dilution (pro-forma EPS, share issuance, interest expense)

DESIGN PRINCIPLES & FINANCIAL CONSISTENCY:
1. Equity Value vs. Enterprise Value:
   - Target Standalone Equity Value: target's market capitalization prior to acquisition.
   - Purchase Equity Value: total consideration paid to acquire 100% of target common shares.
     purchase_equity_value = target_standalone_equity_value * (1 + acquisition_premium).
   - Transaction Enterprise Value (TEV):
     transaction_enterprise_value = purchase_equity_value + target_net_debt.
     NOTE: TEV is only calculated when target_net_debt is known. Missing debt is NEVER
     silently assumed to be zero.
2. Purchase Price Policy:
   - If `purchase_equity_value` is explicitly provided, it takes precedence as the exact
     equity purchase price. If target standalone equity value is available, the implied
     acquisition premium is derived as: (purchase_equity_value / target_equity_value) - 1.0.
   - If `purchase_equity_value` is None, it is derived from `target_equity_value` and
     `acquisition_premium` (defaulting to 0.0 premium if omitted).
3. Financing Mix:
   - Consideration is split into Cash, Debt, and Stock percentages.
   - The financing mix percentages MUST sum to 1.0 (100%) within a small tolerance (1e-4)
     and each must be between 0.0 and 1.0. Invalid mixes raise ValueError.
   - Financing amounts (cash_amount, debt_amount/new_debt_amount, stock_amount/stock_consideration_value)
     are computed on the purchase_equity_value funding base.
   - Pro-forma share issuance is NOT calculated here (Phase 8).
   - Debt repayment schedules and interest expense are NOT calculated here (Phase 8).
4. Synergies:
   - Annual run-rate cost synergies ramp over a 3-year schedule:
     Year 1: annual_synergies * synergy_ramp_year_1
     Year 2: annual_synergies * synergy_ramp_year_2
     Year 3: annual_synergies * synergy_ramp_year_3
   - V0 focuses on cost synergies only. Revenue synergies are excluded.
5. Strict Data Integrity:
   - Missing financial fields are flagged in warnings and kept as None, never fabricated.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to sys.path so standalone execution works
_PROJECT_ROOT = str(Path(__file__).resolve().parents[1])
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import pandas as pd


def _clean_numeric(val: any) -> float | None:
    """Helper to safely convert numeric values, returning None for missing or NaN."""
    if val is None:
        return None
    try:
        f = float(val)
        return None if pd.isna(f) else f
    except (ValueError, TypeError):
        return None


def extract_company_profile(
    company_id: str,
    metrics_df: pd.DataFrame,
    financials_df: pd.DataFrame | None = None,
) -> dict:
    """
    Extracts an acquirer or target profile dictionary from metrics_df and optional financials_df.

    Parameters
    ----------
    company_id : str
        Company identifier matching metrics_df.
    metrics_df : pd.DataFrame
        Output of screening.compute_metrics() containing market and latest fiscal year metrics.
    financials_df : pd.DataFrame | None
        Optional long-format financials dataframe from data/financials.csv for extracting
        latest cash and total_debt.
    """
    rows = metrics_df[metrics_df["company_id"] == company_id]
    if rows.empty:
        raise ValueError(f"Company '{company_id}' not found in metrics_df.")
    r = rows.iloc[0]

    cash = None
    total_debt = None

    if financials_df is not None:
        fin = financials_df[financials_df["company_id"] == company_id].dropna(subset=["fiscal_year"]).sort_values("fiscal_year")
        if not fin.empty:
            latest_fin = fin.iloc[-1]
            cash = _clean_numeric(latest_fin.get("cash"))
            total_debt = _clean_numeric(latest_fin.get("total_debt"))

    market_cap = _clean_numeric(r.get("market_cap_latest"))
    net_debt = _clean_numeric(r.get("net_debt_latest"))
    ev = _clean_numeric(r.get("ev"))

    return {
        "company_id": str(company_id),
        "company_name": r.get("company_name"),
        "sector": r.get("sector"),
        "industry": r.get("industry"),
        "revenue": _clean_numeric(r.get("revenue_latest")),
        "ebitda": _clean_numeric(r.get("ebitda_latest")),
        "net_income": _clean_numeric(r.get("net_income_latest")),
        "market_cap": market_cap,
        "equity_value": market_cap,
        "enterprise_value": ev,
        "net_debt": net_debt,
        "cash": cash,
        "total_debt": total_debt,
        "shares_outstanding": _clean_numeric(r.get("shares_outstanding_latest")),
        "current_price": _clean_numeric(r.get("current_price")),
        "eps": _clean_numeric(r.get("eps")),
    }


def build_deal(
    acquirer: dict,
    target: dict,
    purchase_equity_value: float | None = None,
    acquisition_premium: float | None = None,
    cash_pct: float = 1.0,
    debt_pct: float = 0.0,
    stock_pct: float = 0.0,
    transaction_fees: float = 0.0,
    expected_annual_synergies: float = 0.0,
    synergy_ramp_year_1: float = 0.33,
    synergy_ramp_year_2: float = 0.67,
    synergy_ramp_year_3: float = 1.0,
) -> dict:
    """
    Constructs a structured acquisition deal model.

    Parameters
    ----------
    acquirer : dict
        Acquirer financial profile containing company_id, revenue, ebitda, net_income,
        market_cap, cash, total_debt, shares_outstanding, current_price, eps.
    target : dict
        Target financial profile containing company_id, revenue, ebitda, net_income,
        enterprise_value, equity_value (or market_cap), net_debt, shares_outstanding,
        current_price, eps.
    purchase_equity_value : float | None
        Explicit purchase equity value (Rs Cr). If supplied, takes precedence over
        acquisition_premium.
    acquisition_premium : float | None
        Acquisition premium as a decimal fraction (e.g. 0.20 for 20%). Used to derive
        purchase_equity_value when purchase_equity_value is not supplied.
    cash_pct : float
        Proportion of consideration funded via cash (0.0 to 1.0).
    debt_pct : float
        Proportion of consideration funded via new debt (0.0 to 1.0).
    stock_pct : float
        Proportion of consideration funded via stock issuance (0.0 to 1.0).
    transaction_fees : float
        Advisory, legal, and financing transaction expenses (Rs Cr). Default 0.0.
    expected_annual_synergies : float
        Expected steady-state annual cost synergies (Rs Cr). Default 0.0.
    synergy_ramp_year_1 : float
        Synergy realization percentage in Year 1 (default 0.33).
    synergy_ramp_year_2 : float
        Synergy realization percentage in Year 2 (default 0.67).
    synergy_ramp_year_3 : float
        Synergy realization percentage in Year 3 (default 1.0).

    Returns
    -------
    dict
        Structured deal dictionary with keys: acquirer, target, transaction,
        financing, synergies, warnings.
    """
    warnings: list[str] = []

    # -- Validate Acquirer Profile ---------------------------------------------
    acq_id = acquirer.get("company_id", "UnknownAcquirer")
    acq_clean = {
        "company_id": acq_id,
        "company_name": acquirer.get("company_name"),
        "revenue": _clean_numeric(acquirer.get("revenue")),
        "ebitda": _clean_numeric(acquirer.get("ebitda", acquirer.get("EBITDA"))),
        "net_income": _clean_numeric(acquirer.get("net_income")),
        "market_cap": _clean_numeric(acquirer.get("market_cap", acquirer.get("equity_value"))),
        "cash": _clean_numeric(acquirer.get("cash")),
        "total_debt": _clean_numeric(acquirer.get("total_debt")),
        "shares_outstanding": _clean_numeric(acquirer.get("shares_outstanding")),
        "current_price": _clean_numeric(acquirer.get("current_price")),
        "eps": _clean_numeric(acquirer.get("eps", acquirer.get("EPS"))),
    }

    # -- Validate Target Profile -----------------------------------------------
    tgt_id = target.get("company_id", "UnknownTarget")
    tgt_equity = _clean_numeric(target.get("equity_value", target.get("market_cap")))
    tgt_net_debt = _clean_numeric(target.get("net_debt"))
    t_debt = _clean_numeric(target.get("total_debt"))
    t_cash = _clean_numeric(target.get("cash"))

    # If net_debt is None, try computing from total_debt and cash if both are present
    if tgt_net_debt is None:
        if t_debt is not None and t_cash is not None:
            tgt_net_debt = t_debt - t_cash

    tgt_ev = _clean_numeric(target.get("enterprise_value", target.get("ev")))
    # If enterprise value is missing but standalone equity and net debt are known, derive it
    if tgt_ev is None and tgt_equity is not None and tgt_net_debt is not None:
        tgt_ev = tgt_equity + tgt_net_debt

    tgt_clean = {
        "company_id": tgt_id,
        "company_name": target.get("company_name"),
        "revenue": _clean_numeric(target.get("revenue")),
        "ebitda": _clean_numeric(target.get("ebitda", target.get("EBITDA"))),
        "net_income": _clean_numeric(target.get("net_income")),
        "enterprise_value": tgt_ev,
        "equity_value": tgt_equity,
        "net_debt": tgt_net_debt,
        "cash": t_cash,
        "total_debt": t_debt,
        "shares_outstanding": _clean_numeric(target.get("shares_outstanding")),
        "current_price": _clean_numeric(target.get("current_price")),
        "eps": _clean_numeric(target.get("eps", target.get("EPS"))),
    }

    # Data quality diagnostics on critical inputs
    for key, val in [("revenue", tgt_clean["revenue"]), ("ebitda", tgt_clean["ebitda"]), ("net_income", tgt_clean["net_income"])]:
        if val is None:
            warnings.append(f"target: {key} is missing/null -- pro-forma financial metrics cannot be fully evaluated.")

    if tgt_clean["shares_outstanding"] is None:
        warnings.append("target: shares_outstanding is missing/null -- per-share offer price cannot be calculated.")

    # -- Validate Financing Mix ------------------------------------------------
    cash_pct_num = _clean_numeric(cash_pct) or 0.0
    debt_pct_num = _clean_numeric(debt_pct) or 0.0
    stock_pct_num = _clean_numeric(stock_pct) or 0.0

    if any(p < 0.0 or p > 1.0 for p in (cash_pct_num, debt_pct_num, stock_pct_num)):
        raise ValueError(
            f"Invalid financing mix: individual percentages must be between 0.0 and 1.0. "
            f"Got cash={cash_pct_num}, debt={debt_pct_num}, stock={stock_pct_num}"
        )

    mix_sum = cash_pct_num + debt_pct_num + stock_pct_num
    if abs(mix_sum - 1.0) > 1e-4:
        raise ValueError(
            f"Invalid financing mix: cash_pct ({cash_pct_num:.4f}) + debt_pct ({debt_pct_num:.4f}) + "
            f"stock_pct ({stock_pct_num:.4f}) = {mix_sum:.4f}; must sum to exactly 1.0 (100%)."
        )

    # -- Calculate Purchase Equity Value & Acquisition Premium -----------------
    p_equity = _clean_numeric(purchase_equity_value)
    prem = _clean_numeric(acquisition_premium)

    if p_equity is not None:
        if p_equity <= 0:
            raise ValueError(f"purchase_equity_value must be positive, got {p_equity}.")

        if tgt_equity is not None and tgt_equity > 0:
            implied_premium = (p_equity / tgt_equity) - 1.0
            if prem is not None and abs(prem - implied_premium) > 1e-4:
                warnings.append(
                    f"transaction: explicit purchase_equity_value (Rs {p_equity:,.1f} Cr) overrides supplied "
                    f"acquisition_premium ({prem*100:.1f}%). Implied premium is {implied_premium*100:.2f}%."
                )
            prem = implied_premium
        else:
            if prem is None:
                prem = 0.0
            warnings.append(
                "transaction: target standalone equity value is unavailable; acquisition premium is informational."
            )
    else:
        # Derive purchase_equity_value from target standalone equity and premium
        if tgt_equity is None or tgt_equity <= 0:
            raise ValueError(
                "Cannot determine purchase_equity_value: target standalone equity_value is missing or non-positive, "
                "and explicit purchase_equity_value was not provided."
            )
        if prem is None:
            prem = 0.0
        if prem < -1.0:
            raise ValueError(f"Invalid acquisition_premium: {prem}. Premium cannot be less than -100%.")

        p_equity = tgt_equity * (1.0 + prem)

    if prem is not None and prem < 0.0:
        warnings.append(
            f"transaction: negative acquisition premium ({prem*100:.1f}%) represents a discount to standalone market price."
        )

    # -- Calculate Transaction Enterprise Value --------------------------------
    # TEV = Purchase Equity Value + Target Net Debt
    # If target net debt is missing, TEV cannot be reliably determined.
    tev = None
    if tgt_net_debt is not None:
        tev = p_equity + tgt_net_debt
    else:
        warnings.append(
            "transaction: target net_debt is missing/unknown -- transaction_enterprise_value cannot be calculated "
            "without assuming debt is zero. It is set to None to avoid inventing financial data."
        )

    # Transaction fees
    fees = _clean_numeric(transaction_fees) or 0.0
    if fees < 0:
        raise ValueError(f"transaction_fees cannot be negative, got {fees}.")

    total_transaction_value = p_equity + fees

    # Offer price per target share where share count is available
    offer_price_per_share = None
    if tgt_clean["shares_outstanding"] and tgt_clean["shares_outstanding"] > 0:
        # p_equity is in Rs Cr (10^7 Rs); shares_outstanding is raw count
        offer_price_per_share = (p_equity * 1e7) / tgt_clean["shares_outstanding"]

    transaction_section = {
        "target_standalone_equity_value": tgt_equity,
        "acquisition_premium": prem,
        "purchase_equity_value": p_equity,
        "offer_price_per_share": offer_price_per_share,
        "target_net_debt": tgt_net_debt,
        "transaction_enterprise_value": tev,
        "transaction_fees": fees,
        "total_transaction_value": total_transaction_value,
    }

    # -- Calculate Financing Mix Amounts ---------------------------------------
    # Consideration paid to target equity holders = purchase_equity_value
    cash_amount = p_equity * cash_pct_num
    debt_amount = p_equity * debt_pct_num
    stock_amount = p_equity * stock_pct_num

    # Acquirer cash check
    if acq_clean["cash"] is not None and cash_amount > acq_clean["cash"]:
        warnings.append(
            f"financing: cash consideration (Rs {cash_amount:,.1f} Cr) exceeds acquirer standalone cash balance "
            f"(Rs {acq_clean['cash']:,.1f} Cr) -- requires external cash raising or operating cash flow draw."
        )

    financing_section = {
        "funding_amount": p_equity,
        "cash_pct": cash_pct_num,
        "debt_pct": debt_pct_num,
        "stock_pct": stock_pct_num,
        "cash_amount": cash_amount,
        "debt_amount": debt_amount,
        "stock_amount": stock_amount,
        "stock_consideration_value": stock_amount,
        "new_debt_amount": debt_amount,
    }

    # -- Calculate Synergies Schedule ------------------------------------------
    annual_synergies = _clean_numeric(expected_annual_synergies) or 0.0
    r1 = _clean_numeric(synergy_ramp_year_1) if synergy_ramp_year_1 is not None else 0.33
    r2 = _clean_numeric(synergy_ramp_year_2) if synergy_ramp_year_2 is not None else 0.67
    r3 = _clean_numeric(synergy_ramp_year_3) if synergy_ramp_year_3 is not None else 1.0

    if annual_synergies < 0:
        warnings.append(
            f"synergies: negative annual synergies (Rs {annual_synergies:,.1f} Cr) specified -- "
            f"treated as net integration dis-synergies."
        )

    synergies_section = {
        "annual_run_rate": annual_synergies,
        "synergy_type": "cost",
        "year_1": annual_synergies * r1,
        "year_2": annual_synergies * r2,
        "year_3": annual_synergies * r3,
        "ramp": {
            "year_1_pct": r1,
            "year_2_pct": r2,
            "year_3_pct": r3,
        },
    }

    return {
        "acquirer": acq_clean,
        "target": tgt_clean,
        "transaction": transaction_section,
        "financing": financing_section,
        "synergies": synergies_section,
        "warnings": warnings,
    }


def build_deal_from_universe(
    acquirer_id: str,
    target_id: str,
    metrics_df: pd.DataFrame,
    financials_df: pd.DataFrame | None = None,
    purchase_equity_value: float | None = None,
    acquisition_premium: float | None = None,
    cash_pct: float = 1.0,
    debt_pct: float = 0.0,
    stock_pct: float = 0.0,
    transaction_fees: float = 0.0,
    expected_annual_synergies: float = 0.0,
    synergy_ramp_year_1: float = 0.33,
    synergy_ramp_year_2: float = 0.67,
    synergy_ramp_year_3: float = 1.0,
) -> dict:
    """
    Convenience wrapper to construct a deal directly from the DealForge universe.

    Extracts acquirer and target profiles from metrics_df / financials_df,
    then executes build_deal().
    """
    acquirer_profile = extract_company_profile(acquirer_id, metrics_df, financials_df)
    target_profile = extract_company_profile(target_id, metrics_df, financials_df)

    return build_deal(
        acquirer=acquirer_profile,
        target=target_profile,
        purchase_equity_value=purchase_equity_value,
        acquisition_premium=acquisition_premium,
        cash_pct=cash_pct,
        debt_pct=debt_pct,
        stock_pct=stock_pct,
        transaction_fees=transaction_fees,
        expected_annual_synergies=expected_annual_synergies,
        synergy_ramp_year_1=synergy_ramp_year_1,
        synergy_ramp_year_2=synergy_ramp_year_2,
        synergy_ramp_year_3=synergy_ramp_year_3,
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="DealForge Phase 6: Deal Builder")
    parser.add_argument("data_dir", nargs="?", default="data", help="Path to data directory")
    parser.add_argument("acquirer_id", nargs="?", default="TCS", help="Acquirer company_id")
    parser.add_argument("target_id", nargs="?", default="Infosys", help="Target company_id")
    parser.add_argument("--premium", type=float, default=0.20, help="Acquisition premium (e.g. 0.20 for 20%%)")
    parser.add_argument("--purchase-price", type=float, default=None, help="Explicit purchase equity value (Rs Cr)")
    parser.add_argument("--cash-pct", type=float, default=0.60, help="Cash consideration fraction (default 0.60)")
    parser.add_argument("--debt-pct", type=float, default=0.20, help="Debt consideration fraction (default 0.20)")
    parser.add_argument("--stock-pct", type=float, default=0.20, help="Stock consideration fraction (default 0.20)")
    parser.add_argument("--fees", type=float, default=500.0, help="Transaction fees in Rs Cr (default 500)")
    parser.add_argument("--synergies", type=float, default=1200.0, help="Annual cost synergies in Rs Cr (default 1200)")

    args = parser.parse_args()

    from analytics.screening import compute_metrics

    companies = pd.read_csv(f"{args.data_dir}/companies.csv")
    financials = pd.read_csv(f"{args.data_dir}/financials.csv")
    sectors = pd.read_csv(f"{args.data_dir}/sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    deal = build_deal_from_universe(
        acquirer_id=args.acquirer_id,
        target_id=args.target_id,
        metrics_df=metrics,
        financials_df=financials,
        purchase_equity_value=args.purchase_price,
        acquisition_premium=args.premium,
        cash_pct=args.cash_pct,
        debt_pct=args.debt_pct,
        stock_pct=args.stock_pct,
        transaction_fees=args.fees,
        expected_annual_synergies=args.synergies,
    )

    acq = deal["acquirer"]
    tgt = deal["target"]
    txn = deal["transaction"]
    fin = deal["financing"]
    syn = deal["synergies"]

    print("\n" + "=" * 74)
    print(f"  DEAL BUILDER: {acq['company_id']} acquiring {tgt['company_id']}")
    print("=" * 74)
    print(f"  Acquirer: {acq['company_name'] or acq['company_id']} | MCap: Rs {acq['market_cap']:,.1f} Cr | Cash: Rs {acq['cash'] or 0:,.1f} Cr")
    print(f"  Target:   {tgt['company_name'] or tgt['company_id']} | Standalone MCap: Rs {tgt['equity_value']:,.1f} Cr | Net Debt: Rs {tgt['net_debt'] or 0:,.1f} Cr")

    print("\n" + "-" * 74)
    print("  TRANSACTION STRUCTURE")
    print("-" * 74)
    print(f"  Target Standalone Equity Value:   Rs {txn['target_standalone_equity_value']:>15,.1f} Cr")
    print(f"  Acquisition Premium:                 {(txn['acquisition_premium'] or 0)*100:>14.2f} %")
    print(f"  Purchase Equity Value:            Rs {txn['purchase_equity_value']:>15,.1f} Cr")
    if txn["offer_price_per_share"]:
        print(f"  Offer Price per Share:            Rs {txn['offer_price_per_share']:>15,.2f}")
    if txn["target_net_debt"] is not None:
        print(f"  Target Net Debt:                  Rs {txn['target_net_debt']:>15,.1f} Cr")
    else:
        print(f"  Target Net Debt:                     {'Unknown / None':>15}")
    if txn["transaction_enterprise_value"] is not None:
        print(f"  Transaction Enterprise Value:     Rs {txn['transaction_enterprise_value']:>15,.1f} Cr")
    else:
        print(f"  Transaction Enterprise Value:        {'Unavailable (debt unknown)':>15}")
    print(f"  Transaction Fees:                 Rs {txn['transaction_fees']:>15,.1f} Cr")
    print(f"  Total Transaction Value (Eq+Fees):Rs {txn['total_transaction_value']:>15,.1f} Cr")

    print("\n" + "-" * 74)
    print("  FINANCING MIX")
    print("-" * 74)
    print(f"  Funding Base:                     Rs {fin['funding_amount']:>15,.1f} Cr")
    print(f"  Cash Consideration ({fin['cash_pct']*100:>4.1f}%):       Rs {fin['cash_amount']:>15,.1f} Cr")
    print(f"  New Debt Financing ({fin['debt_pct']*100:>4.1f}%):       Rs {fin['debt_amount']:>15,.1f} Cr")
    print(f"  Stock Consideration ({fin['stock_pct']*100:>4.1f}%):      Rs {fin['stock_amount']:>15,.1f} Cr")

    print("\n" + "-" * 74)
    print("  COST SYNERGY SCHEDULE")
    print("-" * 74)
    print(f"  Annual Run-Rate Synergies:        Rs {syn['annual_run_rate']:>15,.1f} Cr")
    print(f"  Year 1 ({syn['ramp']['year_1_pct']*100:.0f}% ramp):                  Rs {syn['year_1']:>15,.1f} Cr")
    print(f"  Year 2 ({syn['ramp']['year_2_pct']*100:.0f}% ramp):                  Rs {syn['year_2']:>15,.1f} Cr")
    print(f"  Year 3 ({syn['ramp']['year_3_pct']*100:.0f}% ramp):                  Rs {syn['year_3']:>15,.1f} Cr")

    if deal["warnings"]:
        print("\n" + "-" * 74)
        print("  WARNINGS & DIAGNOSTICS")
        print("-" * 74)
        for w in deal["warnings"]:
            print(f"  ! {w}")

    print("=" * 74 + "\n")
