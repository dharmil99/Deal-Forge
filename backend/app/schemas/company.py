"""
backend/app/schemas/company.py

Pydantic schemas for company discovery, details, and historical financials.
"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CompanySummary(BaseModel):
    """Concise representation of a company in the DealForge universe."""
    model_config = ConfigDict(from_attributes=True)

    company_id: str = Field(..., description="Unique company identifier (e.g. 'TCS')")
    company_name: str = Field(..., description="Full legal / trading company name")
    ticker: Optional[str] = Field(None, description="NSE/BSE ticker symbol")
    sector: Optional[str] = Field(None, description="Broad sector classification (e.g. 'IT', 'Materials')")
    industry: Optional[str] = Field(None, description="Fine-grained industry classification (e.g. 'IT Services')")
    sector_type: Optional[str] = Field(None, description="Sector type: 'Industrial' or 'Financial'")
    current_price: Optional[float] = Field(None, description="Latest share price in INR")
    market_cap_latest: Optional[float] = Field(None, description="Latest market capitalization in Rs Cr")
    revenue_latest: Optional[float] = Field(None, description="Latest fiscal year revenue in Rs Cr")
    ebitda_latest: Optional[float] = Field(None, description="Latest fiscal year EBITDA in Rs Cr")
    ebitda_margin: Optional[float] = Field(None, description="Latest fiscal year EBITDA margin (0-1)")
    net_debt_latest: Optional[float] = Field(None, description="Latest net debt in Rs Cr")
    ev: Optional[float] = Field(None, description="Latest enterprise value in Rs Cr")
    pe_ratio: Optional[float] = Field(None, description="Latest P/E ratio")
    ev_ebitda: Optional[float] = Field(None, description="Latest EV/EBITDA multiple")
    ev_revenue: Optional[float] = Field(None, description="Latest EV/Revenue multiple")
    illustrative_screening_score: Optional[float] = Field(None, description="Composite illustrative screening score (0-100)")


class CompanyListResponse(BaseModel):
    """Paginated list of companies."""
    model_config = ConfigDict(from_attributes=True)

    total: int = Field(..., description="Total number of companies matching the filter")
    skip: int = Field(0, description="Offset index for pagination")
    limit: int = Field(50, description="Maximum number of items returned")
    items: List[CompanySummary] = Field(..., description="List of company summary records")


class CompanyDetail(BaseModel):
    """Complete company detail record combining identity, market data, and screening metrics."""
    model_config = ConfigDict(from_attributes=True)

    company_id: str = Field(..., description="Unique company identifier")
    company_name: str = Field(..., description="Full company name")
    ticker: Optional[str] = Field(None, description="Ticker symbol")
    source_file: Optional[str] = Field(None, description="Source raw Excel filename")
    face_value: Optional[float] = Field(None, description="Per-share face value in INR")
    current_price: Optional[float] = Field(None, description="Current share price in INR")
    market_cap_latest: Optional[float] = Field(None, description="Latest market cap in Rs Cr")
    sector: Optional[str] = Field(None, description="Sector classification")
    industry: Optional[str] = Field(None, description="Industry classification")
    sector_type: Optional[str] = Field(None, description="Industrial vs Financial")
    latest_fiscal_year: Optional[float] = Field(None, description="Most recent reported fiscal year")
    years_of_history: Optional[float] = Field(None, description="Number of years of historical data available")
    revenue_latest: Optional[float] = Field(None, description="Latest revenue in Rs Cr")
    revenue_cagr: Optional[float] = Field(None, description="Compound annual growth rate of revenue over available history")
    ebitda_latest: Optional[float] = Field(None, description="Latest EBITDA in Rs Cr")
    ebitda_margin: Optional[float] = Field(None, description="Latest EBITDA margin")
    net_debt_latest: Optional[float] = Field(None, description="Latest net debt in Rs Cr (Borrowings - Cash)")
    net_income_latest: Optional[float] = Field(None, description="Latest net income in Rs Cr")
    shares_outstanding_latest: Optional[float] = Field(None, description="Latest share count")
    shares_outstanding_fallback_year: Optional[float] = Field(None, description="Year shares were pulled from if latest was missing")
    shares_outstanding_is_stale: Optional[bool] = Field(None, description="True if shares count is from a prior fiscal year")
    ev: Optional[float] = Field(None, description="Enterprise value in Rs Cr")
    ev_ebitda: Optional[float] = Field(None, description="EV / EBITDA multiple")
    net_debt_ebitda: Optional[float] = Field(None, description="Net Debt / EBITDA leverage multiple")
    ev_revenue: Optional[float] = Field(None, description="EV / Revenue multiple")
    eps: Optional[float] = Field(None, description="Earnings per share in INR")
    pe_ratio: Optional[float] = Field(None, description="Price / Earnings multiple")
    growth_score: Optional[float] = Field(None, description="Percentile growth score (0-100)")
    margin_score: Optional[float] = Field(None, description="Percentile margin score (0-100)")
    valuation_score: Optional[float] = Field(None, description="Percentile valuation attractiveness score (0-100)")
    leverage_score: Optional[float] = Field(None, description="Percentile leverage safety score (0-100)")
    illustrative_screening_score: Optional[float] = Field(None, description="Composite illustrative score (0-100)")


class CompanyFinancialRow(BaseModel):
    """Historical annual financial record for a single fiscal year."""
    model_config = ConfigDict(from_attributes=True)

    company_id: str = Field(..., description="Company identifier")
    fiscal_year: float = Field(..., description="Fiscal year (e.g. 2024.0)")
    revenue: Optional[float] = Field(None, description="Revenue from operations in Rs Cr")
    other_income: Optional[float] = Field(None, description="Other non-operating income in Rs Cr")
    depreciation: Optional[float] = Field(None, description="Depreciation and amortization in Rs Cr")
    interest: Optional[float] = Field(None, description="Finance costs / interest expense in Rs Cr")
    pbt: Optional[float] = Field(None, description="Profit before tax in Rs Cr")
    tax: Optional[float] = Field(None, description="Tax expense in Rs Cr")
    net_income: Optional[float] = Field(None, description="Net profit after tax in Rs Cr")
    ebitda_derived: Optional[float] = Field(None, description="Derived EBITDA in Rs Cr")
    ebitda_margin_derived: Optional[float] = Field(None, description="Derived EBITDA margin")
    total_debt: Optional[float] = Field(None, description="Total reported borrowings in Rs Cr")
    cash: Optional[float] = Field(None, description="Cash & cash equivalents / bank balances in Rs Cr")
    net_debt_derived: Optional[float] = Field(None, description="Derived net debt in Rs Cr (debt - cash)")
    shares_outstanding: Optional[float] = Field(None, description="Total shares outstanding")
    cfo: Optional[float] = Field(None, description="Cash flow from operating activities in Rs Cr")
    cfi: Optional[float] = Field(None, description="Cash flow from investing activities in Rs Cr")
    cff: Optional[float] = Field(None, description="Cash flow from financing activities in Rs Cr")


class CompanyFinancialsResponse(BaseModel):
    """Response containing complete historical annual financial records."""
    model_config = ConfigDict(from_attributes=True)

    company_id: str = Field(..., description="Target company identifier")
    count: int = Field(..., description="Total fiscal years of financial data available")
    financials: List[CompanyFinancialRow] = Field(..., description="Chronological financial records")
