"""
backend/app/schemas/deal.py

Pydantic schemas for Phase 6: Deal Builder.
Directly maps inputs and outputs of analytics/deal_model.py.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class DealCreateRequest(BaseModel):
    """
    Input parameters to construct an acquisition transaction model.
    Matches analytics/deal_model.py build_deal / build_deal_from_universe.
    """
    model_config = ConfigDict(extra="forbid")

    buyer_id: str = Field(..., description="Acquiring company identifier (e.g. 'TCS')")
    target_id: str = Field(..., description="Target company identifier (e.g. 'Infosys')")
    purchase_equity_value: Optional[float] = Field(None, description="Explicit purchase equity value in Rs Cr (takes precedence over premium)")
    acquisition_premium: Optional[float] = Field(0.20, description="Acquisition premium as decimal (e.g. 0.20 for 20%)")
    cash_pct: float = Field(1.0, ge=0.0, le=1.0, description="Fraction of consideration funded via cash (0.0 to 1.0)")
    debt_pct: float = Field(0.0, ge=0.0, le=1.0, description="Fraction of consideration funded via new debt (0.0 to 1.0)")
    stock_pct: float = Field(0.0, ge=0.0, le=1.0, description="Fraction of consideration funded via stock issuance (0.0 to 1.0)")
    transaction_fees: float = Field(0.0, ge=0.0, description="Advisory and transaction fees in Rs Cr")
    expected_annual_synergies: float = Field(0.0, description="Steady-state annual pre-tax cost synergies in Rs Cr")
    synergy_ramp_year_1: float = Field(0.33, ge=0.0, le=1.0, description="Synergy realization fraction in Year 1")
    synergy_ramp_year_2: float = Field(0.67, ge=0.0, le=1.0, description="Synergy realization fraction in Year 2")
    synergy_ramp_year_3: float = Field(1.0, ge=0.0, le=1.0, description="Synergy realization fraction in Year 3")

    @model_validator(mode="after")
    def validate_financing_mix(self) -> "DealCreateRequest":
        mix_sum = self.cash_pct + self.debt_pct + self.stock_pct
        if abs(mix_sum - 1.0) > 1e-4:
            raise ValueError(
                f"Financing mix must sum to 1.0 (100%). Got cash={self.cash_pct:.4f}, debt={self.debt_pct:.4f}, stock={self.stock_pct:.4f} (sum={mix_sum:.4f})"
            )
        return self


class DealCompanyProfile(BaseModel):
    """Financial and balance sheet profile of a transaction counterparty."""
    model_config = ConfigDict(from_attributes=True)

    company_id: str = Field(..., description="Company identifier")
    company_name: Optional[str] = Field(None, description="Full company name")
    sector: Optional[str] = Field(None, description="Sector classification")
    industry: Optional[str] = Field(None, description="Industry classification")
    revenue: Optional[float] = Field(None, description="Latest fiscal year revenue in Rs Cr")
    ebitda: Optional[float] = Field(None, description="Latest EBITDA in Rs Cr")
    net_income: Optional[float] = Field(None, description="Latest net income in Rs Cr")
    market_cap: Optional[float] = Field(None, description="Market capitalization / standalone equity value in Rs Cr")
    equity_value: Optional[float] = Field(None, description="Standalone equity value in Rs Cr")
    enterprise_value: Optional[float] = Field(None, description="Enterprise value in Rs Cr")
    net_debt: Optional[float] = Field(None, description="Net debt in Rs Cr")
    cash: Optional[float] = Field(None, description="Cash & cash equivalents in Rs Cr")
    total_debt: Optional[float] = Field(None, description="Total reported borrowings in Rs Cr")
    shares_outstanding: Optional[float] = Field(None, description="Diluted shares count")
    current_price: Optional[float] = Field(None, description="Share price in INR")
    eps: Optional[float] = Field(None, description="Standalone EPS in INR")


class DealTransactionTerms(BaseModel):
    """Core transaction pricing, consideration, and enterprise value terms."""
    model_config = ConfigDict(from_attributes=True)

    target_standalone_equity_value: Optional[float] = Field(None, description="Target standalone market equity value in Rs Cr")
    acquisition_premium: Optional[float] = Field(None, description="Effective acquisition premium (decimal fraction)")
    purchase_equity_value: float = Field(..., description="Total consideration paid to acquire target equity in Rs Cr")
    offer_price_per_share: Optional[float] = Field(None, description="Effective purchase price per target share in INR")
    target_net_debt: Optional[float] = Field(None, description="Target net debt included in transaction bridge in Rs Cr")
    transaction_enterprise_value: Optional[float] = Field(None, description="Transaction Enterprise Value (TEV = Equity Value + Net Debt) in Rs Cr")
    transaction_fees: float = Field(0.0, description="Transaction advisory & due diligence expenses in Rs Cr")
    total_transaction_value: float = Field(..., description="Purchase equity value plus transaction fees in Rs Cr")


class DealFinancingStructure(BaseModel):
    """Breakdown of consideration funding by capital source."""
    model_config = ConfigDict(from_attributes=True)

    funding_amount: float = Field(..., description="Base consideration amount being funded in Rs Cr")
    cash_pct: float = Field(..., description="Proportion funded via cash")
    debt_pct: float = Field(..., description="Proportion funded via new debt")
    stock_pct: float = Field(..., description="Proportion funded via stock issuance")
    cash_amount: float = Field(..., description="Cash consideration amount in Rs Cr")
    debt_amount: float = Field(..., description="New debt consideration amount in Rs Cr")
    stock_amount: float = Field(..., description="Stock consideration value in Rs Cr")
    stock_consideration_value: float = Field(..., description="Stock consideration value in Rs Cr")
    new_debt_amount: float = Field(..., description="New debt consideration amount in Rs Cr")


class DealSynergiesSchedule(BaseModel):
    """Run-rate and phased realization schedule for operating synergies."""
    model_config = ConfigDict(from_attributes=True)

    annual_run_rate: float = Field(..., description="Steady-state annual cost synergies in Rs Cr")
    synergy_type: str = Field("cost", description="Synergy category ('cost')")
    year_1: float = Field(..., description="Year 1 realized synergies in Rs Cr")
    year_2: float = Field(..., description="Year 2 realized synergies in Rs Cr")
    year_3: float = Field(..., description="Year 3 realized synergies in Rs Cr")
    ramp: Dict[str, float] = Field(..., description="Realization ramp fractions for Years 1, 2, and 3")


class DealResponse(BaseModel):
    """Complete Deal Builder model response."""
    model_config = ConfigDict(from_attributes=True)

    acquirer: DealCompanyProfile = Field(..., description="Acquiring company baseline profile")
    target: DealCompanyProfile = Field(..., description="Target company baseline profile")
    transaction: DealTransactionTerms = Field(..., description="Transaction valuation, premium, and TEV")
    financing: DealFinancingStructure = Field(..., description="Financing mix percentages and amounts")
    synergies: DealSynergiesSchedule = Field(..., description="Cost synergies realization schedule")
    warnings: List[str] = Field(default_factory=list, description="Data availability and financial diagnostics")
