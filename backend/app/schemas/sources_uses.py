"""
backend/app/schemas/sources_uses.py

Pydantic schemas for Phase 7: Sources & Uses schedule.
Directly maps inputs and outputs of analytics/sources_uses.py.
"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourcesUsesRequest(BaseModel):
    """
    Input criteria to generate an institutional Sources & Uses schedule.
    Directly reflects analytics/sources_uses.py parameters.
    """
    model_config = ConfigDict(extra="forbid")

    buyer_id: str = Field(..., description="Acquiring company identifier (e.g. 'TCS')")
    target_id: str = Field(..., description="Target company identifier (e.g. 'Infosys')")
    purchase_equity_value: Optional[float] = Field(None, description="Explicit purchase equity value in Rs Cr")
    acquisition_premium: Optional[float] = Field(0.20, description="Acquisition premium as decimal fraction")
    cash_pct: float = Field(1.0, ge=0.0, le=1.0, description="Requested cash consideration fraction")
    debt_pct: float = Field(0.0, ge=0.0, le=1.0, description="Requested new debt financing fraction")
    stock_pct: float = Field(0.0, ge=0.0, le=1.0, description="Requested stock consideration fraction")
    transaction_fees: float = Field(0.0, ge=0.0, description="Advisory & legal fees in Rs Cr")
    refinance_target_debt: bool = Field(False, description="If True, target existing debt must be repaid at closing (a Use)")
    use_target_cash: bool = Field(False, description="If True, available target balance sheet cash is swept to fund uses")
    debt_issuance_fee_pct: float = Field(0.0, ge=0.0, le=0.20, description="Underwriting/issuance fee fraction on new debt")
    minimum_cash_balance: float = Field(0.0, ge=0.0, description="Minimum post-deal cash buffer required (Rs Cr)")
    other_uses: float = Field(0.0, ge=0.0, description="Other transaction disbursements in Rs Cr")
    other_sources: float = Field(0.0, ge=0.0, description="Other funding sources in Rs Cr")
    acquirer_cash: Optional[float] = Field(None, ge=0.0, description="Explicit acquirer cash contribution override (Rs Cr)")
    new_debt: Optional[float] = Field(None, ge=0.0, description="Explicit new debt financing override (Rs Cr)")
    stock_issuance: Optional[float] = Field(None, ge=0.0, description="Explicit stock consideration override (Rs Cr)")
    target_cash_sweep: Optional[float] = Field(None, ge=0.0, description="Explicit target cash sweep override (Rs Cr)")

    @model_validator(mode="after")
    def validate_financing_mix(self) -> "SourcesUsesRequest":
        # Only validate percentage sum if explicit dollar overrides are not provided
        if self.new_debt is None and self.acquirer_cash is None and self.stock_issuance is None:
            mix_sum = self.cash_pct + self.debt_pct + self.stock_pct
            if abs(mix_sum - 1.0) > 1e-4:
                raise ValueError(
                    f"Financing mix must sum to 1.0 (100%). Got cash={self.cash_pct:.4f}, debt={self.debt_pct:.4f}, stock={self.stock_pct:.4f} (sum={mix_sum:.4f})"
                )
        return self


class SourcesUsesDetail(BaseModel):
    """Detailed itemization of transaction capital uses."""
    model_config = ConfigDict(from_attributes=True)

    purchase_equity_value: float = Field(..., description="Equity consideration paid to target shareholders (Rs Cr)")
    target_debt_refinancing: float = Field(0.0, description="Target debt repaid at close (Rs Cr)")
    transaction_fees: float = Field(0.0, description="Advisory, legal, and transaction expenses (Rs Cr)")
    debt_issuance_fees: float = Field(0.0, description="Underwriting fees incurred on newly raised debt facilities (Rs Cr)")
    other_uses: float = Field(0.0, description="Other capital uses (Rs Cr)")
    total_uses: float = Field(..., description="Total capital requirements for the transaction (Rs Cr)")


class FundingBaseDetail(BaseModel):
    """Bridge from gross capital uses to net external funding requirement."""
    model_config = ConfigDict(from_attributes=True)

    gross_uses_ex_debt_fees: float = Field(..., description="Gross uses before debt issuance underwriting fees (Rs Cr)")
    target_cash_sweep: float = Field(0.0, description="Target balance sheet cash swept to fund transaction (Rs Cr)")
    other_sources: float = Field(0.0, description="Non-mix external funding sources (Rs Cr)")
    net_funding_requirement: float = Field(..., description="Net funding required across cash, debt, and stock (Rs Cr)")


class RequestedFinancingSources(BaseModel):
    """Financing amounts derived directly from requested percentage mix."""
    model_config = ConfigDict(from_attributes=True)

    acquirer_cash: float = Field(..., description="Requested acquirer cash contribution (Rs Cr)")
    new_debt: float = Field(..., description="Requested new debt financing (Rs Cr)")
    stock_issuance: float = Field(..., description="Requested stock consideration (Rs Cr)")
    target_cash_sweep: float = Field(0.0, description="Target cash swept (Rs Cr)")
    other_sources: float = Field(0.0, description="Other funding sources (Rs Cr)")
    total_requested_sources: float = Field(..., description="Total requested capital sources (Rs Cr)")


class ExecutableFinancingSources(BaseModel):
    """Actual executable financing sources reflecting acquirer balance sheet reality."""
    model_config = ConfigDict(from_attributes=True)

    acquirer_cash: float = Field(..., description="Actual executable cash contribution capped at available balance (Rs Cr)")
    new_debt: float = Field(..., description="Actual new debt raised (Rs Cr)")
    stock_issuance: float = Field(..., description="Actual stock consideration issued (Rs Cr)")
    target_cash_sweep: float = Field(0.0, description="Target cash swept (Rs Cr)")
    other_sources: float = Field(0.0, description="Other funding sources (Rs Cr)")
    total_sources: float = Field(..., description="Total executable capital sources (Rs Cr)")


class SourcesUsesReconciliation(BaseModel):
    """Reconciliation of Sources vs Uses and feasibility audit."""
    model_config = ConfigDict(from_attributes=True)

    total_sources: float = Field(..., description="Total executable sources (Rs Cr)")
    total_uses: float = Field(..., description="Total uses of funds (Rs Cr)")
    difference: float = Field(..., description="Sources minus Uses (0.0 when balanced)")
    sources_uses_balanced: bool = Field(..., description="True if executable sources exactly fund total uses")
    is_feasible: bool = Field(..., description="True if acquirer cash required <= available balance sheet cash")
    funding_shortfall: float = Field(0.0, description="Cash deficit between requested cash and available cash (Rs Cr)")
    tolerance: float = Field(0.0001, description="Balance numerical precision tolerance")
    status: str = Field(..., description="'BALANCED & EXECUTABLE', 'INFEASIBLE: CASH SHORTFALL', or 'UNBALANCED'")


class CashReconciliationDetail(BaseModel):
    """Pre- and post-deal cash balance reconciliation for buyer and target."""
    model_config = ConfigDict(from_attributes=True)

    pre_deal_acquirer_cash: Optional[float] = Field(None, description="Acquirer cash before transaction (Rs Cr)")
    cash_required: float = Field(..., description="Acquirer cash required by financing mix (Rs Cr)")
    cash_used_in_transaction: float = Field(..., description="Actual acquirer cash disbursed (Rs Cr)")
    cash_deficit: float = Field(0.0, description="Shortfall between cash required and available cash (Rs Cr)")
    is_cash_funded: bool = Field(..., description="True if acquirer had sufficient cash to fund required cash")
    target_cash_available: Optional[float] = Field(None, description="Target cash prior to deal (Rs Cr)")
    target_cash_used: float = Field(0.0, description="Target cash swept to fund deal (Rs Cr)")
    minimum_cash_balance: float = Field(0.0, description="Minimum post-deal operating cash buffer required (Rs Cr)")
    pro_forma_acquirer_cash: Optional[float] = Field(None, description="Post-transaction acquirer cash balance (Rs Cr)")
    pro_forma_target_cash_remaining: Optional[float] = Field(None, description="Remaining target cash post-sweep (Rs Cr)")
    pro_forma_combined_cash: Optional[float] = Field(None, description="Combined pro-forma group cash balance (Rs Cr)")
    buffer_shortfall: float = Field(0.0, description="Amount by which pro-forma cash falls below minimum buffer (Rs Cr)")
    warnings: List[str] = Field(default_factory=list, description="Cash-specific diagnostics")


class SourcesUsesResponse(BaseModel):
    """Complete institutional Sources & Uses schedule response."""
    model_config = ConfigDict(from_attributes=True)

    uses: SourcesUsesDetail = Field(..., description="Itemized transaction capital uses")
    funding_base: FundingBaseDetail = Field(..., description="Gross uses, target cash sweep, and net funding requirement")
    requested_financing: RequestedFinancingSources = Field(..., description="Requested funding structure")
    sources: ExecutableFinancingSources = Field(..., description="Executable capital sources")
    reconciliation: SourcesUsesReconciliation = Field(..., description="Balance identity and feasibility status")
    cash_reconciliation: CashReconciliationDetail = Field(..., description="Pro-forma cash and liquidity reconciliation")
    warnings: List[str] = Field(default_factory=list, description="All transaction and liquidity diagnostics")
