"""
backend/app/api/v1/scenarios.py

API router for Phase 9: Scenario Analysis & Sensitivity Analysis.

Endpoints:
- POST /api/v1/deals/scenarios          — Execute multiple scenarios
- POST /api/v1/deals/sensitivity/1d     — 1D sensitivity analysis
- POST /api/v1/deals/sensitivity/2d     — 2D sensitivity matrix analysis
"""

from fastapi import APIRouter, Depends

from backend.app.api.deps import get_scenario_service
from backend.app.schemas.scenarios import (
    ScenarioComparisonResponse,
    ScenarioRequest,
    ScenarioResult,
    SingleScenarioRequest,
    Sensitivity1DRequest,
    Sensitivity1DResponse,
    Sensitivity2DRequest,
    Sensitivity2DResponse,
)
from backend.app.services.scenario_service import ScenarioService

router = APIRouter()


@router.post(
    "/scenario",
    response_model=ScenarioResult,
    summary="Execute Single Scenario",
    description=(
        "Evaluate a single transaction scenario through the deterministic Deal Builder → "
        "Sources & Uses → Accretion/Dilution pipeline."
    ),
)
async def run_single_scenario(
    request: SingleScenarioRequest,
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioResult:
    return scenario_service.run_single_scenario(request)


@router.post(
    "/scenarios",
    response_model=ScenarioComparisonResponse,
    summary="Execute Scenario Analysis",
    description=(
        "Evaluate multiple transaction assumption sets (Base, Upside, Downside, Custom) "
        "through the existing deterministic Deal Builder → Sources & Uses → "
        "Accretion/Dilution pipeline. Each scenario overrides only the explicitly "
        "specified assumptions; all others remain identical to the base case."
    ),
)
async def run_scenarios(
    request: ScenarioRequest,
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioComparisonResponse:
    return scenario_service.run_scenarios(request)


@router.post(
    "/scenarios/compare",
    response_model=ScenarioComparisonResponse,
    summary="Compare Multiple Scenarios",
    description=(
        "Alias for /scenarios. Evaluate multiple transaction assumption sets (Base, Upside, "
        "Downside, Custom) and compare results across the deterministic pipeline."
    ),
)
async def compare_scenarios(
    request: ScenarioRequest,
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> ScenarioComparisonResponse:
    return scenario_service.run_scenarios(request)


@router.post(
    "/sensitivity/1d",
    response_model=Sensitivity1DResponse,
    summary="1D Sensitivity Analysis",
    description=(
        "Evaluate one assumption variable across multiple values, executing "
        "the complete deterministic transaction pipeline for each. Returns the "
        "requested output metric for every value, preserving infeasible cells "
        "as null outputs."
    ),
)
async def run_sensitivity_1d(
    request: Sensitivity1DRequest,
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> Sensitivity1DResponse:
    return scenario_service.run_sensitivity_1d(request)


@router.post(
    "/sensitivity/2d",
    response_model=Sensitivity2DResponse,
    summary="2D Sensitivity Matrix Analysis",
    description=(
        "Evaluate a matrix of two assumption variables, executing the complete "
        "deterministic transaction pipeline for each cell. Each cell clones base "
        "assumptions, applies both axis overrides, validates, and executes the "
        "pipeline. Infeasible cells are preserved with null output values."
    ),
)
async def run_sensitivity_2d(
    request: Sensitivity2DRequest,
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> Sensitivity2DResponse:
    return scenario_service.run_sensitivity_2d(request)
