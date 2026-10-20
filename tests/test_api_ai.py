"""
tests/test_api_ai.py

API integration tests for DealForge Phase AI-1: RAG Research Pilot endpoints.
Tests /api/v1/ai/research/retrieve, /api/v1/ai/research/health, and /api/v1/ai/research/index.
"""

from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.ai.config import AIConfig, get_ai_config
from backend.app.ai.embeddings.mock import MockEmbeddingProvider
from backend.app.ai.schemas import RetrievalResponse, ScoredChunkResult
from backend.app.main import create_app


@pytest.fixture
def test_app():
    """Create test FastAPI application instance with mock AI config."""
    test_cfg = AIConfig(
        rag_enabled=True,
        rag_embedding_provider="mock",
        qdrant_url=":memory:",
        qdrant_collection="test_api_collection",
    )
    app = create_app()
    app.dependency_overrides[get_ai_config] = lambda: test_cfg
    return app


@pytest.fixture
def client(test_app):
    return TestClient(test_app)


def test_api_ai_health_endpoint(client: TestClient):
    """Verify /api/v1/ai/research/health diagnostic response."""
    resp = client.get("/api/v1/ai/research/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "rag_enabled" in data
    assert data["rag_enabled"] is True
    assert data["embedding_provider"] == "mock"
    assert "qdrant_available" in data
    assert "indexed_chunk_count" in data


def test_api_ai_indexing_and_retrieve_flow(client: TestClient):
    """Verify full HTTP flow: index documents then retrieve evidence."""
    # 1. Trigger indexing
    idx_resp = client.post("/api/v1/ai/research/index?recreate=true")
    assert idx_resp.status_code == 200
    diag = idx_resp.json()
    assert diag["documents_loaded"] == 7
    assert diag["chunks_generated"] > 0
    assert diag["vectors_indexed"] > 0

    # 2. Query retrieval endpoint
    retrieve_payload = {
        "query": "What are the DCF WACC assumptions?",
        "top_k": 3,
    }
    ret_resp = client.post("/api/v1/ai/research/retrieve", json=retrieve_payload)
    assert ret_resp.status_code == 200
    ret_data = ret_resp.json()

    assert ret_data["query"] == "What are the DCF WACC assumptions?"
    assert ret_data["retrieval_count"] > 0
    assert len(ret_data["results"]) <= 3

    first_chunk = ret_data["results"][0]
    assert "chunk_id" in first_chunk
    assert "document_id" in first_chunk
    assert "content" in first_chunk
    assert "similarity_score" in first_chunk
    assert "metadata" in first_chunk


def test_api_ai_retrieve_invalid_query_validation(client: TestClient):
    """Verify 422 validation failure on empty or whitespace query."""
    resp = client.post("/api/v1/ai/research/retrieve", json={"query": " "})
    assert resp.status_code == 422


def test_api_ai_retrieve_missing_query(client: TestClient):
    """Verify 422 validation error when query field is missing."""
    resp = client.post("/api/v1/ai/research/retrieve", json={"top_k": 5})
    assert resp.status_code == 422
