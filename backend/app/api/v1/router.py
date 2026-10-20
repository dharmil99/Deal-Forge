"""
backend/app/api/v1/router.py

Central API router for version 1 of the DealForge API.
Mounts all v1 domain routers and provides versioned health checks.
"""

from fastapi import APIRouter, Depends

from backend.app.api.v1.companies import router as companies_router
from backend.app.api.v1.deals import router as deals_router
from backend.app.api.v1.scenarios import router as scenarios_router
from backend.app.api.v1.screening import router as screening_router
from backend.app.core.config import Settings, get_settings
from backend.app.schemas.common import HealthResponse

api_v1_router = APIRouter()

api_v1_router.include_router(companies_router, prefix="/companies", tags=["Companies"])
api_v1_router.include_router(screening_router, prefix="/screening", tags=["Screening"])
api_v1_router.include_router(deals_router, prefix="/deals", tags=["Deals"])
api_v1_router.include_router(scenarios_router, prefix="/deals", tags=["Scenarios & Sensitivity"])


@api_v1_router.get(
    "/health",
    response_model=HealthResponse,
    summary="API v1 Health Check",
    tags=["System"],
)
async def v1_health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Return health status of API v1."""
    return HealthResponse(
        status="ok",
        service="dealforge-api",
        version=settings.api_version,
        environment=settings.environment,
    )
