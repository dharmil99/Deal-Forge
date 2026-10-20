"""
backend/app/schemas/precedents.py

Pydantic schemas for Precedent Transactions Analysis.
Directly maps the outputs of analytics/precedents.py and valuation._build_precedents_section.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.schemas.comps import ImpliedValuationEntry, ValuationRangePoint


class TransactionRecord(BaseModel):
    """Historical M&A transaction record."""
    model_config = ConfigDict(from_attributes=True)

    transaction_id: str = Field(..., description="Unique transaction identifier (e.g. 'T001')")
    announcement_date: Optional[str] = Field(None, description="Deal announcement date (YYYY-MM-DD)")
    acquirer: str = Field(..., description="Acquiring entity name")
    target: str = Field(..., description="Target business or company name")
    sector: Optional[str] = Field(None, description="Target sector")
    industry: Optional[str] = Field(None, description="Target industry")
    geography: Optional[str] = Field(None, description="Geographic jurisdiction")
    transaction_type: Optional[str] = Field(None, description="M&A structure type (e.g. Majority Buyout, Bolt-on)")
    stake_acquired_pct: Optional[float] = Field(None, description="Percentage equity stake acquired")
    deal_value_cr: Optional[float] = Field(None, description="Disclosed transaction consideration in Rs Cr")
    target_revenue_cr: Optional[float] = Field(None, description="Target company revenue at deal time in Rs Cr")
    target_ebitda_cr: Optional[float] = Field(None, description="Target company EBITDA at deal time (None if undisclosed)")
    implied_ev_cr: Optional[float] = Field(None, description="Implied 100%-basis enterprise value in Rs Cr")
    ev_revenue: Optional[float] = Field(None, description="Derived EV / Revenue transaction multiple")
    ev_ebitda: Optional[float] = Field(None, description="Derived EV / EBITDA transaction multiple (None if target EBITDA undisclosed)")
    status: Optional[str] = Field(None, description="Transaction status (e.g. 'Completed')")
    source_note: Optional[str] = Field(None, description="Citation and data sourcing notes")


class PrecedentMultipleStats(BaseModel):
    """Percentile distribution for an M&A transaction multiple."""
    model_config = ConfigDict(from_attributes=True)

    p25: Optional[float] = Field(None, description="25th percentile transaction multiple")
    median: Optional[float] = Field(None, description="Median transaction multiple")
    p75: Optional[float] = Field(None, description="75th percentile transaction multiple")
    n: int = Field(0, description="Number of deals with valid multiple data")


class PrecedentsResponse(BaseModel):
    """Complete Precedent Transactions Analysis response."""
    model_config = ConfigDict(from_attributes=True)

    target_id: str = Field(..., description="Target company identifier")
    target_sector: Optional[str] = Field(None, description="Target company sector")
    target_industry: Optional[str] = Field(None, description="Target company industry")
    target_revenue_cr: Optional[float] = Field(None, description="Target company latest revenue in Rs Cr")
    target_ebitda_cr: Optional[float] = Field(None, description="Target company latest EBITDA in Rs Cr (None if missing)")
    target_net_debt_cr: Optional[float] = Field(None, description="Target company latest net debt in Rs Cr")
    transaction_count: int = Field(..., description="Number of precedent deals matching criteria")
    small_sample_warning: bool = Field(..., description="True if deal count < 5 threshold")
    transactions: List[TransactionRecord] = Field(default_factory=list, description="Individual historical deals")
    statistics: Dict[str, PrecedentMultipleStats] = Field(..., description="EV/Revenue and EV/EBITDA multiple distributions")
    implied_valuation: Dict[str, Optional[ImpliedValuationEntry]] = Field(..., description="Implied valuation derived from median multiples")
    valuation_ranges: Optional[Dict[str, Optional[Dict[str, ValuationRangePoint]]]] = Field(None, description="Low/Mid/High valuation ranges")
    warnings: List[str] = Field(default_factory=list, description="Data availability and sample size warnings")
    diagnostics: Dict[str, Any] = Field(default_factory=dict, description="Metadata on data completeness and methodology coverage")
