"""
accretion_dilution.py

Phase 8: Accretion / Dilution Analysis.

Calculates the pro-forma earnings-per-share (EPS) impact of an M&A transaction
for the buyer across Years 1, 2, and 3.

ACCOUNTING & FINANCIAL PRINCIPLES:
1. Accretion/Dilution is strictly earnings-based, not enterprise-value-based:
   - Standalone Buyer EPS = Buyer Net Income / Buyer Diluted Shares
   - Pro-Forma Net Income = Buyer Net Income + Target Net Income
                            + After-Tax Synergies
                            - After-Tax Interest Expense on New Debt
                            - After-Tax Foregone Interest Income on Cash Used
   - Pro-Forma Diluted Shares = Buyer Existing Diluted Shares + New Shares Issued
   - Pro-Forma EPS = Pro-Forma Net Income / Pro-Forma Diluted Shares
   - Accretion / Dilution % = ((Pro-Forma EPS / Buyer Standalone EPS) - 1) * 100

2. Stock Consideration & Share Issuance:
   - New shares issued = Stock Consideration Value / Buyer Share Price
   - Consideration is expressed in buyer equity value; converts into buyer shares
     using the BUYER's share price (never target share price).

3. Debt Financing & Foregone Cash Interest:
   - New Debt Interest = New Debt * debt_interest_rate
   - After-Tax Debt Interest = New Debt Interest * (1 - tax_rate)
   - Foregone Interest = Buyer Executable Cash Used * foregone_cash_interest_rate
   - After-Tax Foregone Interest = Foregone Interest * (1 - tax_rate)
   - Uses actual executable buyer cash contribution from Phase 7 (never unfeasible requested cash).

4. Synergies & Realization Ramp:
   - After-Tax Synergies = Gross Synergies * (1 - tax_rate)
   - Realized according to the Year 1 / Year 2 / Year 3 schedule.

5. Break-Even Synergy Analysis:
   - Annual gross synergy required for Pro-Forma EPS == Buyer Standalone EPS:
     Required Pro-Forma NI = Buyer Standalone EPS * Pro-Forma Shares
     Required After-Tax Synergy = Required Pro-Forma NI - (Buyer NI + Target NI - After-Tax Debt Interest - After-Tax Foregone Interest)
     Break-Even Gross Synergy = Required After-Tax Synergy / (1 - tax_rate)

6. Data Availability & Strict Integrity:
   - Never assumes missing net income, shares, or share price are zero.
   - If required inputs are unavailable, marks calculation unavailable and returns
     explicit diagnostic warnings.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to sys.path so standalone execution works
_PROJECT_ROOT = str(Path(__file__).resolve().parents[1])
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import pandas as pd
from analytics.deal_model import build_deal, build_deal_from_universe
from analytics.sources_uses import build_sources_and_uses, build_sources_and_uses_from_universe


def calculate_standalone_eps(
    net_income: float | None,
    shares: float | None,
) -> float | None:
    """
    Calculates standalone earnings per share (EPS).

    Parameters
    ----------
    net_income : float | None
        Net income / profit after tax (Rs Cr).
    shares : float | None
        Diluted share count (either raw count or in Crores).

    Returns
    -------
    float | None
        EPS in Rs per share, or None if inputs are missing or non-positive.
    """
    if net_income is None or shares is None:
        return None
    try:
        ni = float(net_income)
        sh = float(shares)
    except (ValueError, TypeError):
        return None

    if sh <= 0.0:
        return None

    # Normalization: if shares count is large (> 1e5), it represents raw share count,
    # and net income is in Rs Cr (10^7 Rs) -> EPS = (ni * 1e7) / sh.
    # If shares count is <= 1e5, shares is already scaled in Crores or is a normalized unit test.
    if sh > 1e5:
        return float((ni * 1e7) / sh)
    return float(ni / sh)


def calculate_new_shares_issued(
    stock_consideration_value: float,
    buyer_share_price: float | None,
    buyer_shares_is_raw: bool = True,
) -> float | None:
    """
    Calculates the number of new buyer shares issued to target shareholders.

    Parameters
    ----------
    stock_consideration_value : float
        Value of stock consideration in Rs Cr.
    buyer_share_price : float | None
        Buyer's share price in Rs.
    buyer_shares_is_raw : bool
        If True, returns raw share count. If False, returns shares in Crores.

    Returns
    -------
    float | None
        New shares issued, or None if share price is missing or invalid.
    """
    if stock_consideration_value <= 0.0:
        return 0.0

    if buyer_share_price is None:
        return None

    try:
        price = float(buyer_share_price)
    except (ValueError, TypeError):
        return None

    if price <= 0.0:
        return None

    stock_val = float(stock_consideration_value)

    if buyer_shares_is_raw:
        # stock_val is in Rs Cr (10^7 Rs); price is in Rs -> raw shares = (stock_val * 1e7) / price
        return float((stock_val * 1e7) / price)
    # Both in matching units -> shares in Cr = stock_val / price
    return float(stock_val / price)


def calculate_break_even_synergies(
    buyer_standalone_eps: float,
    pro_forma_shares: float,
    buyer_net_income: float,
    target_net_income: float,
    after_tax_debt_interest: float,
    after_tax_foregone_interest: float,
    tax_rate: float,
    shares_is_raw: bool = True,
) -> dict:
    """
    Derives the annual gross and after-tax synergies required for Pro-Forma EPS
    to exactly equal Buyer Standalone EPS.

    Returns
    -------
    dict
        Break-even synergy metrics.
    """
    if tax_rate >= 1.0 or tax_rate < 0.0:
        raise ValueError(f"tax_rate must be in [0.0, 1.0), got {tax_rate}.")

    # Required pro-forma net income in Rs Cr
    if shares_is_raw:
        required_ni = float((buyer_standalone_eps * pro_forma_shares) / 1e7)
    else:
        required_ni = float(buyer_standalone_eps * pro_forma_shares)

    base_ni = float(
        buyer_net_income
        + target_net_income
        - after_tax_debt_interest
        - after_tax_foregone_interest
    )

    required_after_tax_synergy = required_ni - base_ni
    divisor = 1.0 - tax_rate
    required_gross_synergy = (
        required_after_tax_synergy / divisor if divisor > 0.0 else 0.0
    )

    return {
        "required_pro_forma_net_income": required_ni,
        "break_even_after_tax_synergy": required_after_tax_synergy,
        "break_even_gross_synergy": required_gross_synergy,
        "synergies_required": required_after_tax_synergy > 1e-4,
    }


def calculate_accretion_dilution(
    buyer: dict,
    target: dict,
    deal: dict | None = None,
    sources_uses: dict | None = None,
    debt_interest_rate: float = 0.08,
    foregone_cash_interest_rate: float = 0.05,
    tax_rate: float = 0.25,
    synergy_year_1: float | None = None,
    synergy_year_2: float | None = None,
    synergy_year_3: float | None = None,
    stock_consideration_value: float | None = None,
    new_debt: float | None = None,
    buyer_cash_used: float | None = None,
) -> dict:
    """
    Executes a comprehensive Year 1, Year 2, and Year 3 Accretion / Dilution analysis.

    Parameters
    ----------
    buyer : dict
        Buyer company profile with net_income, diluted_shares (or shares_outstanding),
        share_price (or current_price), and cash.
    target : dict
        Target company profile with net_income, diluted_shares, share_price.
    deal : dict | None
        Optional Phase 6 deal object.
    sources_uses : dict | None
        Optional Phase 7 sources and uses object.
    debt_interest_rate : float
        Pre-tax borrowing rate on new debt (default 0.08 = 8.0%).
    foregone_cash_interest_rate : float
        Pre-tax return earned on buyer balance sheet cash (default 0.05 = 5.0%).
    tax_rate : float
        Marginal corporate income tax rate (default 0.25 = 25.0%).
    synergy_year_1, synergy_year_2, synergy_year_3 : float | None
        Optional overrides for pre-tax annual cost synergies in Rs Cr.
    stock_consideration_value : float | None
        Optional override for stock consideration value in Rs Cr.
    new_debt : float | None
        Optional override for new debt financing in Rs Cr.
    buyer_cash_used : float | None
        Optional override for actual executable buyer cash used in Rs Cr.

    Returns
    -------
    dict
        Structured Accretion / Dilution report.
    """
    diagnostics: list[str] = []

    # -- 1. Validate Rates -----------------------------------------------------
    if tax_rate < 0.0 or tax_rate >= 1.0:
        raise ValueError(f"tax_rate must be between 0.0 and 1.0 (exclusive), got {tax_rate}.")
    if debt_interest_rate < 0.0:
        raise ValueError(f"debt_interest_rate cannot be negative, got {debt_interest_rate}.")
    if foregone_cash_interest_rate < 0.0:
        raise ValueError(f"foregone_cash_interest_rate cannot be negative, got {foregone_cash_interest_rate}.")

    # -- 2. Extract Buyer Financials -------------------------------------------
    b_ni_raw = buyer.get("net_income")
    b_ni = float(b_ni_raw) if b_ni_raw is not None else None

    b_sh_raw = buyer.get("diluted_shares")
    if b_sh_raw is None:
        b_sh_raw = buyer.get("shares_outstanding")
    b_sh = float(b_sh_raw) if b_sh_raw is not None else None

    b_px_raw = buyer.get("share_price")
    if b_px_raw is None:
        b_px_raw = buyer.get("current_price")
    b_px = float(b_px_raw) if b_px_raw is not None else None

    b_cash_raw = buyer.get("cash")
    b_cash = float(b_cash_raw) if b_cash_raw is not None else None

    # -- 3. Extract Target Financials ------------------------------------------
    t_ni_raw = target.get("net_income")
    t_ni = float(t_ni_raw) if t_ni_raw is not None else None

    t_sh_raw = target.get("diluted_shares")
    if t_sh_raw is None:
        t_sh_raw = target.get("shares_outstanding")
    t_sh = float(t_sh_raw) if t_sh_raw is not None else None

    t_px_raw = target.get("share_price")
    if t_px_raw is None:
        t_px_raw = target.get("current_price")
    t_px = float(t_px_raw) if t_px_raw is not None else None

    # -- 4. Extract Financing Inputs from Sources & Uses or Deal ---------------
    stock_val = stock_consideration_value
    debt_val = new_debt
    cash_used_val = buyer_cash_used

    if sources_uses is not None:
        src = sources_uses.get("sources", {})
        if stock_val is None:
            stock_val = src.get("stock_issuance")
        if debt_val is None:
            debt_val = src.get("new_debt")
        if cash_used_val is None:
            # Use actual executable acquirer cash, NOT requested cash
            cash_used_val = src.get("acquirer_cash")
    elif deal is not None:
        fin = deal.get("financing", {})
        if stock_val is None:
            stock_val = fin.get("stock_consideration_value") or fin.get("stock_amount")
        if debt_val is None:
            debt_val = fin.get("new_debt_amount") or fin.get("debt_amount")
        if cash_used_val is None:
            cash_used_val = fin.get("cash_amount")

    stock_val = float(stock_val or 0.0)
    debt_val = float(debt_val or 0.0)
    cash_used_val = float(cash_used_val or 0.0)

    # -- 5. Extract Synergy Schedule -------------------------------------------
    s_y1 = synergy_year_1
    s_y2 = synergy_year_2
    s_y3 = synergy_year_3

    if deal is not None:
        syn = deal.get("synergies", {})
        if s_y1 is None:
            s_y1 = syn.get("year_1")
        if s_y2 is None:
            s_y2 = syn.get("year_2")
        if s_y3 is None:
            s_y3 = syn.get("year_3")
        if s_y1 is None and syn.get("annual_synergies") is not None:
            ann = float(syn["annual_synergies"])
            s_y1 = ann * float(syn.get("ramp_year_1", 0.33))
            s_y2 = ann * float(syn.get("ramp_year_2", 0.67))
            s_y3 = ann * float(syn.get("ramp_year_3", 1.00))

    s_y1 = float(s_y1 or 0.0)
    s_y2 = float(s_y2 or 0.0)
    s_y3 = float(s_y3 or 0.0)

    # -- 6. Input Validations & Diagnostics ------------------------------------
    is_available = True

    if b_ni is None:
        diagnostics.append("buyer: net income is missing/None; standalone and pro-forma EPS cannot be calculated.")
        is_available = False

    if b_sh is None or b_sh <= 0.0:
        diagnostics.append("buyer: diluted share count is missing or non-positive; standalone and pro-forma EPS cannot be calculated.")
        is_available = False

    if t_ni is None:
        diagnostics.append("target: net income is missing/None; pro-forma net income cannot be calculated without target earnings.")
        is_available = False

    if t_sh is None or t_sh <= 0.0:
        diagnostics.append("target: diluted share count is missing or non-positive; target standalone EPS is unavailable.")

    if stock_val > 0.0 and (b_px is None or b_px <= 0.0):
        diagnostics.append("buyer: share price is missing or non-positive; new shares issued cannot be determined from stock consideration.")
        is_available = False

    if b_cash is not None and cash_used_val > b_cash:
        diagnostics.append(
            f"buyer_cash: cash used (Rs {cash_used_val:,.1f} Cr) exceeds available buyer cash (Rs {b_cash:,.1f} Cr); "
            f"foregone interest calculation reflects actual executable cash."
        )

    # Feasibility check based on sources_uses, deal, or balance sheet cash
    is_feasible = True

    if sources_uses is not None:
        rec = sources_uses.get("reconciliation", {})
        if "is_feasible" in rec:
            is_feasible = bool(rec["is_feasible"])
        else:
            is_feasible = not any("INFEASIBLE" in str(w).upper() for w in sources_uses.get("warnings", []))
    elif deal is not None:
        fin = deal.get("financing", {})
        acq_cash = buyer.get("cash")
        cash_req = fin.get("cash_amount")
        if acq_cash is not None and cash_req is not None and float(cash_req) > float(acq_cash):
            is_feasible = False
        elif any("exceeds acquirer standalone cash balance" in str(w) for w in deal.get("warnings", [])):
            is_feasible = False
    elif b_cash is not None and cash_used_val > b_cash:
        is_feasible = False

    if any("INFEASIBLE" in str(w).upper() for w in diagnostics):
        is_feasible = False

    if sources_uses is not None:
        for w in sources_uses.get("warnings", []):
            if w not in diagnostics:
                diagnostics.append(w)
            if "INFEASIBLE" in str(w).upper():
                is_feasible = False
    elif deal is not None:
        for w in deal.get("warnings", []):
            if w not in diagnostics:
                diagnostics.append(w)
            if "exceeds acquirer standalone cash balance" in str(w):
                is_feasible = False

    if not is_feasible:
        infeasible_diag = (
            "feasibility: EPS and accretion/dilution results represent a Requested / Illustrative Structure "
            "and do not constitute an Executable Transaction due to financing infeasibility."
        )
        if infeasible_diag not in diagnostics:
            diagnostics.insert(0, infeasible_diag)

    # -- 7. Calculate Standalone EPS -------------------------------------------
    buyer_eps = calculate_standalone_eps(b_ni, b_sh)
    target_eps = calculate_standalone_eps(t_ni, t_sh)

    # Determine whether shares are raw counts (> 1e5)
    shares_is_raw = bool(b_sh is not None and b_sh > 1e5)

    # -- 8. Calculate New Shares Issued & Pro-Forma Shares ---------------------
    new_shares = None
    pro_forma_shares = None

    if is_available:
        new_shares = calculate_new_shares_issued(stock_val, b_px, buyer_shares_is_raw=shares_is_raw)
        if new_shares is not None and b_sh is not None:
            pro_forma_shares = float(b_sh + new_shares)

    # -- 9. Financing Impacts --------------------------------------------------
    debt_interest = float(debt_val * debt_interest_rate)
    after_tax_debt_interest = float(debt_interest * (1.0 - tax_rate))

    foregone_interest = float(cash_used_val * foregone_cash_interest_rate)
    after_tax_foregone_interest = float(foregone_interest * (1.0 - tax_rate))

    # Synergies after-tax
    at_synergy_y1 = float(s_y1 * (1.0 - tax_rate))
    at_synergy_y2 = float(s_y2 * (1.0 - tax_rate))
    at_synergy_y3 = float(s_y3 * (1.0 - tax_rate))

    # -- 10. Pro-Forma Projection Years ----------------------------------------
    years_data = {}
    break_even_data = {}

    synergy_schedule = [
        (1, "year_1", s_y1, at_synergy_y1),
        (2, "year_2", s_y2, at_synergy_y2),
        (3, "year_3", s_y3, at_synergy_y3),
    ]

    for yr_num, yr_key, gross_syn, at_syn in synergy_schedule:
        if is_available and b_ni is not None and t_ni is not None and pro_forma_shares is not None and buyer_eps is not None:
            pf_ni = float(
                b_ni
                + t_ni
                + at_syn
                - after_tax_debt_interest
                - after_tax_foregone_interest
            )

            if shares_is_raw:
                pf_eps = float((pf_ni * 1e7) / pro_forma_shares)
            else:
                pf_eps = float(pf_ni / pro_forma_shares)

            eps_chg = float(pf_eps - buyer_eps)
            pct_chg = float(((pf_eps / buyer_eps) - 1.0) * 100.0) if buyer_eps != 0.0 else 0.0

            if pct_chg > 1e-4:
                economic_direction = "ACCRETIVE"
            elif pct_chg < -1e-4:
                economic_direction = "DILUTIVE"
            else:
                economic_direction = "NEUTRAL"

            status = economic_direction if is_feasible else "NON-EXECUTABLE / ILLUSTRATIVE"

            years_data[yr_key] = {
                "year": yr_num,
                "buyer_net_income": b_ni,
                "target_net_income": t_ni,
                "gross_synergy": gross_syn,
                "after_tax_synergy": at_syn,
                "new_debt": debt_val,
                "debt_interest": debt_interest,
                "after_tax_debt_interest": after_tax_debt_interest,
                "buyer_cash_used": cash_used_val,
                "foregone_interest": foregone_interest,
                "after_tax_foregone_interest": after_tax_foregone_interest,
                "pro_forma_net_income": pf_ni,
                "buyer_eps": buyer_eps,
                "pro_forma_shares": pro_forma_shares,
                "pro_forma_eps": pf_eps,
                "eps_change": eps_chg,
                "accretion_dilution_pct": pct_chg,
                "status": status,
                "modelled_status": economic_direction,
                "is_feasible": is_feasible,
            }

            # Break-even synergy derivation
            be = calculate_break_even_synergies(
                buyer_standalone_eps=buyer_eps,
                pro_forma_shares=pro_forma_shares,
                buyer_net_income=b_ni,
                target_net_income=t_ni,
                after_tax_debt_interest=after_tax_debt_interest,
                after_tax_foregone_interest=after_tax_foregone_interest,
                tax_rate=tax_rate,
                shares_is_raw=shares_is_raw,
            )
            break_even_data[yr_key] = be
        else:
            years_data[yr_key] = {
                "year": yr_num,
                "buyer_net_income": b_ni,
                "target_net_income": t_ni,
                "gross_synergy": gross_syn,
                "after_tax_synergy": at_syn,
                "new_debt": debt_val,
                "debt_interest": debt_interest,
                "after_tax_debt_interest": after_tax_debt_interest,
                "buyer_cash_used": cash_used_val,
                "foregone_interest": foregone_interest,
                "after_tax_foregone_interest": after_tax_foregone_interest,
                "pro_forma_net_income": None,
                "buyer_eps": buyer_eps,
                "pro_forma_shares": None,
                "pro_forma_eps": None,
                "eps_change": None,
                "accretion_dilution_pct": None,
                "status": "UNAVAILABLE",
            }
            break_even_data[yr_key] = {
                "required_pro_forma_net_income": None,
                "break_even_after_tax_synergy": None,
                "break_even_gross_synergy": None,
                "synergies_required": None,
            }

    return {
        "buyer": {
            "net_income": b_ni,
            "diluted_shares": b_sh,
            "share_price": b_px,
            "cash": b_cash,
        },
        "target": {
            "net_income": t_ni,
            "diluted_shares": t_sh,
            "share_price": t_px,
        },
        "financing": {
            "new_debt": debt_val,
            "debt_interest_rate": debt_interest_rate,
            "debt_interest": debt_interest,
            "after_tax_debt_interest": after_tax_debt_interest,
            "buyer_cash_used": cash_used_val,
            "foregone_cash_interest_rate": foregone_cash_interest_rate,
            "foregone_interest": foregone_interest,
            "after_tax_foregone_interest": after_tax_foregone_interest,
            "stock_consideration_value": stock_val,
            "tax_rate": tax_rate,
            "is_feasible": is_feasible,
        },
        "synergies": {
            "gross_year_1": s_y1,
            "after_tax_year_1": at_synergy_y1,
            "gross_year_2": s_y2,
            "after_tax_year_2": at_synergy_y2,
            "gross_year_3": s_y3,
            "after_tax_year_3": at_synergy_y3,
        },
        "standalone": {
            "buyer_eps": buyer_eps,
            "target_eps": target_eps,
        },
        "pro_forma": {
            "new_shares_issued": new_shares,
            "pro_forma_shares": pro_forma_shares,
            "years": years_data,
        },
        "break_even": break_even_data,
        "diagnostics": diagnostics,
        "is_available": is_available,
        "is_feasible": is_feasible,
    }


def calculate_accretion_dilution_from_universe(
    acquirer_id: str,
    target_id: str,
    metrics_df: pd.DataFrame,
    financials_df: pd.DataFrame | None = None,
    acquisition_premium: float = 0.20,
    cash_pct: float = 0.50,
    debt_pct: float = 0.30,
    stock_pct: float = 0.20,
    transaction_fees: float = 0.0,
    refinance_target_debt: bool = False,
    use_target_cash: bool = False,
    debt_issuance_fee_pct: float = 0.0,
    minimum_cash_balance: float = 0.0,
    other_sources: float = 0.0,
    expected_annual_synergies: float = 0.0,
    synergy_ramp_year_1: float = 0.33,
    synergy_ramp_year_2: float = 0.67,
    synergy_ramp_year_3: float = 1.0,
    synergy_year_1: float | None = None,
    synergy_year_2: float | None = None,
    synergy_year_3: float | None = None,
    debt_interest_rate: float = 0.08,
    foregone_cash_interest_rate: float = 0.05,
    tax_rate: float = 0.25,
) -> dict:
    """
    Convenience wrapper to run full Deal Builder (Phase 6), Sources & Uses (Phase 7),
    and Accretion / Dilution (Phase 8) directly from the DealForge universe.
    """
    deal = build_deal_from_universe(
        acquirer_id=acquirer_id,
        target_id=target_id,
        metrics_df=metrics_df,
        financials_df=financials_df,
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

    su = build_sources_and_uses(
        deal=deal,
        refinance_target_debt=refinance_target_debt,
        use_target_cash=use_target_cash,
        debt_issuance_fee_pct=debt_issuance_fee_pct,
        minimum_cash_balance=minimum_cash_balance,
        other_sources=other_sources,
    )

    acq_profile = deal.get("acquirer", {})
    tgt_profile = deal.get("target", {})

    return calculate_accretion_dilution(
        buyer=acq_profile,
        target=tgt_profile,
        deal=deal,
        sources_uses=su,
        debt_interest_rate=debt_interest_rate,
        foregone_cash_interest_rate=foregone_cash_interest_rate,
        tax_rate=tax_rate,
        synergy_year_1=synergy_year_1,
        synergy_year_2=synergy_year_2,
        synergy_year_3=synergy_year_3,
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="DealForge Phase 8: Accretion / Dilution Analysis")
    parser.add_argument("data_dir", nargs="?", default="data", help="Path to data directory")
    parser.add_argument("acquirer_id", nargs="?", default="TCS", help="Acquirer/Buyer company_id")
    parser.add_argument("target_id", nargs="?", default="Infosys", help="Target company_id")
    parser.add_argument("--premium", type=float, default=0.20, help="Acquisition premium (e.g. 0.20 for 20%%)")
    parser.add_argument("--cash-pct", type=float, default=0.50, help="Cash consideration fraction (default 0.50)")
    parser.add_argument("--debt-pct", type=float, default=0.30, help="Debt consideration fraction (default 0.30)")
    parser.add_argument("--stock-pct", type=float, default=0.20, help="Stock consideration fraction (default 0.20)")
    parser.add_argument("--fees", type=float, default=500.0, help="Transaction fees in Rs Cr (default 500)")
    parser.add_argument("--refinance-target-debt", action="store_true", help="Refinance/pay off target debt at close")
    parser.add_argument("--use-target-cash", action="store_true", help="Sweep target balance sheet cash to fund deal")
    parser.add_argument("--debt-issuance-fee", type=float, default=0.02, help="Debt issuance fee pct (default 0.02 = 2%%)")
    parser.add_argument("--minimum-cash", type=float, default=1000.0, help="Minimum post-deal cash balance (Rs Cr)")
    parser.add_argument("--other-sources", type=float, default=0.0, help="Additional funding sources (Rs Cr)")
    parser.add_argument("--debt-rate", type=float, default=0.08, help="Debt interest rate (default 0.08 = 8%%)")
    parser.add_argument("--cash-yield", type=float, default=0.05, help="Foregone cash interest rate (default 0.05 = 5%%)")
    parser.add_argument("--tax-rate", type=float, default=0.25, help="Tax rate (default 0.25 = 25%%)")
    parser.add_argument("--synergies", type=float, default=2000.0, help="Expected annual pre-tax cost synergies (Rs Cr)")
    parser.add_argument("--synergy-year1", type=float, default=None, help="Year 1 pre-tax synergies override (Rs Cr)")
    parser.add_argument("--synergy-year2", type=float, default=None, help="Year 2 pre-tax synergies override (Rs Cr)")
    parser.add_argument("--synergy-year3", type=float, default=None, help="Year 3 pre-tax synergies override (Rs Cr)")

    args = parser.parse_args()

    from analytics.screening import compute_metrics

    companies = pd.read_csv(f"{args.data_dir}/companies.csv")
    financials = pd.read_csv(f"{args.data_dir}/financials.csv")
    sectors = pd.read_csv(f"{args.data_dir}/sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    res = calculate_accretion_dilution_from_universe(
        acquirer_id=args.acquirer_id,
        target_id=args.target_id,
        metrics_df=metrics,
        financials_df=financials,
        acquisition_premium=args.premium,
        cash_pct=args.cash_pct,
        debt_pct=args.debt_pct,
        stock_pct=args.stock_pct,
        transaction_fees=args.fees,
        refinance_target_debt=args.refinance_target_debt,
        use_target_cash=args.use_target_cash,
        debt_issuance_fee_pct=args.debt_issuance_fee,
        minimum_cash_balance=args.minimum_cash,
        other_sources=args.other_sources,
        expected_annual_synergies=args.synergies,
        synergy_year_1=args.synergy_year1,
        synergy_year_2=args.synergy_year2,
        synergy_year_3=args.synergy_year3,
        debt_interest_rate=args.debt_rate,
        foregone_cash_interest_rate=args.cash_yield,
        tax_rate=args.tax_rate,
    )

    b = res["buyer"]
    t = res["target"]
    f = res["financing"]
    pf = res["pro_forma"]
    be = res["break_even"]

    fin_type = "EXECUTABLE TRANSACTION" if res.get("is_feasible", True) else "REQUESTED / ILLUSTRATIVE STRUCTURE"
    print("\n" + "=" * 74)
    print(f"  ACCRETION / DILUTION ANALYSIS: {args.acquirer_id} acquiring {args.target_id}")
    print(f"  Structure: {fin_type}")
    print("=" * 74)

    def _fmt_curr(val, unit="Rs Cr"):
        return f"{val:>14,.1f} {unit}" if val is not None else f"{'Unavailable':>17}"

    def _fmt_eps(val):
        return f"Rs {val:>10.2f}" if val is not None else f"{'Unavailable':>13}"

    print("\n  BUYER STANDALONE")
    print("  " + "-" * 48)
    print(f"  Net Income:               {_fmt_curr(b['net_income'])}")
    print(f"  Diluted Shares:           {_fmt_curr(b['diluted_shares'], 'shares')}")
    print(f"  Share Price:              {_fmt_curr(b['share_price'], 'Rs')}")
    print(f"  Buyer Standalone EPS:     {_fmt_eps(res['standalone']['buyer_eps'])}")

    print("\n  TARGET STANDALONE")
    print("  " + "-" * 48)
    print(f"  Net Income:               {_fmt_curr(t['net_income'])}")
    print(f"  Diluted Shares:           {_fmt_curr(t['diluted_shares'], 'shares')}")
    print(f"  Target Standalone EPS:    {_fmt_eps(res['standalone']['target_eps'])}")

    print("\n  TRANSACTION FINANCING")
    print("  " + "-" * 48)
    print(f"  New Debt Raised:          {_fmt_curr(f['new_debt'])}")
    print(f"  New Debt Interest Rate:   {f['debt_interest_rate']*100:>13.1f} %")
    print(f"  After-Tax Debt Interest:  {_fmt_curr(f['after_tax_debt_interest'])}")
    print(f"  Buyer Cash Used:          {_fmt_curr(f['buyer_cash_used'])}")
    print(f"  Foregone Cash Rate:       {f['foregone_cash_interest_rate']*100:>13.1f} %")
    print(f"  After-Tax Foregone Int:   {_fmt_curr(f['after_tax_foregone_interest'])}")
    print(f"  Stock Consideration:      {_fmt_curr(f['stock_consideration_value'])}")
    print(f"  New Shares Issued:        {_fmt_curr(pf['new_shares_issued'], 'shares')}")
    print(f"  Pro-Forma Share Count:    {_fmt_curr(pf['pro_forma_shares'], 'shares')}")

    for yr in ["year_1", "year_2", "year_3"]:
        yd = pf["years"][yr]
        bed = be[yr]
        yr_name = yr.replace("_", " ").upper()
        print(f"\n  {yr_name}")
        print("  " + "-" * 48)
        print(f"  Gross Pre-Tax Synergies:  {_fmt_curr(yd['gross_synergy'])}")
        print(f"  After-Tax Synergies:      {_fmt_curr(yd['after_tax_synergy'])}")
        print(f"  Pro-Forma Net Income:     {_fmt_curr(yd['pro_forma_net_income'])}")
        print(f"  Buyer Standalone EPS:     {_fmt_eps(yd['buyer_eps'])}")
        print(f"  Pro-Forma EPS:            {_fmt_eps(yd['pro_forma_eps'])}")
        if yd['eps_change'] is not None:
            eps_sgn = "+" if yd['eps_change'] >= 0 else ""
            pct_sgn = "+" if yd['accretion_dilution_pct'] >= 0 else ""
            print(f"  EPS Change:               Rs {eps_sgn}{yd['eps_change']:>9.2f}")
            print(f"  Accretion / Dilution:     {pct_sgn}{yd['accretion_dilution_pct']:>13.2f} %  [{yd['status']}]")
        else:
            print("  Accretion / Dilution:           Unavailable")

        if bed.get("break_even_gross_synergy") is not None:
            print(f"  Break-Even Gross Synergy: {_fmt_curr(bed['break_even_gross_synergy'])}")

    if res["diagnostics"]:
        print("\n  DIAGNOSTICS")
        print("  " + "-" * 48)
        for d in res["diagnostics"]:
            print(f"  ! {d}")

    print("=" * 74 + "\n")
