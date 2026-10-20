"""
tests/test_ai_embeddings.py

Unit tests for DealForge Phase AI-1: Embedding Provider Abstraction.
Validates provider abstraction, dimension handling, batch embedding, and error conditions.
Specifically tests:
- gemini-embedding-2 default model and configuration
- Gemini dimension mismatch raises EmbeddingDimensionError without mutating dimension
- Gemini valid dimension acceptance
- Ollama modern POST /api/embed single and batch input/output
- Ollama dimension mismatch raises EmbeddingDimensionError without mutating dimension
- Strict provider separation (no fallback between Gemini and Ollama)
- Factory configuration and dimension passing
Does NOT require live external services.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from backend.app.ai.config import AIConfig
from backend.app.ai.embeddings import (
    EmbeddingAuthError,
    EmbeddingDimensionError,
    EmbeddingError,
    EmbeddingModelError,
    EmbeddingProviderUnavailableError,
    GeminiEmbeddingProvider,
    MockEmbeddingProvider,
    OllamaEmbeddingProvider,
    get_embedding_provider,
)


@pytest.mark.anyio
async def test_mock_embedding_provider():
    """Verify mock provider produces deterministic normalized vectors."""
    provider = MockEmbeddingProvider(dimension=64)
    assert provider.provider_name == "mock"
    assert provider.model_name == "mock-dealforge-embed"
    assert provider.dimension == 64

    vec1 = await provider.embed_text("EBITDA derivation formula")
    vec2 = await provider.embed_text("EBITDA derivation formula")
    vec3 = await provider.embed_text("Precedent transaction sample size")

    assert len(vec1) == 64
    assert vec1 == vec2  # Strict determinism
    assert vec1 != vec3  # Content sensitivity

    # Verify unit length norm
    norm = sum(x * x for x in vec1)
    assert abs(norm - 1.0) < 1e-4

    # Batch embedding
    batch = await provider.embed_batch(["Text A", "Text B"])
    assert len(batch) == 2
    assert len(batch[0]) == 64
    assert len(batch[1]) == 64

    # Health check
    health = await provider.check_health()
    assert health.available is True
    assert health.dimension == 64


# =========================================================================
# OLLAMA MODERN /api/embed TESTS
# =========================================================================

@pytest.mark.anyio
async def test_ollama_provider_modern_embed_single():
    """Verify Ollama provider calls POST /api/embed and parses response['embeddings']."""
    provider = OllamaEmbeddingProvider(
        base_url="http://localhost:11434",
        model_name="nomic-embed-text",
        dimension=768,
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"embeddings": [[0.1] * 768]}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        vec = await provider.embed_text("Valuation summary")

        assert len(vec) == 768
        assert mock_post.called
        call_args = mock_post.call_args
        assert call_args[0][0] == "http://localhost:11434/api/embed"
        assert call_args[1]["json"] == {"model": "nomic-embed-text", "input": "Valuation summary"}


@pytest.mark.anyio
async def test_ollama_provider_modern_embed_batch():
    """Verify Ollama provider handles batch requests via POST /api/embed."""
    provider = OllamaEmbeddingProvider(
        base_url="http://localhost:11434",
        model_name="nomic-embed-text",
        dimension=768,
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "embeddings": [
            [0.1] * 768,
            [0.2] * 768,
        ]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        batch = await provider.embed_batch(["Valuation summary", "DCF assumptions"])

        assert len(batch) == 2
        assert len(batch[0]) == 768
        assert len(batch[1]) == 768
        call_args = mock_post.call_args
        assert call_args[0][0] == "http://localhost:11434/api/embed"
        assert call_args[1]["json"] == {
            "model": "nomic-embed-text",
            "input": ["Valuation summary", "DCF assumptions"],
        }


@pytest.mark.anyio
async def test_ollama_provider_dimension_mismatch():
    """Verify Ollama raises EmbeddingDimensionError without mutating configured dimension."""
    provider = OllamaEmbeddingProvider(
        base_url="http://localhost:11434",
        model_name="nomic-embed-text",
        dimension=768,
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    # API returns unexpected dimension 512
    mock_resp.json.return_value = {"embeddings": [[0.5] * 512]}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        with pytest.raises(EmbeddingDimensionError, match="dimension 512, but expected configured dimension 768"):
            await provider.embed_text("Test query")

        # Configured dimension MUST NOT be silently mutated
        assert provider.dimension == 768


@pytest.mark.anyio
async def test_ollama_provider_unavailable():
    """Verify clear infrastructure error when Ollama connection is refused."""
    provider = OllamaEmbeddingProvider(base_url="http://127.0.0.1:9999")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.ConnectError("Connection refused")
        with pytest.raises(EmbeddingProviderUnavailableError, match="unavailable at http://127.0.0.1:9999"):
            await provider.embed_text("Test query")


@pytest.mark.anyio
async def test_ollama_provider_model_not_found():
    """Verify EmbeddingModelError when model returns 404."""
    provider = OllamaEmbeddingProvider(model_name="nonexistent-model")

    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_resp.text = "model not found"

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        with pytest.raises(EmbeddingModelError, match="not found"):
            await provider.embed_text("Test query")


# =========================================================================
# GEMINI EMBEDDING-2 & DIMENSION SAFETY TESTS
# =========================================================================

def test_gemini_embedding_2_default_configuration():
    """Verify Gemini provider defaults to gemini-embedding-2 and dimension 3072."""
    provider = GeminiEmbeddingProvider(api_key="test-key")
    assert provider.model_name == "gemini-embedding-2"
    assert provider.dimension == 3072


@pytest.mark.anyio
async def test_gemini_provider_valid_dimension():
    """Verify successful embedding with expected dimension."""
    provider = GeminiEmbeddingProvider(
        api_key="fake-key-12345",
        model_name="gemini-embedding-2",
        dimension=3072,
    )

    mock_embedding = MagicMock()
    mock_embedding.values = [0.01] * 3072
    mock_response = MagicMock()
    mock_response.embeddings = [mock_embedding]

    with patch.object(provider, "_get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        vec = await provider.embed_text("DCF methodology")
        assert len(vec) == 3072
        assert provider.dimension == 3072


@pytest.mark.anyio
async def test_gemini_provider_dimension_mismatch():
    """Verify Gemini raises EmbeddingDimensionError and does NOT mutate configured dimension."""
    provider = GeminiEmbeddingProvider(
        api_key="fake-key-12345",
        model_name="gemini-embedding-2",
        dimension=3072,
    )

    # API returns unexpected 768 dimensions
    mock_embedding = MagicMock()
    mock_embedding.values = [0.01] * 768
    mock_response = MagicMock()
    mock_response.embeddings = [mock_embedding]

    with patch.object(provider, "_get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        with pytest.raises(EmbeddingDimensionError, match="dimension 768, but expected configured dimension 3072"):
            await provider.embed_text("DCF methodology")

        # Crucial check: dimension must NOT have been silently updated
        assert provider.dimension == 3072


@pytest.mark.anyio
async def test_gemini_batch_dimension_mismatch():
    """Verify Gemini batch raises EmbeddingDimensionError on vector dimension conflict."""
    provider = GeminiEmbeddingProvider(
        api_key="fake-key-12345",
        model_name="gemini-embedding-2",
        dimension=3072,
    )

    mock_emb1 = MagicMock()
    mock_emb1.values = [0.01] * 3072
    mock_emb2 = MagicMock()
    mock_emb2.values = [0.01] * 1536  # Mismatched dimension in batch item 2
    mock_response = MagicMock()
    mock_response.embeddings = [mock_emb1, mock_emb2]

    with patch.object(provider, "_get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = mock_response
        mock_get_client.return_value = mock_client

        with pytest.raises(EmbeddingDimensionError, match="dimension 1536, but expected configured dimension 3072"):
            await provider.embed_batch(["Text 1", "Text 2"])

        assert provider.dimension == 3072


@pytest.mark.anyio
async def test_gemini_provider_missing_key():
    """Verify EmbeddingAuthError when Gemini API key is missing."""
    provider = GeminiEmbeddingProvider(api_key=None)
    with pytest.raises(EmbeddingAuthError, match="GEMINI_API_KEY"):
        await provider.embed_text("Test query")


@pytest.mark.anyio
async def test_gemini_provider_auth_failure():
    """Verify EmbeddingAuthError when Gemini API rejects key."""
    provider = GeminiEmbeddingProvider(api_key="fake-key-12345")

    with patch.object(provider, "_get_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.models.embed_content.side_effect = Exception("API_KEY_INVALID: Key not valid")
        mock_get_client.return_value = mock_client

        with pytest.raises(EmbeddingAuthError, match="authentication failed"):
            await provider.embed_text("Test query")

        assert provider.dimension == 3072


@pytest.mark.anyio
async def test_gemini_provider_embed_config_construction_failure():
    """Verify EmbeddingProviderUnavailableError when EmbedContentConfig fails to construct."""
    provider = GeminiEmbeddingProvider(api_key="fake-key-12345", dimension=3072)

    with patch.object(provider, "_get_client") as mock_get_client, \
         patch("google.genai.types.EmbedContentConfig", side_effect=Exception("SDK incompatible with output_dimensionality")):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        with pytest.raises(EmbeddingProviderUnavailableError, match="Failed to construct Gemini EmbedContentConfig"):
            await provider.embed_text("Test query")

        # Configured dimension remains strictly unchanged
        assert provider.dimension == 3072


@pytest.mark.anyio
async def test_gemini_batch_embed_config_construction_failure():
    """Verify EmbeddingProviderUnavailableError for batch when EmbedContentConfig fails to construct."""
    provider = GeminiEmbeddingProvider(api_key="fake-key-12345", dimension=3072)

    with patch.object(provider, "_get_client") as mock_get_client, \
         patch("google.genai.types.EmbedContentConfig", side_effect=Exception("SDK incompatible")):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        with pytest.raises(EmbeddingProviderUnavailableError, match="Failed to construct Gemini EmbedContentConfig"):
            await provider.embed_batch(["Text 1", "Text 2"])

        # Configured dimension remains strictly unchanged
        assert provider.dimension == 3072


# =========================================================================
# PROVIDER SEPARATION & FACTORY TESTS
# =========================================================================

@pytest.mark.anyio
async def test_provider_separation_gemini_does_not_call_ollama():
    """Verify Gemini failure raises Gemini error independently without fallback to Ollama."""
    gemini_provider = GeminiEmbeddingProvider(api_key="bad-key")

    with patch.object(gemini_provider, "_get_client") as mock_client_call, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_ollama_post:
        mock_client = MagicMock()
        mock_client.models.embed_content.side_effect = Exception("API_KEY_INVALID")
        mock_client_call.return_value = mock_client

        with pytest.raises(EmbeddingAuthError):
            await gemini_provider.embed_text("Test query")

        # Ollama must NEVER have been called
        assert not mock_ollama_post.called


@pytest.mark.anyio
async def test_provider_separation_ollama_does_not_call_gemini():
    """Verify Ollama failure raises Ollama error independently without fallback to Gemini."""
    ollama_provider = OllamaEmbeddingProvider(base_url="http://127.0.0.1:9999")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_ollama_post, \
         patch("google.genai.Client") as mock_gemini_client:
        mock_ollama_post.side_effect = httpx.ConnectError("Connection refused")

        with pytest.raises(EmbeddingProviderUnavailableError):
            await ollama_provider.embed_text("Test query")

        # Gemini client must NEVER have been called
        assert not mock_gemini_client.called


def test_embedding_factory():
    """Verify factory returns appropriate provider instances with configured model and dimensions."""
    cfg = AIConfig(
        rag_embedding_provider="mock",
        ollama_base_url="http://localhost:11434",
        gemini_api_key="test-key",
        gemini_embedding_model="gemini-embedding-2",
        gemini_embedding_dimension=3072,
    )

    p_mock = get_embedding_provider("mock", config=cfg)
    assert isinstance(p_mock, MockEmbeddingProvider)

    p_ollama = get_embedding_provider("ollama", config=cfg)
    assert isinstance(p_ollama, OllamaEmbeddingProvider)

    p_gemini = get_embedding_provider("gemini", config=cfg)
    assert isinstance(p_gemini, GeminiEmbeddingProvider)
    assert p_gemini.model_name == "gemini-embedding-2"
    assert p_gemini.dimension == 3072

    with pytest.raises(ValueError, match="Unsupported embedding provider"):
        get_embedding_provider("invalid-provider", config=cfg)
