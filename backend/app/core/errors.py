"""
backend/app/core/errors.py

Global exception classes and error handlers for the DealForge API.
Ensures standardized ErrorResponse JSON payloads and shields internal stack traces.
"""

import logging
from typing import Any, List
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.schemas.common import ErrorDetail, ErrorResponse

logger = logging.getLogger("dealforge.errors")


# -----------------------------------------------------------------------------
# Domain Exceptions
# -----------------------------------------------------------------------------

class DealForgeError(Exception):
    """Base exception for all DealForge domain errors."""

    def __init__(self, message: str, code: str = "DEALFORGE_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code


class EntityNotFoundError(DealForgeError):
    """Raised when a requested business entity or resource is not found."""

    def __init__(self, message: str = "Requested resource not found", code: str = "RESOURCE_NOT_FOUND"):
        super().__init__(message=message, code=code)


class DatasetNotFoundError(DealForgeError):
    """Raised when an underlying data file is missing from disk."""

    def __init__(self, dataset_name: str, path: str):
        message = f"Dataset '{dataset_name}' not found at: {path}"
        super().__init__(message=message, code="DATASET_NOT_FOUND")
        self.dataset_name = dataset_name
        self.path = path


class InvalidInputError(DealForgeError):
    """Raised when user or calculation input violates domain constraints."""

    def __init__(self, message: str, code: str = "INVALID_INPUT"):
        super().__init__(message=message, code=code)


# -----------------------------------------------------------------------------
# Exception Handlers
# -----------------------------------------------------------------------------

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle FastAPI / Pydantic request validation errors."""
    details: List[ErrorDetail] = []
    for err in exc.errors():
        details.append(
            ErrorDetail(
                loc=list(err.get("loc", [])),
                msg=str(err.get("msg", "Invalid value")),
                type=str(err.get("type", "value_error")),
            )
        )

    response_payload = ErrorResponse(
        status="error",
        message="Request validation failed",
        details=details,
        code="VALIDATION_ERROR",
    )
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=response_payload.model_dump(),
    )


async def entity_not_found_handler(request: Request, exc: EntityNotFoundError) -> JSONResponse:
    """Handle missing entity/resource errors."""
    response_payload = ErrorResponse(
        status="error",
        message=exc.message,
        code=exc.code,
    )
    logger.warning("Resource not found: %s", exc.message)
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=response_payload.model_dump(),
    )


async def dataset_not_found_handler(request: Request, exc: DatasetNotFoundError) -> JSONResponse:
    """Handle missing CSV dataset errors."""
    response_payload = ErrorResponse(
        status="error",
        message=exc.message,
        code=exc.code,
    )
    logger.error("Dataset missing: %s", exc.message)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_payload.model_dump(),
    )


async def invalid_input_handler(request: Request, exc: InvalidInputError) -> JSONResponse:
    """Handle domain input constraint errors."""
    response_payload = ErrorResponse(
        status="error",
        message=exc.message,
        code=exc.code,
    )
    logger.warning("Invalid domain input: %s", exc.message)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=response_payload.model_dump(),
    )


async def dealforge_error_handler(request: Request, exc: DealForgeError) -> JSONResponse:
    """Handle generic DealForge domain errors."""
    response_payload = ErrorResponse(
        status="error",
        message=exc.message,
        code=exc.code,
    )
    logger.error("DealForge error: %s", exc.message)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=response_payload.model_dump(),
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle standard Starlette / FastAPI HTTPExceptions."""
    response_payload = ErrorResponse(
        status="error",
        message=str(exc.detail),
        code=f"HTTP_{exc.status_code}",
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=response_payload.model_dump(),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected internal exceptions, shielding internal stack traces."""
    logger.exception("Unhandled server exception on %s %s: %s", request.method, request.url.path, str(exc))
    response_payload = ErrorResponse(
        status="error",
        message="An unexpected internal server error occurred.",
        code="INTERNAL_SERVER_ERROR",
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_payload.model_dump(),
    )


def setup_error_handlers(app: FastAPI) -> None:
    """Register all custom and global exception handlers on the FastAPI application."""
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(EntityNotFoundError, entity_not_found_handler)
    app.add_exception_handler(DatasetNotFoundError, dataset_not_found_handler)
    app.add_exception_handler(InvalidInputError, invalid_input_handler)
    app.add_exception_handler(DealForgeError, dealforge_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
