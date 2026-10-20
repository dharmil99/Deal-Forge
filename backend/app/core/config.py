"""
backend/app/core/config.py

DealForge application configuration using Pydantic Settings.
Provides sensible local defaults so the application runs without any .env file.
"""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


# Project root directory: dealforge/
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_DATA_DIR = _PROJECT_ROOT / "data"


class Settings(BaseSettings):
    """DealForge application settings."""

    # Application Information
    app_name: str = "DealForge API"
    api_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = False

    # Data Directory (defaults to project_root/data)
    data_dir: Path = _DEFAULT_DATA_DIR

    # CORS Origins
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_prefix="DEALFORGE_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
