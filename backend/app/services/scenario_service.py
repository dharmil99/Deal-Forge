"""
backend/app/services/scenario_service.py

Service layer orchestrating Phase 9: Scenario Analysis & Sensitivity Analysis.

This is a thin orchestration layer. All financial calculations are performed
by the existing deterministic analytics engine (deal_model → sources_uses →
accretion_dilution). No financial formulas are duplicated here.
"""

import logging
from typing import Any, Dict, List

from analytics.scenarios import (
    DEFAULT_ASSUMPTIONS,
    SUPPORTED_ASSUMPTIONS,
    SUPPORTED_OUTPUT_METRICS,
    SUPPORTED_SENSITIVITY_VARIABLES,
    ScenarioDefinition,
    execute_scenario,
    extract_scenario_result,
    resolve_assumptions,
    run_scenarios,
    run_sensitivity_1d,
    run_sensitivity_2d,
    validate_assumptions,
)
from backend.app.core.errors import EntityNotFoundError, InvalidInputError
from backend.app.schemas.scenarios import (
    ScenarioADResult,
    ScenarioAssumptions,
    ScenarioComparisonResponse,
    ScenarioDealResult,
    ScenarioDiagnostics,
    ScenarioIdentity,
    ScenarioRequest,
    ScenarioResult,
    SingleScenarioRequest,
    ScenarioSourcesUsesResult,
    ScenarioYearResult,
    Sensitivity1DRequest,
    Sensitivity1DResponse,
    Sensitivity2DRequest,
    Sensitivity2DResponse,
    SensitivityCell,
    SensitivityDimensions,
)
from backend.app.services.company_service import CompanyService
from backend.app.services.dataset_service import DatasetService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.scenario")


