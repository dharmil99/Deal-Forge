"""
backend/app/ai/embeddings/base.py

Abstract base class for DealForge embedding providers.
Ensures provider-agnostic embedding generation across Ollama, Gemini, and future providers.
"""

from abc import ABC, abstractmethod
from typing import List

from backend.app.ai.schemas import ProviderHealthStatus


class EmbeddingError(Exception):
    """Base exception for embedding failures."""
    pass


class EmbeddingProviderUnavailableError(EmbeddingError):
    """Raised when the embedding provider service/host cannot be reached."""
    pass


class EmbeddingAuthError(EmbeddingError):
    """Raised when authentication/API key credentials fail."""
    pass


class EmbeddingModelError(EmbeddingError):
    """Raised when the requested model is not found or unsupported."""
    pass


class EmbeddingDimensionError(EmbeddingError):
    """Raised when the actual returned vector dimension differs from the configured dimension."""
    pass


class EmbeddingProvider(ABC):
    """Abstract interface defining the embedding provider contract."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the embedding provider (e.g., 'ollama', 'gemini')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Name of the underlying embedding model."""
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Vector output dimension for the configured model."""
        pass

    @abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        """Generate a single embedding vector for the provided text."""
        pass

    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for a batch of text strings."""
        pass

    @abstractmethod
    async def check_health(self) -> ProviderHealthStatus:
        """Perform a liveness and availability check for the provider."""
        pass
