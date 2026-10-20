"""
backend/app/schemas/screening.py

Pydantic schemas for the acquisition target screening engine.
Directly maps the inputs and outputs of analytics/screening.py.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ScreeningRequest(BaseModel):
    """
    Input criteria for screening M&A targets.
    Exposes only parameters defined by analytics/screening.py.
    """
    model_config = ConfigDict(extra="forbid")

    sector: Optional[str] = Field(None, description="Optional sector filter (e.g. 'Materials', 'IT')")
    min_revenue_cagr: Optional[float] = Field(None, description="Minimum revenue CAGR (e.g. 0.10 for 10%)")
    min_ebitda_margin: Optional[float] = Field(None, description="Minimum latest EBITDA margin (e.g. 0.15 for 15%)")
    max_ev_ebitda: Optional[float] = Field(None, description="Maximum EV/EBITDA multiple (e.g. 15.0)")
    max_net_debt_ebitda: Optional[float] = Field(None, description="Maximum Net Debt / EBITDA leverage (e.g. 3.0)")
    industrial_only: bool = Field(True, description="Exclude Financial-sector companies (default True per V0 scope)")
    sort_by: Optional[str] = Field("illustrative_screening_score", description="Field to sort screened results by")
    ascending: bool = Field(False, description="Sort direction (default False for descending score/metrics)")
    limit: Optional[int] = Field(None, ge=1, le=500, description="Optional limit on returned candidate count")


class ScreenedCompany(BaseModel):
    """Single acquisition target matching screening criteria."""
    model_config = ConfigDict(from_attributes=True)

    company_id: str = Field(..., description="Unique company identifier")
    company_name: str = Field(..., description="Company name")
    ticker: Optional[str] = Field(None, description="Ticker symbol")
    sector: Optional[str] = Field(None, description="Sector classification")
    industry: Optional[str] = Field(None, description="Industry classification")
    sector_type: Optional[str] = Field(None, description="Sector type ('Industrial' or 'Financial')")
    revenue_latest: Optional[float] = Field(None, description="Latest fiscal year revenue (Rs Cr)")
    revenue_cagr: Optional[float] = Field(None, description="Historical revenue CAGR")
    ebitda_latest: Optional[float] = Field(None, description="Latest EBITDA (Rs Cr)")
    ebitda_margin: Optional[float] = Field(None, description="Latest EBITDA margin")
    net_debt_latest: Optional[float] = Field(None, description="Latest net debt (Rs Cr)")
    ev: Optional[float] = Field(None, description="Enterprise value (Rs Cr)")
    ev_ebitda: Optional[float] = Field(None, description="EV / EBITDA multiple")
    net_debt_ebitda: Optional[float] = Field(None, description="Net Debt / EBITDA leverage")
    ev_revenue: Optional[float] = Field(None, description="EV / Revenue multiple")
    pe_ratio: Optional[float] = Field(None, description="P/E multiple")
    growth_score: Optional[float] = Field(None, description="Percentile growth score (0-100)")
    margin_score: Optional[float] = Field(None, description="Percentile margin score (0-100)")
    valuation_score: Optional[float] = Field(None, description="Percentile valuation attractiveness score (0-100)")
    leverage_score: Optional[float] = Field(None, description="Percentile leverage safety score (0-100)")
    illustrative_screening_score: Optional[float] = Field(None, description="Composite illustrative score (0-100)")


class ScreeningResponse(BaseModel):
    """Screening execution results, diagnostics, and candidate list."""
    model_config = ConfigDict(from_attributes=True)

    total_universe_count: int = Field(..., description="Total companies in the universe before filtering")
    passed_count: int = Field(..., description="Number of companies passing all specified criteria")
    filters_applied: Dict[str, Any] = Field(..., description="Summary of screening filters applied")
    warnings: List[str] = Field(default_factory=list, description="Methodology and data diagnostics")
    diagnostics: Dict[str, Any] = Field(default_factory=dict, description="Metadata and filter statistics")
    items: List[ScreenedCompany] = Field(..., description="Shortlisted companies ordered by specified criteria")
