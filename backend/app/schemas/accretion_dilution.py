"""
backend/app/schemas/accretion_dilution.py

Pydantic schemas for Phase 8: Accretion / Dilution analysis.
Directly maps inputs and outputs of analytics/accretion_dilution.py.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class AccretionDilutionRequest(BaseModel):
    """
    Input criteria to execute an Accretion / Dilution analysis.
    Directly reflects analytics/accretion_dilution.py calculate_accretion_dilution_from_universe.
    """
    model_config = ConfigDict(extra="forbid")

    buyer_id: str = Field(..., description="Acquiring company identifier (e.g. 'TCS')")
    target_id: str = Field(..., description="Target company identifier (e.g. 'Infosys')")
    purchase_equity_value: Optional[float] = Field(None, description="Explicit purchase equity value in Rs Cr")
    acquisition_premium: Optional[float] = Field(0.20, description="Acquisition premium as decimal fraction")
    cash_pct: float = Field(0.50, ge=0.0, le=1.0, description="Requested cash consideration fraction")
    debt_pct: float = Field(0.30, ge=0.0, le=1.0, description="Requested debt financing fraction")
    stock_pct: float = Field(0.20, ge=0.0, le=1.0, description="Requested stock consideration fraction")
    transaction_fees: float = Field(0.0, ge=0.0, description="Transaction advisory fees in Rs Cr")
    refinance_target_debt: bool = Field(False, description="If True, target existing debt is refinanced at closing")
    use_target_cash: bool = Field(False, description="If True, target balance sheet cash is swept to fund uses")
    debt_issuance_fee_pct: float = Field(0.0, ge=0.0, le=0.20, description="Debt underwriting/issuance fee percentage")
    minimum_cash_balance: float = Field(0.0, ge=0.0, description="Minimum post-deal operating cash buffer (Rs Cr)")
    other_sources: float = Field(0.0, ge=0.0, description="Non-mix external funding sources in Rs Cr")
    expected_annual_synergies: float = Field(0.0, description="Steady-state annual pre-tax cost synergies in Rs Cr")
    synergy_ramp_year_1: float = Field(0.33, ge=0.0, le=1.0, description="Year 1 synergy realization fraction")
    synergy_ramp_year_2: float = Field(0.67, ge=0.0, le=1.0, description="Year 2 synergy realization fraction")
    synergy_ramp_year_3: float = Field(1.0, ge=0.0, le=1.0, description="Year 3 synergy realization fraction")
    synergy_year_1: Optional[float] = Field(None, description="Direct override for Year 1 pre-tax synergies (Rs Cr)")
    synergy_year_2: Optional[float] = Field(None, description="Direct override for Year 2 pre-tax synergies (Rs Cr)")
    synergy_year_3: Optional[float] = Field(None, description="Direct override for Year 3 pre-tax synergies (Rs Cr)")
    debt_interest_rate: float = Field(0.08, ge=0.0, description="Pre-tax interest rate on newly issued debt")
    foregone_cash_interest_rate: float = Field(0.05, ge=0.0, description="Pre-tax interest rate on buyer balance sheet cash")
    tax_rate: float = Field(0.25, ge=0.0, lt=1.0, description="Marginal corporate income tax rate")

    @model_validator(mode="after")
    def validate_financing_mix(self) -> "AccretionDilutionRequest":
        mix_sum = self.cash_pct + self.debt_pct + self.stock_pct
        if abs(mix_sum - 1.0) > 1e-4:
            raise ValueError(
                f"Financing mix must sum to 1.0 (100%). Got cash={self.cash_pct:.4f}, debt={self.debt_pct:.4f}, stock={self.stock_pct:.4f} (sum={mix_sum:.4f})"
            )
        return self


class BuyerADProfile(BaseModel):
    """Buyer financial parameters relevant to Accretion / Dilution."""
    model_config = ConfigDict(from_attributes=True)

    net_income: Optional[float] = Field(None, description="Buyer standalone net income in Rs Cr")
    diluted_shares: Optional[float] = Field(None, description="Buyer standalone diluted share count")
    share_price: Optional[float] = Field(None, description="Buyer share price in INR")
    cash: Optional[float] = Field(None, description="Buyer pre-deal balance sheet cash in Rs Cr")


class TargetADProfile(BaseModel):
    """Target financial parameters relevant to Accretion / Dilution."""
    model_config = ConfigDict(from_attributes=True)

    net_income: Optional[float] = Field(None, description="Target standalone net income in Rs Cr")
    diluted_shares: Optional[float] = Field(None, description="Target standalone diluted share count")
    share_price: Optional[float] = Field(None, description="Target share price in INR")


class ADFinancingDetail(BaseModel):
    """Transaction financing execution parameters for Accretion / Dilution."""
    model_config = ConfigDict(from_attributes=True)

    new_debt: float = Field(..., description="New debt raised in Rs Cr")
    debt_interest_rate: float = Field(..., description="Pre-tax interest rate on new debt")
    debt_interest: float = Field(..., description="Annual pre-tax interest expense in Rs Cr")
    after_tax_debt_interest: float = Field(..., description="Annual after-tax debt interest expense in Rs Cr")
    buyer_cash_used: float = Field(..., description="Actual executable buyer cash contributed in Rs Cr")
    foregone_cash_interest_rate: float = Field(..., description="Pre-tax foregone cash yield")
    foregone_interest: float = Field(..., description="Annual pre-tax foregone interest income in Rs Cr")
    after_tax_foregone_interest: float = Field(..., description="Annual after-tax foregone interest income in Rs Cr")
    stock_consideration_value: float = Field(..., description="Stock consideration value in Rs Cr")
    tax_rate: float = Field(..., description="Tax rate applied to interest and synergies")
    is_feasible: bool = Field(..., description="True if financing structure is executable without cash deficit")


class ADSynergiesDetail(BaseModel):
    """Gross and after-tax annual synergy schedule."""
    model_config = ConfigDict(from_attributes=True)

    gross_year_1: float = Field(..., description="Pre-tax synergies in Year 1 (Rs Cr)")
    after_tax_year_1: float = Field(..., description="After-tax synergies in Year 1 (Rs Cr)")
    gross_year_2: float = Field(..., description="Pre-tax synergies in Year 2 (Rs Cr)")
    after_tax_year_2: float = Field(..., description="After-tax synergies in Year 2 (Rs Cr)")
    gross_year_3: float = Field(..., description="Pre-tax synergies in Year 3 (Rs Cr)")
    after_tax_year_3: float = Field(..., description="After-tax synergies in Year 3 (Rs Cr)")


class ADStandaloneEPS(BaseModel):
    """Standalone baseline EPS for buyer and target."""
    model_config = ConfigDict(from_attributes=True)

    buyer_eps: Optional[float] = Field(None, description="Buyer standalone EPS in INR")
    target_eps: Optional[float] = Field(None, description="Target standalone EPS in INR")


class ADYearProjection(BaseModel):
    """Accretion / Dilution forecast for a single projection year."""
    model_config = ConfigDict(from_attributes=True)

    year: int = Field(..., description="Projection period index (1, 2, or 3)")
    buyer_net_income: Optional[float] = Field(None, description="Buyer standalone net income in Rs Cr")
    target_net_income: Optional[float] = Field(None, description="Target standalone net income in Rs Cr")
    gross_synergy: float = Field(..., description="Pre-tax synergies realized in this year (Rs Cr)")
    after_tax_synergy: float = Field(..., description="After-tax synergies in this year (Rs Cr)")
    new_debt: float = Field(..., description="New debt principal in Rs Cr")
    debt_interest: float = Field(..., description="Pre-tax debt interest expense in Rs Cr")
    after_tax_debt_interest: float = Field(..., description="After-tax debt interest expense in Rs Cr")
    buyer_cash_used: float = Field(..., description="Actual executable buyer cash used in Rs Cr")
    foregone_interest: float = Field(..., description="Pre-tax foregone cash interest in Rs Cr")
    after_tax_foregone_interest: float = Field(..., description="After-tax foregone cash interest in Rs Cr")
    pro_forma_net_income: Optional[float] = Field(None, description="Combined pro-forma net income in Rs Cr")
    buyer_eps: Optional[float] = Field(None, description="Buyer standalone baseline EPS in INR")
    pro_forma_shares: Optional[float] = Field(None, description="Combined pro-forma diluted share count")
    pro_forma_eps: Optional[float] = Field(None, description="Combined pro-forma EPS in INR")
    eps_change: Optional[float] = Field(None, description="Pro-forma EPS minus Buyer Standalone EPS in INR")
    accretion_dilution_pct: Optional[float] = Field(None, description="Accretion (+) or Dilution (-) percentage")
    status: str = Field(..., description="'ACCRETIVE', 'DILUTIVE', 'NEUTRAL', or 'NON-EXECUTABLE / ILLUSTRATIVE'")
    modelled_status: Optional[str] = Field(None, description="Underlying mathematical direction ('ACCRETIVE', 'DILUTIVE', 'NEUTRAL')")
    is_feasible: bool = Field(..., description="True if executable without cash deficit")


class BreakEvenSynergyDetail(BaseModel):
    """Break-even annual synergy required for transaction to be EPS-neutral."""
    model_config = ConfigDict(from_attributes=True)

    required_pro_forma_net_income: Optional[float] = Field(None, description="Pro-forma NI required for EPS parity (Rs Cr)")
    break_even_after_tax_synergy: Optional[float] = Field(None, description="After-tax annual synergy required (Rs Cr)")
    break_even_gross_synergy: Optional[float] = Field(None, description="Pre-tax annual gross synergy required (Rs Cr)")
    synergies_required: Optional[bool] = Field(None, description="True if transaction is dilutive before synergies")


class ADProFormaProjections(BaseModel):
    """Pro-forma shares and multi-year projection timeline."""
    model_config = ConfigDict(from_attributes=True)

    new_shares_issued: Optional[float] = Field(None, description="New buyer shares issued to target shareholders")
    pro_forma_shares: Optional[float] = Field(None, description="Total pro-forma diluted share count")
    years: Dict[str, ADYearProjection] = Field(..., description="Year 1, Year 2, and Year 3 EPS projections")


class AccretionDilutionResponse(BaseModel):
    """Complete institutional Accretion / Dilution analysis report."""
    model_config = ConfigDict(from_attributes=True)

    buyer: BuyerADProfile = Field(..., description="Buyer financial parameters")
    target: TargetADProfile = Field(..., description="Target financial parameters")
    financing: ADFinancingDetail = Field(..., description="Financing parameters and interest impacts")
    synergies: ADSynergiesDetail = Field(..., description="Synergy realization schedule")
    standalone: ADStandaloneEPS = Field(..., description="Buyer and target standalone EPS")
    pro_forma: ADProFormaProjections = Field(..., description="Share issuance and multi-year EPS projections")
    break_even: Dict[str, BreakEvenSynergyDetail] = Field(..., description="Annual break-even synergy requirements by year")
    diagnostics: List[str] = Field(default_factory=list, description="Feasibility and data diagnostics")
    is_available: bool = Field(..., description="True if required financial data was available to compute EPS")
    is_feasible: bool = Field(..., description="True if transaction financing is executable")
