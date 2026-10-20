"""
backend/app/schemas/scenarios.py

Pydantic schemas for Phase 9: Scenario Analysis & Sensitivity Analysis.

Strongly typed models for:
- Scenario requests, definitions, results, and comparisons
- 1D and 2D sensitivity requests and results
- Sensitivity cells with nullable values for infeasible structures
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# Scenario Schemas
# ---------------------------------------------------------------------------

class ScenarioAssumptions(BaseModel):
    """Transaction assumptions that can be overridden in a scenario."""
    model_config = ConfigDict(extra="forbid")

    acquisition_premium: Optional[float] = Field(None, description="Acquisition premium as decimal fraction")
    cash_pct: Optional[float] = Field(None, ge=0.0, le=1.0, description="Cash consideration fraction")
    debt_pct: Optional[float] = Field(None, ge=0.0, le=1.0, description="Debt financing fraction")
    stock_pct: Optional[float] = Field(None, ge=0.0, le=1.0, description="Stock consideration fraction")
    transaction_fees: Optional[float] = Field(None, ge=0.0, description="Transaction fees in Rs Cr")
    debt_issuance_fee_pct: Optional[float] = Field(None, ge=0.0, le=0.20, description="Debt issuance fee percentage")
    minimum_cash_balance: Optional[float] = Field(None, ge=0.0, description="Minimum post-deal cash balance (Rs Cr)")
    refinance_target_debt: Optional[bool] = Field(None, description="Refinance target debt at closing")
    use_target_cash: Optional[bool] = Field(None, description="Sweep target cash to fund deal")
    debt_interest_rate: Optional[float] = Field(None, ge=0.0, description="Pre-tax interest rate on new debt")
    foregone_cash_interest_rate: Optional[float] = Field(None, ge=0.0, description="Pre-tax foregone cash yield")
    tax_rate: Optional[float] = Field(None, ge=0.0, lt=1.0, description="Marginal corporate income tax rate")
    synergy_year_1: Optional[float] = Field(None, description="Year 1 pre-tax synergies (Rs Cr)")
    synergy_year_2: Optional[float] = Field(None, description="Year 2 pre-tax synergies (Rs Cr)")
    synergy_year_3: Optional[float] = Field(None, description="Year 3 pre-tax synergies (Rs Cr)")
    expected_annual_synergies: Optional[float] = Field(None, description="Steady-state annual pre-tax synergies (Rs Cr)")


class ScenarioDefinitionSchema(BaseModel):
    """Definition of a single scenario with overrides."""
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=100, description="Scenario name")
    scenario_type: str = Field("CUSTOM", description="Scenario type: BASE, UPSIDE, DOWNSIDE, or CUSTOM")
    description: str = Field("", max_length=500, description="Optional scenario description")
    overrides: ScenarioAssumptions = Field(default_factory=ScenarioAssumptions, description="Assumption overrides")


class SingleScenarioRequest(BaseModel):
    """Request to execute a single scenario for a given acquirer/target pair."""
    model_config = ConfigDict(extra="forbid")

    buyer_id: str = Field(..., description="Acquiring company identifier")
    target_id: str = Field(..., description="Target company identifier")
    base_assumptions: ScenarioAssumptions = Field(
        default_factory=ScenarioAssumptions,
        description="Base transaction assumptions (defaults used for unspecified values)",
    )
    scenario: ScenarioDefinitionSchema = Field(
        default_factory=lambda: ScenarioDefinitionSchema(name="Base Case", scenario_type="BASE"),
        description="Scenario definition with overrides",
    )


class ScenarioRequest(BaseModel):
    """Request to execute one or more scenarios for a given acquirer/target pair."""
    model_config = ConfigDict(extra="forbid")

    buyer_id: str = Field(..., description="Acquiring company identifier")
    target_id: str = Field(..., description="Target company identifier")
    base_assumptions: ScenarioAssumptions = Field(
        default_factory=ScenarioAssumptions,
        description="Base transaction assumptions (defaults used for unspecified values)",
    )
    scenarios: List[ScenarioDefinitionSchema] = Field(
        ..., min_length=1, max_length=20,
        description="Scenarios to evaluate (1-20)",
    )


# --- Result schemas ---

class ScenarioIdentity(BaseModel):
    """Scenario identity metadata."""
    name: str
    scenario_type: str
    description: str = ""


class ScenarioDealResult(BaseModel):
    """Deal-level results from a scenario execution."""
    purchase_equity_value: Optional[float] = None
    offer_price_per_share: Optional[float] = None
    transaction_enterprise_value: Optional[float] = None
    cash_amount: Optional[float] = None
    debt_amount: Optional[float] = None
    stock_amount: Optional[float] = None
    cash_pct: Optional[float] = None
    debt_pct: Optional[float] = None
    stock_pct: Optional[float] = None


class ScenarioSourcesUsesResult(BaseModel):
    """Sources & Uses results from a scenario execution."""
    total_uses: Optional[float] = None
    total_sources: Optional[float] = None
    buyer_cash: Optional[float] = None
    new_debt: Optional[float] = None
    stock_issuance: Optional[float] = None
    target_cash: Optional[float] = None
    balance: Optional[float] = None
    is_feasible: Optional[bool] = None
    pro_forma_cash: Optional[float] = None


class ScenarioYearResult(BaseModel):
    """A/D result for a single projection year."""
    eps: Optional[float] = None
    accretion_dilution_pct: Optional[float] = None
    status: Optional[str] = None
    break_even_gross_synergy: Optional[float] = None


class ScenarioADResult(BaseModel):
    """Accretion / Dilution results from a scenario execution."""
    standalone_eps: Optional[float] = None
    year_1: Optional[ScenarioYearResult] = None
    year_2: Optional[ScenarioYearResult] = None
    year_3: Optional[ScenarioYearResult] = None


class ScenarioDiagnostics(BaseModel):
    """Diagnostics for a scenario execution."""
    warnings: List[str] = Field(default_factory=list)
    is_feasible: bool = True
    is_available: bool = True
    validation_errors: Optional[List[str]] = None


class ScenarioResult(BaseModel):
    """Complete result for a single scenario execution."""
    identity: ScenarioIdentity
    assumptions: Dict[str, Any] = Field(default_factory=dict)
    deal: Optional[ScenarioDealResult] = None
    sources_uses: Optional[ScenarioSourcesUsesResult] = None
    accretion_dilution: Optional[ScenarioADResult] = None
    diagnostics: ScenarioDiagnostics = Field(default_factory=ScenarioDiagnostics)


class ScenarioComparisonResponse(BaseModel):
    """Complete scenario comparison response."""
    acquirer_id: str
    target_id: str
    scenario_count: int
    scenarios: List[ScenarioResult]


# ---------------------------------------------------------------------------
# Sensitivity Schemas
# ---------------------------------------------------------------------------

class SensitivityAxis(BaseModel):
    """Definition of a sensitivity axis (variable + values)."""
    model_config = ConfigDict(extra="forbid")

    variable: str = Field(..., description="The assumption variable to vary")
    values: List[float] = Field(
        ..., min_length=1, max_length=20,
        description="Values to evaluate (1-20)",
    )


class Sensitivity1DRequest(BaseModel):
    """Request for a 1D sensitivity analysis."""
    model_config = ConfigDict(extra="forbid")

    buyer_id: str = Field(..., description="Acquiring company identifier")
    target_id: str = Field(..., description="Target company identifier")
    base_assumptions: ScenarioAssumptions = Field(
        default_factory=ScenarioAssumptions,
        description="Base transaction assumptions",
    )
    axis: SensitivityAxis = Field(..., description="Sensitivity axis definition")
    output_metric: str = Field(..., description="Output metric to measure")


class Sensitivity2DRequest(BaseModel):
    """Request for a 2D sensitivity matrix analysis."""
    model_config = ConfigDict(extra="forbid")

    buyer_id: str = Field(..., description="Acquiring company identifier")
    target_id: str = Field(..., description="Target company identifier")
    base_assumptions: ScenarioAssumptions = Field(
        default_factory=ScenarioAssumptions,
        description="Base transaction assumptions",
    )
    x_axis: SensitivityAxis = Field(..., description="Column (X) axis definition")
    y_axis: SensitivityAxis = Field(..., description="Row (Y) axis definition")
    output_metric: str = Field(..., description="Output metric to measure")


class SensitivityCell(BaseModel):
    """A single cell in a sensitivity result."""
    value: Optional[float] = Field(None, description="Input variable value")
    x_value: Optional[float] = Field(None, description="X-axis input value (2D only)")
    y_value: Optional[float] = Field(None, description="Y-axis input value (2D only)")
    output: Optional[Union[float, bool]] = Field(None, description="Output metric value (null if infeasible/unavailable)")
    is_feasible: bool = Field(True, description="Whether the cell represents a feasible transaction")
    diagnostics: List[str] = Field(default_factory=list, description="Cell-level diagnostics")


class Sensitivity1DResponse(BaseModel):
    """Response for a 1D sensitivity analysis."""
    acquirer_id: str
    target_id: str
    variable: str
    values: List[float]
    output_metric: str
    cells: List[SensitivityCell]


class SensitivityDimensions(BaseModel):
    """Dimensions of a 2D sensitivity matrix."""
    rows: int
    columns: int
    total_cells: int


class Sensitivity2DResponse(BaseModel):
    """Response for a 2D sensitivity matrix analysis."""
    acquirer_id: str
    target_id: str
    x_variable: str
    x_values: List[float]
    y_variable: str
    y_values: List[float]
    output_metric: str
    matrix: List[List[SensitivityCell]]
    dimensions: SensitivityDimensions
