"""
backend/app/api/v1/screening.py

API router for M&A acquisition target screening.
Directly maps to analytics/screening.py.
"""

from fastapi import APIRouter, Depends

from backend.app.api.deps import get_screening_service
from backend.app.schemas.screening import ScreeningRequest, ScreeningResponse
from backend.app.services.screening_service import ScreeningService

router = APIRouter()


@router.post(
    "",
    response_model=ScreeningResponse,
    summary="Screen Acquisition Targets",
    description="Filter and rank company universe by financial performance, valuation, and leverage criteria using analytics/screening.py.",
)
async def screen_targets(
    request: ScreeningRequest,
    screening_service: ScreeningService = Depends(get_screening_service),
) -> ScreeningResponse:
    return screening_service.run_screening(request)
