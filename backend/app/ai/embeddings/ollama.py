"""
backend/app/ai/embeddings/ollama.py

Local Ollama embedding provider for DealForge Phase AI-1: RAG Research Pilot Foundation.
Interacts with the local Ollama daemon via asynchronous HTTP.
"""

import logging
from typing import List, Optional
import httpx

from backend.app.ai.embeddings.base import (
    EmbeddingDimensionError,
    EmbeddingError,
    EmbeddingModelError,
    EmbeddingProvider,
    EmbeddingProviderUnavailableError,
)
from backend.app.ai.schemas import ProviderHealthStatus

logger = logging.getLogger("dealforge.ai.embeddings.ollama")


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Local embedding provider utilizing an Ollama instance."""

    # Known dimensions for common Ollama models
    KNOWN_DIMENSIONS = {
        "nomic-embed-text": 768,
        "mxbai-embed-large": 1024,
        "all-minilm": 384,
        "bge-small": 384,
        "bge-large": 1024,
    }

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model_name: str = "nomic-embed-text",
        dimension: Optional[int] = None,
        timeout: float = 15.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model_name = model_name
        self._timeout = timeout
        self._dimension = dimension or self.KNOWN_DIMENSIONS.get(model_name, 768)

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed_text(self, text: str) -> List[float]:
        """Embed a single text string via modern Ollama /api/embed API."""
        if not text or not text.strip():
            raise EmbeddingError("Cannot embed empty text.")

        url = f"{self._base_url}/api/embed"
        payload = {"model": self._model_name, "input": text}

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=payload)
        except httpx.ConnectError as e:
            raise EmbeddingProviderUnavailableError(
                f"Ollama service unavailable at {self._base_url}: Connection refused"
            ) from e
        except httpx.TimeoutException as e:
            raise EmbeddingProviderUnavailableError(
                f"Ollama embedding request timed out after {self._timeout}s"
            ) from e
        except Exception as e:
            raise EmbeddingProviderUnavailableError(
                f"Ollama communication error: {e}"
            ) from e

        if resp.status_code == 404:
            raise EmbeddingModelError(
                f"Ollama model '{self._model_name}' not found. Run 'ollama pull {self._model_name}'."
            )
        elif resp.status_code != 200:
            raise EmbeddingError(
                f"Ollama API returned HTTP {resp.status_code}: {resp.text}"
            )

        data = resp.json()
        embeddings = data.get("embeddings")
        if not embeddings or not isinstance(embeddings, list) or len(embeddings) == 0:
            raise EmbeddingError("Ollama response did not contain an 'embeddings' list.")

        vec = embeddings[0]
        actual_dim = len(vec)
        if actual_dim != self._dimension:
            raise EmbeddingDimensionError(
                f"Ollama API returned vector dimension {actual_dim}, but expected configured dimension {self._dimension}. "
                f"Dimension mismatch detected. Configured dimension will not be mutated."
            )

        return vec

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed a batch of text strings via modern Ollama /api/embed API."""
        if not texts:
            return []

        url = f"{self._base_url}/api/embed"
        payload = {"model": self._model_name, "input": texts}

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=payload)
        except httpx.ConnectError as e:
            raise EmbeddingProviderUnavailableError(
                f"Ollama service unavailable at {self._base_url}: Connection refused"
            ) from e
        except httpx.TimeoutException as e:
            raise EmbeddingProviderUnavailableError(
                f"Ollama batch embedding request timed out after {self._timeout}s"
            ) from e
        except Exception as e:
            raise EmbeddingProviderUnavailableError(
                f"Ollama communication error: {e}"
            ) from e

        if resp.status_code == 404:
            raise EmbeddingModelError(
                f"Ollama model '{self._model_name}' not found. Run 'ollama pull {self._model_name}'."
            )
        elif resp.status_code != 200:
            raise EmbeddingError(
                f"Ollama API returned HTTP {resp.status_code}: {resp.text}"
            )

        data = resp.json()
        embeddings = data.get("embeddings")
        if not embeddings or not isinstance(embeddings, list):
            raise EmbeddingError("Ollama response did not contain an 'embeddings' list.")

        if len(embeddings) != len(texts):
            raise EmbeddingError(
                f"Ollama batch returned {len(embeddings)} vectors, expected {len(texts)}."
            )

        for vec in embeddings:
            actual_dim = len(vec)
            if actual_dim != self._dimension:
                raise EmbeddingDimensionError(
                    f"Ollama API returned batch vector dimension {actual_dim}, "
                    f"but expected configured dimension {self._dimension}. "
                    f"Dimension mismatch detected. Configured dimension will not be mutated."
                )

        return embeddings

    async def check_health(self) -> ProviderHealthStatus:
        """Check availability of Ollama daemon and configured model."""
        url = f"{self._base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "").split(":")[0] for m in data.get("models", [])]
                model_base = self._model_name.split(":")[0]
                model_found = any(model_base in m for m in models)
                return ProviderHealthStatus(
                    provider=self.provider_name,
                    model=self.model_name,
                    available=True,
                    dimension=self.dimension,
                    error_message=None if model_found else f"Model '{self._model_name}' not in local Ollama inventory",
                )
            return ProviderHealthStatus(
                provider=self.provider_name,
                model=self.model_name,
                available=False,
                error_message=f"HTTP {resp.status_code} from {url}",
            )
        except Exception as e:
            return ProviderHealthStatus(
                provider=self.provider_name,
                model=self.model_name,
                available=False,
                error_message=f"Connection failed to {self._base_url}: {e}",
            )
