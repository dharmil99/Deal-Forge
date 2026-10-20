"""
backend/app/schemas/valuation.py

Pydantic schemas for the consolidated Valuation Summary and Football Field chart.
Directly maps outputs of analytics/valuation.py without blending methodologies.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.schemas.comps import MultipleStats, ValuationRangePoint
from backend.app.schemas.precedents import PrecedentMultipleStats


class ValuationTargetSummary(BaseModel):
    """Core financial baseline for the target company being valued."""
    model_config = ConfigDict(from_attributes=True)

    company_id: str = Field(..., description="Target company identifier")
    sector: Optional[str] = Field(None, description="Sector classification")
    industry: Optional[str] = Field(None, description="Industry classification")
    sector_type: Optional[str] = Field(None, description="'Industrial' or 'Financial'")
    market_cap_latest: Optional[float] = Field(None, description="Latest market cap in Rs Cr")
    current_price: Optional[float] = Field(None, description="Latest share price in INR")
    ev: Optional[float] = Field(None, description="Latest enterprise value in Rs Cr")
    net_debt_latest: Optional[float] = Field(None, description="Latest net debt in Rs Cr")
    revenue_latest: Optional[float] = Field(None, description="Latest fiscal year revenue in Rs Cr")
    ebitda_latest: Optional[float] = Field(None, description="Latest EBITDA in Rs Cr")
    ebitda_margin: Optional[float] = Field(None, description="Latest EBITDA margin")
    revenue_cagr: Optional[float] = Field(None, description="Revenue CAGR")


class ValuationCompsSection(BaseModel):
    """Comparable Companies section in the unified valuation summary."""
    model_config = ConfigDict(from_attributes=True)

    peer_count: int = Field(..., description="Number of matched peers")
    peer_group: List[str] = Field(..., description="Peer company identifiers")
    small_sample_warning: bool = Field(..., description="True if peer count < 5")
    multiples: Dict[str, MultipleStats] = Field(..., description="Trading multiples statistics")
    valuation: Dict[str, Dict[str, ValuationRangePoint]] = Field(..., description="Valuation ranges (low/mid/high) by multiple")


class ValuationPrecedentsSection(BaseModel):
    """Precedent Transactions section in the unified valuation summary."""
    model_config = ConfigDict(from_attributes=True)

    transaction_count: int = Field(..., description="Number of precedent transactions matched")
    small_sample_warning: bool = Field(..., description="True if deal count < 5")
    multiples: Dict[str, PrecedentMultipleStats] = Field(..., description="Deal multiples statistics")
    valuation: Dict[str, Optional[Dict[str, ValuationRangePoint]]] = Field(..., description="Implied valuation ranges by multiple")


class ValuationDCFSection(BaseModel):
    """DCF valuation section in the unified valuation summary."""
    model_config = ConfigDict(from_attributes=True)

    implied_ev: float = Field(..., description="Implied enterprise value in Rs Cr")
    implied_equity_value: float = Field(..., description="Implied equity value in Rs Cr")
    implied_value_per_share: Optional[float] = Field(None, description="Implied per-share value in INR")
    wacc: float = Field(..., description="WACC discount rate")
    terminal_growth: float = Field(..., description="Terminal perpetual growth rate")
    assumptions: Dict[str, Any] = Field(..., description="Underlying DCF forecast parameters")
    wacc_detail: Dict[str, Any] = Field(default_factory=dict, description="CAPM WACC calculation breakdown")
    pv_explicit_fcff: float = Field(..., description="PV of explicit forecast cash flows")
    pv_terminal_value: float = Field(..., description="PV of terminal value")
    warnings: List[str] = Field(default_factory=list, description="DCF-specific warnings")


class FootballFieldRow(BaseModel):
    """Single row in the football field comparative valuation summary."""
    model_config = ConfigDict(from_attributes=True)

    methodology: str = Field(..., description="Valuation methodology (e.g. 'Comps — EV/Revenue', 'DCF')")
    low_multiple: Optional[float] = Field(None, description="25th percentile multiple (None for DCF)")
    mid_multiple: Optional[float] = Field(None, description="Median multiple (None for DCF)")
    high_multiple: Optional[float] = Field(None, description="75th percentile multiple (None for DCF)")
    low: Optional[float] = Field(None, description="Implied equity value at low / 25th percentile (Rs Cr)")
    mid: Optional[float] = Field(None, description="Implied equity value at median / base point (Rs Cr)")
    high: Optional[float] = Field(None, description="Implied equity value at high / 75th percentile (Rs Cr)")
    available: bool = Field(..., description="True if this methodology has sufficient data to produce an implied value")


class DataQualitySummary(BaseModel):
    """Transparency audit of dataset depth and methodology viability."""
    model_config = ConfigDict(from_attributes=True)

    peer_count: int = Field(..., description="Number of peers in comps group")
    comps_small_sample: bool = Field(..., description="True if comps peer group < 5")
    comps_ev_ebitda_available: bool = Field(..., description="True if peer EV/EBITDA data exists")
    comps_pe_available: bool = Field(..., description="True if peer P/E data exists")
    precedent_count: int = Field(..., description="Number of transactions in precedent sample")
    precedents_small_sample: bool = Field(..., description="True if precedent sample < 5")
    precedent_ev_revenue_count: int = Field(..., description="Deals with EV/Revenue data")
    precedent_ev_ebitda_count: int = Field(..., description="Deals with EV/EBITDA data")
    precedent_ev_revenue_available: bool = Field(..., description="True if precedent EV/Revenue data exists")
    precedent_ev_ebitda_available: bool = Field(..., description="True if precedent EV/EBITDA data exists")
    shares_outstanding_is_stale: bool = Field(..., description="True if target shares were sourced from prior year")
    dcf_available: bool = Field(..., description="True if DCF completed successfully")
    dcf_has_warnings: bool = Field(..., description="True if DCF produced sanity warnings")
    target_ebitda_available: bool = Field(..., description="True if target has non-null EBITDA")
    target_net_debt_available: bool = Field(..., description="True if target has non-null net debt")


class ValuationSummaryResponse(BaseModel):
    """Unified multi-methodology valuation summary for a target company."""
    model_config = ConfigDict(from_attributes=True)

    target: ValuationTargetSummary = Field(..., description="Target company baseline")
    comps: ValuationCompsSection = Field(..., description="Comparable companies analysis")
    precedents: ValuationPrecedentsSection = Field(..., description="Precedent transactions analysis")
    dcf: Optional[ValuationDCFSection] = Field(None, description="DCF valuation (None if insufficient data)")
    valuation_table: List[FootballFieldRow] = Field(..., description="Comparative football field valuation summary")
    warnings: List[str] = Field(default_factory=list, description="All methodology and data-quality warnings")
    data_quality: DataQualitySummary = Field(..., description="Data completeness and availability flags")
