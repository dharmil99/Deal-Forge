"""
backend/app/ai/embeddings/__init__.py

Package entry point and factory for DealForge embedding providers.
"""

from typing import Optional

from backend.app.ai.config import AIConfig, get_ai_config
from backend.app.ai.embeddings.base import (
    EmbeddingAuthError,
    EmbeddingDimensionError,
    EmbeddingError,
    EmbeddingModelError,
    EmbeddingProvider,
    EmbeddingProviderUnavailableError,
)
from backend.app.ai.embeddings.gemini import GeminiEmbeddingProvider
from backend.app.ai.embeddings.mock import MockEmbeddingProvider
from backend.app.ai.embeddings.ollama import OllamaEmbeddingProvider

__all__ = [
    "EmbeddingProvider",
    "EmbeddingError",
    "EmbeddingProviderUnavailableError",
    "EmbeddingAuthError",
    "EmbeddingModelError",
    "EmbeddingDimensionError",
    "OllamaEmbeddingProvider",
    "GeminiEmbeddingProvider",
    "MockEmbeddingProvider",
    "get_embedding_provider",
]


def get_embedding_provider(
    provider_name: Optional[str] = None,
    config: Optional[AIConfig] = None,
) -> EmbeddingProvider:
    """
    Factory function instantiating the requested or configured embedding provider.
    Supported: 'ollama', 'gemini', 'mock'.
    """
    cfg = config or get_ai_config()
    target_provider = (provider_name or cfg.rag_embedding_provider).lower().strip()

    if target_provider == "ollama":
        return OllamaEmbeddingProvider(
            base_url=cfg.ollama_base_url,
            model_name=cfg.rag_embedding_model,
        )
    elif target_provider == "gemini":
        return GeminiEmbeddingProvider(
            api_key=cfg.gemini_api_key,
            model_name=cfg.gemini_embedding_model,
            dimension=cfg.gemini_embedding_dimension,
        )
    elif target_provider == "mock":
        return MockEmbeddingProvider()
    else:
        raise ValueError(
            f"Unsupported embedding provider '{target_provider}'. Supported: 'ollama', 'gemini', 'mock'."
        )