class ScenarioService:
    """
    Service providing scenario analysis and sensitivity analysis.

    Orchestrates multiple invocations of the existing deterministic pipeline
    across different assumption sets. Never calculates financial metrics
    independently.
    """

    def __init__(
        self,
        dataset_service: DatasetService,
        company_service: CompanyService,
    ) -> None:
        self.dataset_service = dataset_service
        self.company_service = company_service

    def _resolve_base_assumptions(self, schema: ScenarioAssumptions) -> Dict[str, Any]:
        """Convert a ScenarioAssumptions schema to a resolved dict, merging with defaults."""
        base = dict(DEFAULT_ASSUMPTIONS)
        overrides = schema.model_dump(exclude_none=True)
        for key, value in overrides.items():
            if key in SUPPORTED_ASSUMPTIONS:
                base[key] = value
        return base

    def _overrides_from_schema(self, schema: ScenarioAssumptions) -> Dict[str, Any]:
        """Extract only the explicitly set overrides from a schema."""
        return {k: v for k, v in schema.model_dump().items() if v is not None and k in SUPPORTED_ASSUMPTIONS}

    def _build_scenario_result(self, raw: Dict[str, Any]) -> ScenarioResult:
        """Convert a raw analytics result dict into a typed ScenarioResult."""
        cleaned = clean_nan(raw)

        identity_data = cleaned.get("identity", {})
        if isinstance(identity_data, dict):
            identity = ScenarioIdentity(**identity_data)
        else:
            identity = ScenarioIdentity(name="Unknown", scenario_type="CUSTOM")

        # Diagnostics
        diag_data = cleaned.get("diagnostics", {})
        if isinstance(diag_data, dict):
            diagnostics = ScenarioDiagnostics(**diag_data)
        else:
            diagnostics = ScenarioDiagnostics()

        # Deal
        deal_data = cleaned.get("deal")
        deal_result = None
        if deal_data and isinstance(deal_data, dict):
            deal_result = ScenarioDealResult(**deal_data)

        # Sources & Uses
        su_data = cleaned.get("sources_uses")
        su_result = None
        if su_data and isinstance(su_data, dict):
            su_result = ScenarioSourcesUsesResult(**su_data)

        # A/D
        ad_data = cleaned.get("accretion_dilution")
        ad_result = None
        if ad_data and isinstance(ad_data, dict):
            year_1 = ad_data.get("year_1")
            year_2 = ad_data.get("year_2")
            year_3 = ad_data.get("year_3")
            ad_result = ScenarioADResult(
                standalone_eps=ad_data.get("standalone_eps"),
                year_1=ScenarioYearResult(**year_1) if year_1 and isinstance(year_1, dict) else None,
                year_2=ScenarioYearResult(**year_2) if year_2 and isinstance(year_2, dict) else None,
                year_3=ScenarioYearResult(**year_3) if year_3 and isinstance(year_3, dict) else None,
            )

        return ScenarioResult(
            identity=identity,
            assumptions=cleaned.get("assumptions", {}),
            deal=deal_result,
            sources_uses=su_result,
            accretion_dilution=ad_result,
            diagnostics=diagnostics,
        )

    def run_single_scenario(self, request: SingleScenarioRequest) -> ScenarioResult:
        """Execute a single scenario and return a typed ScenarioResult."""
        buyer_id = self.company_service.resolve_company_id(request.buyer_id)
        target_id = self.company_service.resolve_company_id(request.target_id)

        metrics = self.dataset_service.get_metrics()
        financials = self.dataset_service.get_financials()

        base = self._resolve_base_assumptions(request.base_assumptions)
        overrides = self._overrides_from_schema(request.scenario.overrides)
        resolved = resolve_assumptions(base, overrides)
        validation_errors = validate_assumptions(resolved)

        scenario_def = ScenarioDefinition(
            name=request.scenario.name,
            scenario_type=request.scenario.scenario_type,
            description=request.scenario.description,
            overrides=overrides,
        )

        if validation_errors:
            raw_result = {
                "identity": scenario_def.to_dict(),
                "assumptions": {
                    "effective": resolved,
                    "overrides": overrides,
                },
                "deal": None,
                "sources_uses": None,
                "accretion_dilution": None,
                "diagnostics": {
                    "warnings": validation_errors,
                    "is_feasible": False,
                    "is_available": False,
                    "validation_errors": validation_errors,
                },
            }
        else:
            try:
                pipeline_result = execute_scenario(
                    acquirer_id=buyer_id,
                    target_id=target_id,
                    metrics_df=metrics,
                    financials_df=financials,
                    assumptions=resolved,
                )
                raw_result = extract_scenario_result(scenario_def, resolved, pipeline_result)
            except ValueError as exc:
                raise InvalidInputError(str(exc))

        return self._build_scenario_result(raw_result)

    def run_scenarios(self, request: ScenarioRequest) -> ScenarioComparisonResponse:
        """Execute multiple scenarios and return a comparison response."""
        buyer_id = self.company_service.resolve_company_id(request.buyer_id)
        target_id = self.company_service.resolve_company_id(request.target_id)

        metrics = self.dataset_service.get_metrics()
        financials = self.dataset_service.get_financials()

        base = self._resolve_base_assumptions(request.base_assumptions)

        scenarios = []
        for s in request.scenarios:
            overrides = self._overrides_from_schema(s.overrides)
            scenarios.append(
                ScenarioDefinition(
                    name=s.name,
                    scenario_type=s.scenario_type,
                    description=s.description,
                    overrides=overrides,
                )
            )

        try:
            raw_result = run_scenarios(
                acquirer_id=buyer_id,
                target_id=target_id,
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=base,
                scenarios=scenarios,
            )
        except ValueError as exc:
            raise InvalidInputError(str(exc))

        # Convert raw results to typed responses
        typed_scenarios = []
        for raw_scenario in raw_result.get("scenarios", []):
            typed_scenarios.append(self._build_scenario_result(raw_scenario))

        return ScenarioComparisonResponse(
            acquirer_id=buyer_id,
            target_id=target_id,
            scenario_count=len(typed_scenarios),
            scenarios=typed_scenarios,
        )

    def run_sensitivity_1d(self, request: Sensitivity1DRequest) -> Sensitivity1DResponse:
        """Execute a 1D sensitivity analysis."""
        buyer_id = self.company_service.resolve_company_id(request.buyer_id)
        target_id = self.company_service.resolve_company_id(request.target_id)

        metrics = self.dataset_service.get_metrics()
        financials = self.dataset_service.get_financials()

        base = self._resolve_base_assumptions(request.base_assumptions)

        try:
            raw_result = run_sensitivity_1d(
                acquirer_id=buyer_id,
                target_id=target_id,
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=base,
                variable=request.axis.variable,
                values=request.axis.values,
                output_metric=request.output_metric,
            )
        except ValueError as exc:
            raise InvalidInputError(str(exc))

        cleaned = clean_nan(raw_result)

        cells = []
        for cell_data in cleaned.get("cells", []):
            cells.append(SensitivityCell(
                value=cell_data.get("value"),
                output=cell_data.get("output"),
                is_feasible=cell_data.get("is_feasible", True),
                diagnostics=cell_data.get("diagnostics", []),
            ))

        return Sensitivity1DResponse(
            acquirer_id=buyer_id,
            target_id=target_id,
            variable=cleaned["variable"],
            values=cleaned["values"],
            output_metric=cleaned["output_metric"],
            cells=cells,
        )

    def run_sensitivity_2d(self, request: Sensitivity2DRequest) -> Sensitivity2DResponse:
        """Execute a 2D sensitivity matrix analysis."""
        buyer_id = self.company_service.resolve_company_id(request.buyer_id)
        target_id = self.company_service.resolve_company_id(request.target_id)

        metrics = self.dataset_service.get_metrics()
        financials = self.dataset_service.get_financials()

        base = self._resolve_base_assumptions(request.base_assumptions)

        try:
            raw_result = run_sensitivity_2d(
                acquirer_id=buyer_id,
                target_id=target_id,
                metrics_df=metrics,
                financials_df=financials,
                base_assumptions=base,
                x_variable=request.x_axis.variable,
                x_values=request.x_axis.values,
                y_variable=request.y_axis.variable,
                y_values=request.y_axis.values,
                output_metric=request.output_metric,
            )
        except ValueError as exc:
            raise InvalidInputError(str(exc))

        cleaned = clean_nan(raw_result)

        matrix = []
        for row_data in cleaned.get("matrix", []):
            row = []
            for cell_data in row_data:
                row.append(SensitivityCell(
                    x_value=cell_data.get("x_value"),
                    y_value=cell_data.get("y_value"),
                    output=cell_data.get("output"),
                    is_feasible=cell_data.get("is_feasible", True),
                    diagnostics=cell_data.get("diagnostics", []),
                ))
            matrix.append(row)

        dims = cleaned.get("dimensions", {})

        return Sensitivity2DResponse(
            acquirer_id=buyer_id,
            target_id=target_id,
            x_variable=cleaned["x_variable"],
            x_values=cleaned["x_values"],
            y_variable=cleaned["y_variable"],
            y_values=cleaned["y_values"],
            output_metric=cleaned["output_metric"],
            matrix=matrix,
            dimensions=SensitivityDimensions(**dims),
        )
