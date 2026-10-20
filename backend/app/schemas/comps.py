"""
backend/app/schemas/comps.py

Pydantic schemas for Comparable Companies Analysis.
Directly maps the outputs of analytics/comps.py and valuation._build_comps_section.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MultipleStats(BaseModel):
    """Percentile statistics for a single trading multiple across peers."""
    model_config = ConfigDict(from_attributes=True)

    p25: Optional[float] = Field(None, description="25th percentile multiple value")
    median: Optional[float] = Field(None, description="Median (50th percentile) multiple value")
    p75: Optional[float] = Field(None, description="75th percentile multiple value")
    n: int = Field(0, description="Number of peers with non-null values for this multiple")


class CompsPeerStatistics(BaseModel):
    """Peer group summary statistics and multiple distributions."""
    model_config = ConfigDict(from_attributes=True)

    peer_count: int = Field(..., description="Total companies in the peer group")
    small_sample_warning: bool = Field(..., description="True if peer count < 5 threshold")
    multiples: Dict[str, MultipleStats] = Field(..., description="Multiples distribution: ev_revenue, ev_ebitda, pe_ratio")


class ImpliedValuationEntry(BaseModel):
    """Implied valuation derived from a single multiple at a specified percentile."""
    model_config = ConfigDict(from_attributes=True)

    multiple_used: Optional[float] = Field(None, description="Peer multiple value applied")
    implied_ev: Optional[float] = Field(None, description="Derived implied enterprise value in Rs Cr")
    implied_equity_value: Optional[float] = Field(None, description="Derived implied equity value in Rs Cr")


class ValuationRangePoint(BaseModel):
    """Single point in a valuation range (low, mid, high)."""
    model_config = ConfigDict(from_attributes=True)

    multiple: Optional[float] = Field(None, description="Multiple value at this percentile")
    implied_equity_value: Optional[float] = Field(None, description="Implied equity value in Rs Cr")


class CompsResponse(BaseModel):
    """Complete Comparable Companies Analysis response."""
    model_config = ConfigDict(from_attributes=True)

    target_id: str = Field(..., description="Target company identifier")
    target_sector: Optional[str] = Field(None, description="Target company sector")
    target_industry: Optional[str] = Field(None, description="Target company industry")
    peer_count: int = Field(..., description="Number of peer companies matched")
    small_sample_warning: bool = Field(..., description="True if peer group size is below reliable threshold")
    peer_group: List[str] = Field(..., description="List of peer company IDs")
    peer_statistics: CompsPeerStatistics = Field(..., description="Summary statistics across peer group")
    implied_valuation: Dict[str, ImpliedValuationEntry] = Field(..., description="Implied valuation using median multiple")
    valuation_ranges: Optional[Dict[str, Dict[str, ValuationRangePoint]]] = Field(None, description="Low/Mid/High implied valuation ranges")
    warnings: List[str] = Field(default_factory=list, description="Methodology, sample size, or sector diagnostics")
