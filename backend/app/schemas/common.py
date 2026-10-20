"""
backend/app/schemas/common.py

Common Pydantic models for health checks, warnings, and structured API error responses.
"""

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str = Field(default="ok", description="Service health status")
    service: str = Field(default="dealforge-api", description="Service name")
    version: str = Field(..., description="API version")
    environment: str = Field(..., description="Active runtime environment")


class ErrorDetail(BaseModel):
    """Fine-grained error detail element."""

    loc: Optional[List[str | int]] = Field(default=None, description="Location of the error")
    msg: str = Field(..., description="Descriptive error message")
    type: Optional[str] = Field(default=None, description="Error type code")


class ErrorResponse(BaseModel):
    """Standardized API error response payload."""

    status: str = Field(default="error", description="Error response indicator")
    message: str = Field(..., description="High-level error explanation")
    details: Optional[List[ErrorDetail]] = Field(
        default=None, description="Optional granular validation or field error details"
    )
    code: Optional[str] = Field(
        default=None, description="Domain-specific error code"
    )


class WarningMessage(BaseModel):
    """Standardized analytical or data-quality warning."""

    code: str = Field(..., description="Warning identifier code")
    message: str = Field(..., description="Warning descriptive message")
    severity: str = Field(default="warning", description="Severity level: info, warning, caution")
