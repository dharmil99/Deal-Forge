"""
backend/app/ai/config.py

Centralized configuration for DealForge Phase AI-1: RAG Research Pilot Foundation.
Uses environment variables with sensible local defaults.
Never exposes credentials or secrets in logs or string representations.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Workspace root directory: dealforge/
_WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_DOCS_DIR = _WORKSPACE_ROOT / "docs"


class AIConfig(BaseSettings):
    """Configuration for AI and RAG subsystem."""

    # RAG Subsystem Toggle
    rag_enabled: bool = Field(default=True, description="Enable or disable RAG functionality")

    # Active Embedding Provider & Model
    rag_embedding_provider: str = Field(
        default="ollama",
        description="Active embedding provider: 'ollama' or 'gemini'"
    )
    rag_embedding_model: str = Field(
        default="nomic-embed-text",
        description="Embedding model name used with active provider"
    )

    # Local Ollama Provider Settings
    ollama_base_url: str = Field(
        default="http://localhost:11434",
        description="Base URL for local Ollama service"
    )

    # Gemini Embedding Provider Settings
    gemini_api_key: Optional[str] = Field(
        default=None,
        description="Google Gemini API key for remote embeddings (never hardcoded)"
    )
    gemini_embedding_model: str = Field(
        default="gemini-embedding-2",
        description="Gemini embedding model name (e.g. 'gemini-embedding-2')"
    )
    gemini_embedding_dimension: int = Field(
        default=3072,
        ge=128,
        le=3072,
        description="Expected Gemini vector dimension (defaults to 3072 for gemini-embedding-2; supports 768, 1536, 3072)"
    )

    # Qdrant Vector Database Settings
    qdrant_url: str = Field(
        default="http://localhost:6333",
        description="URL for Qdrant vector database (use ':memory:' for isolated testing)"
    )
    qdrant_collection: str = Field(
        default="dealforge_methodology",
        description="Target Qdrant vector collection name"
    )
    qdrant_api_key: Optional[str] = Field(
        default=None,
        description="Optional Qdrant Cloud or API authentication key"
    )

    # Chunking Strategy Settings
    chunk_size: int = Field(
        default=800,
        ge=200,
        le=4000,
        description="Target character size for text chunks"
    )
    chunk_overlap: int = Field(
        default=100,
        ge=0,
        le=1000,
        description="Character overlap between consecutive chunks"
    )

    # Documentation Directory
    docs_dir: Path = Field(
        default=_DEFAULT_DOCS_DIR,
        description="Directory containing trusted DealForge methodology documents"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def sanitized_dict(self) -> dict:
        """Return configuration dictionary with secrets masked for safe diagnostics."""
        return {
            "rag_enabled": self.rag_enabled,
            "rag_embedding_provider": self.rag_embedding_provider,
            "rag_embedding_model": self.rag_embedding_model,
            "ollama_base_url": self.ollama_base_url,
            "gemini_api_key_configured": bool(self.gemini_api_key),
            "gemini_embedding_model": self.gemini_embedding_model,
            "gemini_embedding_dimension": self.gemini_embedding_dimension,
            "qdrant_url": self.qdrant_url,
            "qdrant_collection": self.qdrant_collection,
            "qdrant_api_key_configured": bool(self.qdrant_api_key),
            "chunk_size": self.chunk_size,
            "chunk_overlap": self.chunk_overlap,
        }


@lru_cache()
def get_ai_config() -> AIConfig:
    """Return cached AIConfig singleton."""
    return AIConfig()
