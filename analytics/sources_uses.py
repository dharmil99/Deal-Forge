"""
sources_uses.py

Phase 7: Sources & Uses.

Constructs the acquisition Sources & Uses schedule for a transaction modeled in Phase 6,
and validates the fundamental financial accounting identity:

    TOTAL SOURCES == TOTAL USES

ACCOUNTING & FINANCIAL PRINCIPLES:
1. Uses of Funds:
   - Purchase of Target Equity: Total equity consideration paid to target shareholders
     (from Phase 6: purchase_equity_value).
   - Target Debt Refinancing: When existing target debt must be paid off / retired at close
     (refinance_target_debt=True). If target debt is rolled over / assumed, it is NOT a cash use.
     NOTE: If refinance_target_debt=True and target debt is unknown/missing, a ValueError
     is raised. Unknown debt is NEVER silently assumed to be zero.
   - Transaction & Advisory Fees: M&A advisory, legal, accounting, and due diligence expenses.
   - Debt Issuance Fees: Underwriting/issuance fees incurred on newly raised debt facilities
     (new_debt * debt_issuance_fee_pct).
   - Other Uses: Any other transaction-related disbursements.

   Total Uses = Purchase Equity Value + Target Debt Refinancing + Transaction Fees + Debt Issuance Fees + Other Uses

2. Funding Base & Target Cash Sweep:
   - Target Cash Sweep reduces the external funding requirement:
     Gross Uses Ex-Debt-Fees = Purchase Equity Value + Target Debt Refinancing + Transaction Fees + Other Uses
     Target Cash Sweep = min(Available Target Cash, Gross Uses Ex-Debt-Fees - Other Sources) [if use_target_cash=True]
     Net Funding Requirement = (Gross Uses Ex-Debt-Fees - Target Cash Sweep - Other Sources) / (1 - debt_fee_pct * debt_pct)
   - Target cash sweep directly enters Sources as a funding item and reduces external capital needed.
     It NEVER creates an artificial surplus (Total Sources > Total Uses).

3. Requested Sources vs Balanced Executable Sources:
   - The user's financing mix (cash_pct, debt_pct, stock_pct) funds the Net Funding Requirement:
     Requested New Debt = Net Funding Requirement * debt_pct
     Debt Issuance Fees = Requested New Debt * debt_fee_pct
     Requested Cash = Net Funding Requirement * cash_pct
     Requested Stock = Net Funding Requirement * stock_pct
   - Total Requested Sources == Total Uses (exact mathematical balance, difference < 1e-4).
   - No unexplained plug is ever introduced.
   - The user's financing percentages are preserved exactly.

4. Acquirer Cash Reality & Feasibility:
   - Acquirer existing cash contributed CANNOT exceed the acquirer's actual balance sheet cash.
   - If Requested Cash > Available Acquirer Cash:
     Actual Acquirer Cash Contributed is capped at available balance.
     The transaction is marked INFEASIBLE: CASH SHORTFALL.
     The exact funding shortfall (Requested Cash - Available Cash) is explicitly reported.
     Total Executable Sources < Total Uses by the exact funding shortfall.
   - Pro-forma acquirer cash is calculated as max(0.0, available - contributed), NEVER producing
     a fictional negative cash balance while treating the transaction as funded.
   - If Requested Cash <= Available Acquirer Cash:
     The transaction is BALANCED & EXECUTABLE.
     Total Sources == Total Uses.
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


def calculate_financing_fees(new_debt: float, fee_pct: float) -> float:
    """
    Calculates debt issuance fees on newly issued debt.

    Parameters
    ----------
    new_debt : float
        Principal amount of newly issued debt (Rs Cr).
    fee_pct : float
        Debt issuance fee percentage as a decimal fraction (e.g. 0.02 for 2.0%).

    Returns
    -------
    float
        Debt issuance fees (Rs Cr).
    """
    if fee_pct < 0.0:
        raise ValueError(f"debt_issuance_fee_pct cannot be negative, got {fee_pct}.")
    if new_debt < 0.0:
        raise ValueError(f"new_debt cannot be negative, got {new_debt}.")
    return float(new_debt * fee_pct)


def reconcile_pro_forma_cash(
    acquirer_cash: float | None,
    target_cash: float | None,
    cash_sources: float,
    min_buffer: float = 0.0,
    target_cash_used: float = 0.0,
    cash_required: float | None = None,
) -> dict:
    """
    Reconciles acquirer and target cash pre- and post-transaction.

    Parameters
    ----------
    acquirer_cash : float | None
        Acquirer standalone cash balance prior to deal (Rs Cr).
    target_cash : float | None
        Target standalone cash balance prior to deal (Rs Cr).
    cash_sources : float
        Actual acquirer balance sheet cash contributed to fund the deal (Rs Cr).
        Capped at acquirer_cash when acquirer_cash is known.
    min_buffer : float
        Minimum operating cash buffer required post-deal (Rs Cr). Default 0.0.
    target_cash_used : float
        Target cash swept to fund the deal (Rs Cr). Default 0.0.
    cash_required : float | None
        Total cash required from the acquirer by the financing mix (Rs Cr).
        If None, defaults to cash_sources.

    Returns
    -------
    dict
        Cash reconciliation metrics and diagnostics.
    """
    if min_buffer < 0.0:
        raise ValueError(f"minimum_cash_balance cannot be negative, got {min_buffer}.")
    if cash_sources < 0.0:
        raise ValueError(f"cash_sources cannot be negative, got {cash_sources}.")
    if target_cash_used < 0.0:
        raise ValueError(f"target_cash_used cannot be negative, got {target_cash_used}.")

    req_cash = float(cash_required if cash_required is not None else cash_sources)
    if req_cash < 0.0:
        raise ValueError(f"cash_required cannot be negative, got {req_cash}.")

    warnings: list[str] = []

    pro_forma_acquirer_cash = None
    cash_deficit = 0.0
    buffer_shortfall = 0.0
    is_cash_funded = True

    if acquirer_cash is not None:
        acq_cash_num = float(acquirer_cash)
        if req_cash > acq_cash_num:
            cash_deficit = req_cash - acq_cash_num
            is_cash_funded = False
            # Acquirer contributes up to available cash; pro-forma cash is 0.0, never negative!
            actual_cash_used = min(cash_sources, acq_cash_num)
            pro_forma_acquirer_cash = max(0.0, acq_cash_num - actual_cash_used)
            warnings.append(
                f"acquirer_cash: cash required for transaction (Rs {req_cash:,.1f} Cr) exceeds "
                f"pre-deal acquirer cash balance (Rs {acq_cash_num:,.1f} Cr) by Rs {cash_deficit:,.1f} Cr -- "
                f"deal cannot be fully funded from existing cash without external cash raising or operational cash inflow."
            )
        else:
            cash_deficit = 0.0
            is_cash_funded = True
            actual_cash_used = req_cash
            pro_forma_acquirer_cash = acq_cash_num - actual_cash_used

        if pro_forma_acquirer_cash < min_buffer:
            buffer_shortfall = min_buffer - pro_forma_acquirer_cash
            warnings.append(
                f"liquidity: pro-forma acquirer cash (Rs {pro_forma_acquirer_cash:,.1f} Cr) falls below "
                f"minimum required cash buffer (Rs {min_buffer:,.1f} Cr) by Rs {buffer_shortfall:,.1f} Cr."
            )
    else:
        is_cash_funded = False
        actual_cash_used = cash_sources
        warnings.append(
            "acquirer_cash: pre-deal acquirer cash is unknown/None; pro-forma cash cannot be calculated "
            "without assuming zero cash."
        )

    pro_forma_target_cash_remaining = None
    if target_cash is not None:
        target_cash_num = float(target_cash)
        if target_cash_used > target_cash_num:
            warnings.append(
                f"target_cash: target cash swept (Rs {target_cash_used:,.1f} Cr) exceeds "
                f"available target cash (Rs {target_cash_num:,.1f} Cr)."
            )
        pro_forma_target_cash_remaining = max(target_cash_num - target_cash_used, 0.0)
    else:
        if target_cash_used > 0.0:
            warnings.append(
                "target_cash: target cash balance is unknown/None; target cash sweep was attempted without knowing available cash."
            )

    pro_forma_combined_cash = None
    if pro_forma_acquirer_cash is not None and pro_forma_target_cash_remaining is not None:
        pro_forma_combined_cash = pro_forma_acquirer_cash + pro_forma_target_cash_remaining

    return {
        "pre_deal_acquirer_cash": acquirer_cash,
        "cash_required": req_cash,
        "cash_used_in_transaction": actual_cash_used,
        "cash_deficit": cash_deficit,
        "is_cash_funded": is_cash_funded,
        "target_cash_available": target_cash,
        "target_cash_used": target_cash_used,
        "minimum_cash_balance": min_buffer,
        "pro_forma_acquirer_cash": pro_forma_acquirer_cash,
        "pro_forma_target_cash_remaining": pro_forma_target_cash_remaining,
        "pro_forma_combined_cash": pro_forma_combined_cash,
        "buffer_shortfall": buffer_shortfall,
        "warnings": warnings,
    }


def build_sources_and_uses(
    deal: dict,
    refinance_target_debt: bool = False,
    use_target_cash: bool = False,
    debt_issuance_fee_pct: float = 0.0,
    minimum_cash_balance: float = 0.0,
    other_uses: float = 0.0,
    other_sources: float = 0.0,
    acquirer_cash: float | None = None,
    new_debt: float | None = None,
    stock_issuance: float | None = None,
    target_cash_sweep: float | None = None,
) -> dict:
    """
    Constructs an institutional Sources & Uses schedule for a deal.

    Parameters
    ----------
    deal : dict
        Output dictionary from analytics.deal_model.build_deal().
    refinance_target_debt : bool
        If True, target existing debt is repaid/refinanced at closing (a Use of funds).
        If False, target existing debt is rolled over / assumed (NOT a Use of funds).
    use_target_cash : bool
        If True, available target balance sheet cash is swept to fund transaction uses.
    debt_issuance_fee_pct : float
        Debt issuance / underwriting fee as a percentage of new debt (e.g. 0.02 for 2%).
    minimum_cash_balance : float
        Minimum cash buffer required post-deal (Rs Cr). Default 0.0.
    other_uses : float
        Any additional transaction expenses / uses (Rs Cr). Default 0.0.
    other_sources : float
        Any additional financing sources (e.g. sponsor equity, co-investor) (Rs Cr). Default 0.0.
    acquirer_cash : float | None
        Override for acquirer cash source. If None, derived from requested financing mix on Net Funding Requirement.
    new_debt : float | None
        Override for new debt financing source. If None, derived from requested financing mix on Net Funding Requirement.
    stock_issuance : float | None
        Override for stock consideration source. If None, derived from requested financing mix on Net Funding Requirement.
    target_cash_sweep : float | None
        Explicit target cash sweep amount. If None and use_target_cash is True, defaults to available target cash.

    Returns
    -------
    dict
        Structured Sources & Uses dictionary:
          - uses: breakdown of all transaction uses & total_uses
          - funding_base: gross uses, sweep, and net funding requirement
          - requested_financing: requested funding structure
          - sources: executable financing sources & total_sources
          - reconciliation: balance and feasibility status
          - cash_reconciliation: pre- vs post-deal cash and liquidity metrics
          - warnings: diagnostic warnings
    """
    warnings: list[str] = list(deal.get("warnings", []))

    txn = deal.get("transaction", {})
    fin = deal.get("financing", {})
    acq = deal.get("acquirer", {})
    tgt = deal.get("target", {})

    purchase_equity = txn.get("purchase_equity_value")
    if purchase_equity is None:
        raise ValueError("Invalid deal object: deal['transaction']['purchase_equity_value'] is missing or None.")

    purchase_equity_value = float(purchase_equity)

    # -- 1. Calculate Uses -----------------------------------------------------
    target_debt_refinancing = 0.0
    if refinance_target_debt:
        t_debt = tgt.get("total_debt")
        if t_debt is None:
            t_debt = tgt.get("net_debt")

        if t_debt is None:
            raise ValueError(
                "Cannot refinance target debt: target debt is missing or unknown. "
                "Unknown debt must not be assumed to be zero."
            )

        t_debt_val = float(t_debt)
        if t_debt_val < 0.0:
            warnings.append(
                f"target_debt: target debt value is negative (Rs {t_debt_val:,.1f} Cr) "
                f"representing a net cash position; refinancing is treated as 0.0."
            )
            target_debt_refinancing = 0.0
        else:
            target_debt_refinancing = t_debt_val

    transaction_fees = float(txn.get("transaction_fees") or 0.0)
    if transaction_fees < 0.0:
        raise ValueError(f"transaction_fees cannot be negative, got {transaction_fees}.")

    other_uses_val = float(other_uses or 0.0)
    if other_uses_val < 0.0:
        raise ValueError(f"other_uses cannot be negative, got {other_uses_val}.")

    other_sources_val = float(other_sources or 0.0)
    if other_sources_val < 0.0:
        raise ValueError(f"other_sources cannot be negative, got {other_sources_val}.")

    gross_uses_ex_debt_fees = (
        purchase_equity_value
        + target_debt_refinancing
        + transaction_fees
        + other_uses_val
    )

    # -- 2. Target Cash Sweep --------------------------------------------------
    target_cash_sweep_val = 0.0
    if target_cash_sweep is not None:
        target_cash_sweep_val = float(target_cash_sweep)
    elif use_target_cash:
        tgt_cash = tgt.get("cash")
        if tgt_cash is None:
            warnings.append(
                "target_cash: use_target_cash=True requested, but target cash is unknown/None. "
                "Target cash sweep treated as 0.0 to avoid assuming missing cash is zero."
            )
            target_cash_sweep_val = 0.0
        else:
            tgt_cash_avail = max(float(tgt_cash), 0.0)
            useful_sweep = max(0.0, gross_uses_ex_debt_fees - other_sources_val)
            target_cash_sweep_val = min(tgt_cash_avail, useful_sweep)
    else:
        target_cash_sweep_val = 0.0

    if target_cash_sweep_val < 0.0:
        raise ValueError(f"target_cash_sweep cannot be negative, got {target_cash_sweep_val}.")

    # -- 3. Determine Financing & Debt Issuance Fees ---------------------------
    has_explicit_sources = (
        new_debt is not None or acquirer_cash is not None or stock_issuance is not None
    )

    if has_explicit_sources:
        new_debt_val = float(new_debt if new_debt is not None else (fin.get("new_debt_amount") or 0.0))
        debt_issuance_fees = calculate_financing_fees(new_debt_val, debt_issuance_fee_pct)
        total_uses = gross_uses_ex_debt_fees + debt_issuance_fees
        net_funding_req = max(0.0, total_uses - target_cash_sweep_val - other_sources_val)
        stock_val = float(stock_issuance if stock_issuance is not None else (fin.get("stock_consideration_value") or 0.0))
        cash_required_val = float(acquirer_cash if acquirer_cash is not None else (fin.get("cash_amount") or 0.0))
    else:
        # Standard case: Use requested financing mix percentages from Phase 6
        cash_pct = float(fin.get("cash_pct", 1.0))
        debt_pct = float(fin.get("debt_pct", 0.0))
        stock_pct = float(fin.get("stock_pct", 0.0))

        base_to_fund = max(0.0, gross_uses_ex_debt_fees - target_cash_sweep_val - other_sources_val)
        fee_divisor = 1.0 - (debt_issuance_fee_pct * debt_pct)
        if fee_divisor <= 0.0:
            raise ValueError(
                f"Invalid fee structure: debt issuance fee pct ({debt_issuance_fee_pct}) * debt pct ({debt_pct}) >= 1.0"
            )

        net_funding_req = base_to_fund / fee_divisor
        new_debt_val = net_funding_req * debt_pct
        debt_issuance_fees = calculate_financing_fees(new_debt_val, debt_issuance_fee_pct)
        total_uses = gross_uses_ex_debt_fees + debt_issuance_fees

        cash_required_val = net_funding_req * cash_pct
        stock_val = net_funding_req * stock_pct

    uses_section = {
        "purchase_equity_value": purchase_equity_value,
        "target_debt_refinancing": target_debt_refinancing,
        "transaction_fees": transaction_fees,
        "debt_issuance_fees": debt_issuance_fees,
        "other_uses": other_uses_val,
        "total_uses": total_uses,
    }

    # -- 4. Acquirer Cash Feasibility & Reality Check --------------------------
    acq_cash_avail = acq.get("cash")
    cash_shortfall = 0.0
    actual_acquirer_cash_used = cash_required_val

    if acquirer_cash is not None:
        actual_acquirer_cash_used = float(acquirer_cash)
        if acq_cash_avail is not None and actual_acquirer_cash_used > float(acq_cash_avail):
            cash_shortfall = actual_acquirer_cash_used - float(acq_cash_avail)
    else:
        if acq_cash_avail is not None:
            acq_cash_num = float(acq_cash_avail)
            if cash_required_val > acq_cash_num:
                cash_shortfall = cash_required_val - acq_cash_num
                # Capped at available cash
                actual_acquirer_cash_used = acq_cash_num
            else:
                cash_shortfall = 0.0
                actual_acquirer_cash_used = cash_required_val
        else:
            cash_shortfall = 0.0
            actual_acquirer_cash_used = cash_required_val

    requested_sources = {
        "acquirer_cash": cash_required_val,
        "new_debt": new_debt_val,
        "stock_issuance": stock_val,
        "target_cash_sweep": target_cash_sweep_val,
        "other_sources": other_sources_val,
        "total_requested_sources": (
            cash_required_val
            + new_debt_val
            + stock_val
            + target_cash_sweep_val
            + other_sources_val
        ),
    }

    executable_sources = {
        "acquirer_cash": actual_acquirer_cash_used,
        "new_debt": new_debt_val,
        "stock_issuance": stock_val,
        "target_cash_sweep": target_cash_sweep_val,
        "other_sources": other_sources_val,
        "total_sources": (
            actual_acquirer_cash_used
            + new_debt_val
            + stock_val
            + target_cash_sweep_val
            + other_sources_val
        ),
    }

    # -- 5. Reconciliation & Balance Check -------------------------------------
    total_executable_sources = executable_sources["total_sources"]
    difference = total_executable_sources - total_uses
    tolerance = 1e-4
    is_feasible = (cash_shortfall < tolerance)
    is_balanced = is_feasible and (abs(difference) < tolerance)

    if not is_feasible:
        warnings.append(
            f"feasibility: financing structure is INFEASIBLE. Acquirer cash required (Rs {cash_required_val:,.1f} Cr) "
            f"exceeds available acquirer cash (Rs {float(acq_cash_avail):,.1f} Cr) by Rs {cash_shortfall:,.1f} Cr. "
            f"The transaction cannot be executed without external cash raising or capital restructuring."
        )
    elif not is_balanced:
        if difference < 0:
            warnings.append(
                f"reconciliation: Sources and Uses are not balanced (shortfall of Rs {abs(difference):,.1f} Cr). "
                f"Total Sources (Rs {total_executable_sources:,.1f} Cr) < Total Uses (Rs {total_uses:,.1f} Cr)."
            )
        else:
            warnings.append(
                f"reconciliation: Sources and Uses are not balanced (surplus of Rs {difference:,.1f} Cr). "
                f"Total Sources (Rs {total_executable_sources:,.1f} Cr) > Total Uses (Rs {total_uses:,.1f} Cr)."
            )

    reconciliation_section = {
        "total_sources": total_executable_sources,
        "total_uses": total_uses,
        "difference": difference,
        "sources_uses_balanced": is_balanced,
        "is_feasible": is_feasible,
        "funding_shortfall": cash_shortfall,
        "tolerance": tolerance,
        "status": (
            "BALANCED & EXECUTABLE"
            if is_balanced
            else ("INFEASIBLE: CASH SHORTFALL" if not is_feasible else "UNBALANCED")
        ),
    }

    # -- 6. Cash Reconciliation ------------------------------------------------
    cash_recon = reconcile_pro_forma_cash(
        acquirer_cash=acq_cash_avail,
        target_cash=tgt.get("cash"),
        cash_sources=actual_acquirer_cash_used,
        min_buffer=minimum_cash_balance,
        target_cash_used=target_cash_sweep_val,
        cash_required=cash_required_val,
    )

    for w in cash_recon.get("warnings", []):
        if w not in warnings:
            warnings.append(w)

    return {
        "uses": uses_section,
        "funding_base": {
            "gross_uses_ex_debt_fees": gross_uses_ex_debt_fees,
            "target_cash_sweep": target_cash_sweep_val,
            "other_sources": other_sources_val,
            "net_funding_requirement": net_funding_req,
        },
        "requested_financing": requested_sources,
        "sources": executable_sources,
        "reconciliation": reconciliation_section,
        "cash_reconciliation": cash_recon,
        "warnings": warnings,
    }


def build_sources_and_uses_from_universe(
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
    refinance_target_debt: bool = False,
    use_target_cash: bool = False,
    debt_issuance_fee_pct: float = 0.0,
    minimum_cash_balance: float = 0.0,
    other_uses: float = 0.0,
    other_sources: float = 0.0,
    acquirer_cash: float | None = None,
    new_debt: float | None = None,
    stock_issuance: float | None = None,
    target_cash_sweep: float | None = None,
) -> dict:
    """
    Convenience wrapper to build a complete Sources & Uses schedule directly
    from the DealForge universe.
    """
    deal = build_deal_from_universe(
        acquirer_id=acquirer_id,
        target_id=target_id,
        metrics_df=metrics_df,
        financials_df=financials_df,
        purchase_equity_value=purchase_equity_value,
        acquisition_premium=acquisition_premium,
        cash_pct=cash_pct,
        debt_pct=debt_pct,
        stock_pct=stock_pct,
        transaction_fees=transaction_fees,
    )

    return build_sources_and_uses(
        deal=deal,
        refinance_target_debt=refinance_target_debt,
        use_target_cash=use_target_cash,
        debt_issuance_fee_pct=debt_issuance_fee_pct,
        minimum_cash_balance=minimum_cash_balance,
        other_uses=other_uses,
        other_sources=other_sources,
        acquirer_cash=acquirer_cash,
        new_debt=new_debt,
        stock_issuance=stock_issuance,
        target_cash_sweep=target_cash_sweep,
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="DealForge Phase 7: Sources & Uses")
    parser.add_argument("data_dir", nargs="?", default="data", help="Path to data directory")
    parser.add_argument("acquirer_id", nargs="?", default="TCS", help="Acquirer company_id")
    parser.add_argument("target_id", nargs="?", default="Infosys", help="Target company_id")
    parser.add_argument("--premium", type=float, default=0.20, help="Acquisition premium (e.g. 0.20 for 20%%)")
    parser.add_argument("--cash-pct", type=float, default=0.50, help="Cash consideration fraction")
    parser.add_argument("--debt-pct", type=float, default=0.30, help="Debt consideration fraction")
    parser.add_argument("--stock-pct", type=float, default=0.20, help="Stock consideration fraction")
    parser.add_argument("--fees", type=float, default=500.0, help="Transaction fees (Rs Cr)")
    parser.add_argument("--refinance-target-debt", action="store_true", help="Refinance/pay off target debt at close")
    parser.add_argument("--use-target-cash", action="store_true", help="Sweep target balance sheet cash to fund deal")
    parser.add_argument("--debt-issuance-fee", type=float, default=0.02, help="Debt issuance fee pct (default 0.02 = 2%%)")
    parser.add_argument("--minimum-cash", type=float, default=1000.0, help="Minimum post-deal cash balance (Rs Cr)")
    parser.add_argument("--other-sources", type=float, default=0.0, help="Additional funding sources (Rs Cr)")

    args = parser.parse_args()

    from analytics.screening import compute_metrics

    companies = pd.read_csv(f"{args.data_dir}/companies.csv")
    financials = pd.read_csv(f"{args.data_dir}/financials.csv")
    sectors = pd.read_csv(f"{args.data_dir}/sector_mapping.csv")
    metrics = compute_metrics(financials, companies, sectors)

    su = build_sources_and_uses_from_universe(
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
    )

    u = su["uses"]
    req = su["requested_financing"]
    s = su["sources"]
    rec = su["reconciliation"]
    crec = su["cash_reconciliation"]

    tot_u = u["total_uses"] if u["total_uses"] > 0 else 1.0
    tot_s = s["total_sources"] if s["total_sources"] > 0 else 1.0

    print("\n" + "=" * 74)
    print(f"  SOURCES & USES: {args.acquirer_id} acquiring {args.target_id}")
    print("=" * 74)

    print("\n  USES                                              Amount (Rs Cr)     % Total")
    print("  " + "-" * 48 + "  " + "-" * 14 + "  " + "-" * 10)
    print(f"  Purchase of Target Equity                         {u['purchase_equity_value']:>14,.1f}  {u['purchase_equity_value']/tot_u*100:>9.1f}%")
    print(f"  Target Debt Refinancing                           {u['target_debt_refinancing']:>14,.1f}  {u['target_debt_refinancing']/tot_u*100:>9.1f}%")
    print(f"  Transaction & Advisory Fees                       {u['transaction_fees']:>14,.1f}  {u['transaction_fees']/tot_u*100:>9.1f}%")
    print(f"  Debt Issuance Fees ({args.debt_issuance_fee*100:.1f}%)                         {u['debt_issuance_fees']:>14,.1f}  {u['debt_issuance_fees']/tot_u*100:>9.1f}%")
    print(f"  Other Uses                                        {u['other_uses']:>14,.1f}  {u['other_uses']/tot_u*100:>9.1f}%")
    print("  " + "-" * 48 + "  " + "-" * 14 + "  " + "-" * 10)
    print(f"  TOTAL USES                                        {u['total_uses']:>14,.1f}  {100.0:>9.1f}%")

    print("\n  SOURCES (EXECUTABLE)                              Amount (Rs Cr)     % Total")
    print("  " + "-" * 48 + "  " + "-" * 14 + "  " + "-" * 10)
    print(f"  Acquirer Existing Cash (Capped)                   {s['acquirer_cash']:>14,.1f}  {s['acquirer_cash']/tot_s*100:>9.1f}%")
    print(f"  New Debt Financing                                {s['new_debt']:>14,.1f}  {s['new_debt']/tot_s*100:>9.1f}%")
    print(f"  Stock Consideration                               {s['stock_issuance']:>14,.1f}  {s['stock_issuance']/tot_s*100:>9.1f}%")
    print(f"  Target Cash Sweep                                 {s['target_cash_sweep']:>14,.1f}  {s['target_cash_sweep']/tot_s*100:>9.1f}%")
    print(f"  Other Sources                                     {s['other_sources']:>14,.1f}  {s['other_sources']/tot_s*100:>9.1f}%")
    print("  " + "-" * 48 + "  " + "-" * 14 + "  " + "-" * 10)
    print(f"  TOTAL SOURCES                                     {s['total_sources']:>14,.1f}  {100.0:>9.1f}%")

    if not rec["is_feasible"]:
        print("\n  REQUESTED FINANCING MIX (CALCULATED STRUCTURE)")
        print("  " + "-" * 48)
        print(f"  Requested Acquirer Cash:   Rs {req['acquirer_cash']:>14,.1f} Cr")
        print(f"  Requested New Debt:        Rs {req['new_debt']:>14,.1f} Cr")
        print(f"  Requested Stock:           Rs {req['stock_issuance']:>14,.1f} Cr")
        print(f"  Target Cash Sweep:         Rs {req['target_cash_sweep']:>14,.1f} Cr")
        print(f"  Total Requested Sources:   Rs {req['total_requested_sources']:>14,.1f} Cr")

    print("\n  RECONCILIATION")
    print("  " + "-" * 48)
    print(f"  Total Executable Sources: Rs {rec['total_sources']:>14,.1f} Cr")
    print(f"  Total Uses:               Rs {rec['total_uses']:>14,.1f} Cr")
    print(f"  Difference (S - U):       Rs {rec['difference']:>14,.1f} Cr")
    print(f"  Status:                   {rec['status']}")
    print(f"  Balanced:                 {'YES' if rec['sources_uses_balanced'] else 'NO'}")
    print(f"  Feasible:                 {'YES' if rec['is_feasible'] else 'NO'}")
    if rec["funding_shortfall"] > 0:
        print(f"  Funding Shortfall / Gap:  Rs {rec['funding_shortfall']:>14,.1f} Cr")

    print("\n  CASH RECONCILIATION")
    print("  " + "-" * 48)
    def _c_fmt(v):
        return f"Rs {v:>14,.1f} Cr" if v is not None else f"{'Unknown / None':>17}"

    print(f"  Pre-Deal Acquirer Cash:    {_c_fmt(crec['pre_deal_acquirer_cash'])}")
    print(f"  Cash Required by Deal:     {_c_fmt(crec['cash_required'])}")
    print(f"  Acquirer Cash Contributed: {_c_fmt(crec['cash_used_in_transaction'])}")
    if crec["cash_deficit"] > 0:
        print(f"  Cash Deficit / Gap:        {_c_fmt(crec['cash_deficit'])}")
    print(f"  Pro-Forma Acquirer Cash:   {_c_fmt(crec['pro_forma_acquirer_cash'])}")
    print(f"  Minimum Required Cash:     {_c_fmt(crec['minimum_cash_balance'])}")
    print(f"  Target Cash Available:     {_c_fmt(crec['target_cash_available'])}")
    print(f"  Target Cash Swept:         {_c_fmt(crec['target_cash_used'])}")

    if su["warnings"]:
        print("\n  WARNINGS & DIAGNOSTICS")
        print("  " + "-" * 48)
        for w in su["warnings"]:
            print(f"  ! {w}")

    print("=" * 74 + "\n")
