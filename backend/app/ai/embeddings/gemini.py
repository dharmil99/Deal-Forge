"""
backend/app/ai/embeddings/gemini.py

Google Gemini embedding provider for DealForge Phase AI-1: RAG Research Pilot Foundation.
Uses the official google-genai SDK for semantic vector generation.
Never logs, exposes, or hardcodes API credentials.
"""

import logging
from typing import List, Optional

from backend.app.ai.embeddings.base import (
    EmbeddingAuthError,
    EmbeddingDimensionError,
    EmbeddingError,
    EmbeddingModelError,
    EmbeddingProvider,
    EmbeddingProviderUnavailableError,
)
from backend.app.ai.schemas import ProviderHealthStatus

logger = logging.getLogger("dealforge.ai.embeddings.gemini")


class GeminiEmbeddingProvider(EmbeddingProvider):
    """Remote embedding provider utilizing Google Gemini."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = "gemini-embedding-2",
        dimension: int = 3072,
    ) -> None:
        self._api_key = api_key
        self._model_name = model_name
        self._dimension = dimension
        self._client = None

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimension(self) -> int:
        return self._dimension

    def _get_client(self):
        """Lazy-initialize google-genai client."""
        if not self._api_key:
            raise EmbeddingAuthError(
                "Gemini API key is not configured. Set the GEMINI_API_KEY environment variable."
            )

        if self._client is None:
            try:
                from google import genai
                self._client = genai.Client(api_key=self._api_key)
            except ImportError as e:
                raise EmbeddingProviderUnavailableError(
                    "google-genai package is not installed. Run 'pip install google-genai'."
                ) from e
            except Exception as e:
                raise EmbeddingError(f"Failed to initialize Gemini client: {e}") from e

        return self._client

    def _build_embed_config(self):
        """
        Construct EmbedContentConfig with explicit output_dimensionality.
        Raises EmbeddingProviderUnavailableError if the SDK or EmbedContentConfig cannot be imported or constructed.
        """
        try:
            from google.genai import types
            return types.EmbedContentConfig(output_dimensionality=self._dimension)
        except ImportError as e:
            raise EmbeddingProviderUnavailableError(
                "google-genai package is not installed. Run 'pip install google-genai'."
            ) from e
        except Exception as e:
            raise EmbeddingProviderUnavailableError(
                f"Failed to construct Gemini EmbedContentConfig with output_dimensionality={self._dimension}: {e}"
            ) from e

    async def embed_text(self, text: str) -> List[float]:
        """Embed a single text string using the Gemini API with dimension validation."""
        if not text or not text.strip():
            raise EmbeddingError("Cannot embed empty text.")

        client = self._get_client()
        embed_config = self._build_embed_config()

        try:
            response = client.models.embed_content(
                model=self._model_name,
                contents=text,
                config=embed_config,
            )
            # Format in google-genai: response.embeddings is a list of ContentEmbedding objects
            if hasattr(response, "embeddings") and response.embeddings:
                values = response.embeddings[0].values
            elif hasattr(response, "embedding") and response.embedding:
                values = response.embedding.values
            else:
                raise EmbeddingError("Gemini API returned empty embedding payload.")

            actual_dim = len(values)
            if actual_dim != self._dimension:
                raise EmbeddingDimensionError(
                    f"Gemini API returned vector dimension {actual_dim}, but expected configured dimension {self._dimension}. "
                    f"Dimension mismatch detected. Configured dimension will not be mutated."
                )

            return list(values)

        except (EmbeddingAuthError, EmbeddingDimensionError, EmbeddingModelError, EmbeddingProviderUnavailableError):
            raise
        except Exception as e:
            err_str = str(e)
            if "API_KEY_INVALID" in err_str or "unauthenticated" in err_str.lower() or "403" in err_str:
                raise EmbeddingAuthError(f"Gemini API authentication failed: {err_str}") from e
            elif "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                raise EmbeddingError(f"Gemini API quota/rate-limit exceeded: {err_str}") from e
            elif "not found" in err_str.lower() or "404" in err_str:
                raise EmbeddingModelError(f"Gemini model '{self._model_name}' not found: {err_str}") from e
            raise EmbeddingProviderUnavailableError(f"Gemini embedding call failed: {err_str}") from e

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of text strings in batch with dimension validation."""
        if not texts:
            return []

        client = self._get_client()
        embed_config = self._build_embed_config()

        try:
            response = client.models.embed_content(
                model=self._model_name,
                contents=texts,
                config=embed_config,
            )
            results: List[List[float]] = []
            if hasattr(response, "embeddings") and response.embeddings:
                for emb in response.embeddings:
                    actual_dim = len(emb.values)
                    if actual_dim != self._dimension:
                        raise EmbeddingDimensionError(
                            f"Gemini API returned batch vector dimension {actual_dim}, "
                            f"but expected configured dimension {self._dimension}."
                        )
                    results.append(list(emb.values))
            elif hasattr(response, "embedding") and response.embedding:
                actual_dim = len(response.embedding.values)
                if actual_dim != self._dimension:
                    raise EmbeddingDimensionError(
                        f"Gemini API returned vector dimension {actual_dim}, "
                        f"but expected configured dimension {self._dimension}."
                    )
                results.append(list(response.embedding.values))
            else:
                raise EmbeddingError("Gemini API returned empty batch embedding payload.")
            return results
        except (EmbeddingAuthError, EmbeddingDimensionError, EmbeddingModelError, EmbeddingProviderUnavailableError):
            raise
        except Exception as e:
            err_str = str(e)
            if "API_KEY_INVALID" in err_str or "unauthenticated" in err_str.lower() or "403" in err_str:
                raise EmbeddingAuthError(f"Gemini API authentication failed: {err_str}") from e
            elif "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                raise EmbeddingError(f"Gemini API quota/rate-limit exceeded: {err_str}") from e
            elif "not found" in err_str.lower() or "404" in err_str:
                raise EmbeddingModelError(f"Gemini model '{self._model_name}' not found: {err_str}") from e
            raise EmbeddingProviderUnavailableError(f"Gemini batch embedding call failed: {err_str}") from e

    async def check_health(self) -> ProviderHealthStatus:
        """Check whether the Gemini API key is configured and can be reached."""
        if not self._api_key:
            return ProviderHealthStatus(
                provider=self.provider_name,
                model=self.model_name,
                available=False,
                error_message="GEMINI_API_KEY environment variable is not configured.",
            )

        try:
            # Lightweight probe
            _ = await self.embed_text("DealForge health probe")
            return ProviderHealthStatus(
                provider=self.provider_name,
                model=self.model_name,
                available=True,
                dimension=self.dimension,
                error_message=None,
            )
        except Exception as e:
            return ProviderHealthStatus(
                provider=self.provider_name,
                model=self.model_name,
                available=False,
                error_message=str(e),
            )
