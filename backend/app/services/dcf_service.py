"""
backend/app/services/dcf_service.py

Service layer for Discounted Cash Flow valuation calling analytics/dcf.py.
Preserves existing Gordon Growth, CAPM WACC, and explicit projection logic.
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from analytics.dcf import dcf_valuation
from backend.app.core.errors import EntityNotFoundError, InvalidInputError
from backend.app.schemas.dcf import (
    DCFAssumptions,
    DCFForecastYear,
    DCFResponse,
    WACCDetail,
)
from backend.app.services.company_service import CompanyService
from backend.app.services.dataset_service import DatasetService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.dcf")


class DCFService:
    """Service orchestrating DCF projections and enterprise/equity value calculation."""

    def __init__(self, dataset_service: DatasetService, company_service: CompanyService) -> None:
        self.dataset_service = dataset_service
        self.company_service = company_service

    def get_dcf(
        self,
        company_identifier: str,
        wacc: Optional[float] = None,
        terminal_growth: float = 0.05,
        forecast_years: int = 5,
        revenue_growth: Optional[float] = None,
        ebitda_margin: Optional[float] = None,
        da_pct_revenue: Optional[float] = None,
        capex_pct_revenue: Optional[float] = None,
        tax_rate: Optional[float] = None,
        risk_free_rate: float = 0.07,
        equity_risk_premium: float = 0.06,
        beta: float = 1.0,
    ) -> DCFResponse:
        """
        Execute DCF valuation for the target company with baseline inputs and optional user overrides.
        """
        canonical_id = self.company_service.resolve_company_id(company_identifier)
        metrics = self.dataset_service.get_metrics()
        target_rows = metrics[metrics["company_id"] == canonical_id]
        if target_rows.empty:
            raise EntityNotFoundError(f"Company '{company_identifier}' not found")
        target_row = target_rows.iloc[0]

        financials = self.dataset_service.get_financials()
        fin_target = financials[financials["company_id"] == canonical_id].dropna(subset=["fiscal_year"]).sort_values("fiscal_year")
        if fin_target.empty:
            raise InvalidInputError(f"No historical financial statements found for '{canonical_id}' to seed DCF.")

        latest_fin = fin_target.iloc[-1]

        # Baseline operating inputs from latest financials & metrics
        latest_rev = float(target_row["revenue_latest"]) if pd.notna(target_row.get("revenue_latest")) else float(latest_fin["revenue"])
        net_debt = float(target_row["net_debt_latest"]) if pd.notna(target_row.get("net_debt_latest")) else 0.0
        shares = float(target_row["shares_outstanding_latest"]) if pd.notna(target_row.get("shares_outstanding_latest")) else None
        market_cap = float(target_row["market_cap_latest"]) if pd.notna(target_row.get("market_cap_latest")) else 0.0
        total_debt = float(latest_fin["total_debt"]) if pd.notna(latest_fin.get("total_debt")) else 0.0
        interest_exp = float(latest_fin["interest"]) if pd.notna(latest_fin.get("interest")) else 0.0

        # Baseline tax rate
        if tax_rate is None:
            pbt = latest_fin.get("pbt")
            tax = latest_fin.get("tax")
            if pd.notna(pbt) and float(pbt) > 0 and pd.notna(tax):
                derived_tax = float(tax) / float(pbt)
                tax_rate = min(max(derived_tax, 0.0), 0.40)
            else:
                tax_rate = 0.25

        # Baseline D&A%
        if da_pct_revenue is None:
            if pd.notna(latest_fin.get("depreciation")) and latest_rev > 0:
                da_pct_revenue = float(latest_fin["depreciation"]) / latest_rev
            else:
                da_pct_revenue = 0.03

        # Baseline CapEx%
        if capex_pct_revenue is None:
            if pd.notna(latest_fin.get("cfi")) and latest_rev > 0:
                capex_pct_revenue = max(-float(latest_fin["cfi"]), 0.0) / latest_rev
            else:
                capex_pct_revenue = 0.05

        # Baseline EBITDA margin
        if ebitda_margin is None:
            if pd.notna(target_row.get("ebitda_margin")):
                ebitda_margin = float(target_row["ebitda_margin"])
            elif pd.notna(latest_fin.get("ebitda_margin_derived")):
                ebitda_margin = float(latest_fin["ebitda_margin_derived"])
            else:
                ebitda_margin = 0.15

        # Baseline revenue growth
        if revenue_growth is None:
            if pd.notna(target_row.get("revenue_cagr")):
                revenue_growth = float(target_row["revenue_cagr"])
            else:
                revenue_growth = 0.08

        # Execute DCF calculation via analytics.dcf
        try:
            dcf_result = dcf_valuation(
                latest_revenue_cr=latest_rev,
                net_debt_cr=net_debt,
                shares_outstanding=shares,
                market_cap_cr=market_cap,
                total_debt_cr=total_debt,
                interest_expense_cr=interest_exp,
                ebitda_margin=ebitda_margin,
                da_pct_revenue=da_pct_revenue,
                capex_pct_revenue=capex_pct_revenue,
                tax_rate=tax_rate,
                revenue_growth=revenue_growth,
                terminal_growth=terminal_growth,
                forecast_years=forecast_years,
                wacc=wacc,
                risk_free_rate=risk_free_rate,
                equity_risk_premium=equity_risk_premium,
                beta=beta,
            )
        except ValueError as exc:
            raise InvalidInputError(str(exc))
        except Exception as exc:
            logger.error("DCF valuation failed for %s: %s", canonical_id, exc)
            raise

        cleaned = clean_nan(dcf_result)

        # Convert forecast DataFrame to typed models
        forecast_df: pd.DataFrame = dcf_result["forecast"]
        forecast_list: List[DCFForecastYear] = []
        for _, r in forecast_df.iterrows():
            d = clean_nan(r.to_dict())
            forecast_list.append(
                DCFForecastYear(
                    forecast_year=int(d["forecast_year"]),
                    revenue=float(d["revenue"]),
                    ebitda=float(d["ebitda"]),
                    da=float(d["da"]),
                    ebit=float(d["ebit"]),
                    tax_expense=float(d["tax_expense"]),
                    nopat=float(d["nopat"]),
                    capex=float(d["capex"]),
                    change_nwc=float(d["change_nwc"]),
                    fcff=float(d["fcff"]),
                )
            )

        wacc_detail_obj = None
        if cleaned.get("wacc_detail"):
            wd = cleaned["wacc_detail"]
            wacc_detail_obj = WACCDetail(
                cost_of_equity=wd["cost_of_equity"],
                cost_of_debt_pretax=wd["cost_of_debt_pretax"],
                cost_of_debt_after_tax=wd["cost_of_debt_after_tax"],
                equity_weight=wd["equity_weight"],
                debt_weight=wd["debt_weight"],
                wacc=wd["wacc"],
            )

        assumptions_obj = DCFAssumptions(
            revenue_growth=revenue_growth,
            ebitda_margin=ebitda_margin,
            da_pct_revenue=da_pct_revenue,
            capex_pct_revenue=capex_pct_revenue,
            tax_rate=tax_rate,
            terminal_growth=terminal_growth,
            forecast_years=forecast_years,
            risk_free_rate=risk_free_rate,
            equity_risk_premium=equity_risk_premium,
            beta=beta,
        )

        diagnostics = {
            "shares_outstanding": shares,
            "net_debt_cr": net_debt,
            "total_debt_cr": total_debt,
            "interest_expense_cr": interest_exp,
            "market_cap_cr": market_cap,
        }

        return DCFResponse(
            company_id=canonical_id,
            wacc_used=cleaned["wacc_used"],
            wacc_detail=wacc_detail_obj,
            terminal_growth=cleaned["terminal_growth"],
            forecast_years=forecast_years,
            assumptions=assumptions_obj,
            forecast=forecast_list,
            terminal_value_undiscounted=cleaned["terminal_value_undiscounted"],
            pv_explicit_fcff=cleaned["pv_explicit_fcff"],
            pv_terminal_value=cleaned["pv_terminal_value"],
            implied_ev=cleaned["implied_ev"],
            implied_equity_value=cleaned["implied_equity_value"],
            implied_value_per_share=cleaned.get("implied_value_per_share"),
            actual_market_cap=market_cap if market_cap > 0 else None,
            warnings=cleaned.get("warnings", []),
            diagnostics=diagnostics,
        )
