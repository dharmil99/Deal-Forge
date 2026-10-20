"""
backend/app/api/v1/deals.py

API router for Deal Workspace:
- POST /api/v1/deals
- POST /api/v1/deals/sources-uses
- POST /api/v1/deals/accretion-dilution
"""

from fastapi import APIRouter, Depends

from backend.app.api.deps import (
    get_accretion_dilution_service,
    get_deal_service,
    get_sources_uses_service,
)
from backend.app.schemas.accretion_dilution import (
    AccretionDilutionRequest,
    AccretionDilutionResponse,
)
from backend.app.schemas.deal import DealCreateRequest, DealResponse
from backend.app.schemas.sources_uses import SourcesUsesRequest, SourcesUsesResponse
from backend.app.services.accretion_dilution_service import AccretionDilutionService
from backend.app.services.deal_service import DealService
from backend.app.services.sources_uses_service import SourcesUsesService

router = APIRouter()


@router.post(
    "",
    response_model=DealResponse,
    summary="Construct Deal Model",
    description="Calculate acquisition pricing, transaction TEV, financing mix, and cost synergies using analytics/deal_model.py.",
)
async def create_deal(
    request: DealCreateRequest,
    deal_service: DealService = Depends(get_deal_service),
) -> DealResponse:
    return deal_service.build_deal(request)


@router.post(
    "/sources-uses",
    response_model=SourcesUsesResponse,
    summary="Construct Sources & Uses Schedule",
    description="Construct institutional Sources & Uses schedule, debt refinancing, cash sweep, and balance audit using analytics/sources_uses.py.",
)
async def create_sources_and_uses(
    request: SourcesUsesRequest,
    sources_uses_service: SourcesUsesService = Depends(get_sources_uses_service),
) -> SourcesUsesResponse:
    return sources_uses_service.build_sources_and_uses(request)


@router.post(
    "/accretion-dilution",
    response_model=AccretionDilutionResponse,
    summary="Execute Accretion / Dilution Analysis",
    description="Calculate Year 1-3 pro-forma EPS, accretion/dilution percentage, and break-even synergies using analytics/accretion_dilution.py.",
)
async def create_accretion_dilution(
    request: AccretionDilutionRequest,
    accretion_dilution_service: AccretionDilutionService = Depends(get_accretion_dilution_service),
) -> AccretionDilutionResponse:
    return accretion_dilution_service.calculate_accretion_dilution(request)
