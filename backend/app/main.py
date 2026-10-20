"""
backend/app/main.py

Main entry point for DealForge FastAPI application.
Configures CORS, global error handling, logging, and versioned routing.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.v1.router import api_v1_router
from backend.app.core.config import Settings, get_settings
from backend.app.core.errors import setup_error_handlers
from backend.app.core.logging import configure_logging
from backend.app.schemas.common import HealthResponse


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory for DealForge API."""
    if settings is None:
        settings = get_settings()

    # Configure local structured logging
    configure_logging()

    app = FastAPI(
        title=settings.app_name,
        version=settings.api_version,
        description="DealForge M&A Intelligence & Transaction Modeling API",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # CORS configuration for local frontend development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Setup standardized error handling
    setup_error_handlers(app)

    # Root health endpoint
    @app.get(
        "/health",
        response_model=HealthResponse,
        summary="Service Health Check",
        tags=["System"],
    )
    async def health_check() -> HealthResponse:
        """Root health check returning service status."""
        return HealthResponse(
            status="ok",
            service="dealforge-api",
            version=settings.api_version,
            environment=settings.environment,
        )

    # Mount versioned API router
    app.include_router(api_v1_router, prefix=settings.api_v1_prefix)

    return app


# Module-level ASGI instance for Uvicorn
app = create_app()
