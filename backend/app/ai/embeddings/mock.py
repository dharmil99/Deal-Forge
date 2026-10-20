"""
backend/app/ai/embeddings/mock.py

Deterministic mock embedding provider for DealForge Phase AI-1 testing and offline pilot verification.
Generates stable, pseudo-semantic normalized vectors without any network calls.
"""

import hashlib
import math
from typing import List

from backend.app.ai.embeddings.base import EmbeddingProvider
from backend.app.ai.schemas import ProviderHealthStatus


class MockEmbeddingProvider(EmbeddingProvider):
    """Deterministic, hermetic mock embedding provider for testing and validation."""

    def __init__(self, model_name: str = "mock-dealforge-embed", dimension: int = 64) -> None:
        self._model_name = model_name
        self._dimension = dimension

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimension(self) -> int:
        return self._dimension

    def _generate_vector(self, text: str) -> List[float]:
        """Generate a deterministic normalized vector based on word hashes."""
        vec = [0.0] * self._dimension
        import re
        words = re.findall(r"\w+", text.lower())
        if not words:
            return vec

        for word in words:
            # Hash each word into multiple buckets
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = h % self._dimension
            weight = ((h >> 8) % 100) / 100.0 + 0.1
            vec[idx] += weight

        # Normalize to unit length (L2 norm)
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]

        return vec

    async def embed_text(self, text: str) -> List[float]:
        return self._generate_vector(text)

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(t) for t in texts]

    async def check_health(self) -> ProviderHealthStatus:
        return ProviderHealthStatus(
            provider=self.provider_name,
            model=self.model_name,
            available=True,
            dimension=self.dimension,
            error_message=None,
        )
