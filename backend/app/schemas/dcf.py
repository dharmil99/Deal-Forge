"""
backend/app/schemas/dcf.py

Pydantic schemas for Discounted Cash Flow (DCF) valuation.
Directly maps inputs and outputs of analytics/dcf.py.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class WACCDetail(BaseModel):
    """Component breakdown of CAPM-derived Weighted Average Cost of Capital."""
    model_config = ConfigDict(from_attributes=True)

    cost_of_equity: float = Field(..., description="Cost of equity (Ke)")
    cost_of_debt_pretax: float = Field(..., description="Pre-tax cost of debt (Kd)")
    cost_of_debt_after_tax: float = Field(..., description="After-tax cost of debt: Kd * (1 - t)")
    equity_weight: float = Field(..., description="Equity weighting in capital structure (We)")
    debt_weight: float = Field(..., description="Debt weighting in capital structure (Wd)")
    wacc: float = Field(..., description="Calculated WACC")


class DCFAssumptions(BaseModel):
    """Core operating and macroeconomic assumptions utilized in the DCF forecast."""
    model_config = ConfigDict(from_attributes=True)

    revenue_growth: float = Field(..., description="Forecast revenue annual growth rate")
    ebitda_margin: float = Field(..., description="Forecast EBITDA margin")
    da_pct_revenue: float = Field(..., description="D&A expense as percentage of revenue")
    capex_pct_revenue: float = Field(..., description="CapEx as percentage of revenue")
    tax_rate: float = Field(..., description="Effective marginal corporate tax rate")
    terminal_growth: float = Field(..., description="Perpetual terminal growth rate (g)")
    forecast_years: int = Field(..., description="Number of explicit forecast years")
    risk_free_rate: Optional[float] = Field(None, description="Risk-free rate assumed in CAPM")
    equity_risk_premium: Optional[float] = Field(None, description="Equity risk premium assumed in CAPM")
    beta: Optional[float] = Field(None, description="Assumed equity beta")


class DCFForecastYear(BaseModel):
    """Single explicit forecast year cash flow breakdown."""
    model_config = ConfigDict(from_attributes=True)

    forecast_year: int = Field(..., description="Forecast period index (1..n)")
    revenue: float = Field(..., description="Projected revenue in Rs Cr")
    ebitda: float = Field(..., description="Projected EBITDA in Rs Cr")
    da: float = Field(..., description="Projected depreciation and amortization in Rs Cr")
    ebit: float = Field(..., description="Projected operating profit (EBIT) in Rs Cr")
    tax_expense: float = Field(..., description="Projected income tax expense in Rs Cr")
    nopat: float = Field(..., description="Net Operating Profit After Tax (NOPAT) in Rs Cr")
    capex: float = Field(..., description="Projected capital expenditures in Rs Cr")
    change_nwc: float = Field(..., description="Projected change in Net Working Capital (assumed 0 in V0)")
    fcff: float = Field(..., description="Free Cash Flow to Firm in Rs Cr (NOPAT + D&A - CapEx - deltaNWC)")


class DCFResponse(BaseModel):
    """Complete DCF valuation output with projections, terminal value, and diagnostics."""
    model_config = ConfigDict(from_attributes=True)

    company_id: str = Field(..., description="Target company identifier")
    wacc_used: float = Field(..., description="Discount rate used in present value discounting")
    wacc_detail: Optional[WACCDetail] = Field(None, description="Detailed CAPM capital weights and component rates")
    terminal_growth: float = Field(..., description="Perpetual Gordon Growth rate")
    forecast_years: int = Field(..., description="Number of explicit projection years")
    assumptions: DCFAssumptions = Field(..., description="Summary of forecast assumptions applied")
    forecast: List[DCFForecastYear] = Field(..., description="Explicit annual projected cash flows")
    terminal_value_undiscounted: float = Field(..., description="Terminal value at end of forecast period in Rs Cr")
    pv_explicit_fcff: float = Field(..., description="Present value of explicit forecast period cash flows in Rs Cr")
    pv_terminal_value: float = Field(..., description="Present value of discounted terminal value in Rs Cr")
    implied_ev: float = Field(..., description="Implied Enterprise Value in Rs Cr (PV of FCFF + PV of TV)")
    implied_equity_value: float = Field(..., description="Implied Equity Value in Rs Cr (Implied EV - Net Debt)")
    implied_value_per_share: Optional[float] = Field(None, description="Implied equity value per share in INR")
    actual_market_cap: Optional[float] = Field(None, description="Actual latest market capitalization in Rs Cr")
    warnings: List[str] = Field(default_factory=list, description="Model sanity warnings (negative FCFF, CapEx > EBITDA, etc.)")
    diagnostics: Dict[str, Any] = Field(default_factory=dict, description="Diagnostic sanity checks and metadata")
