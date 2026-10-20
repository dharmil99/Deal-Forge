"""
tests/test_ai_retrieval.py

Unit tests for DealForge Phase AI-1: RetrievalService.
Validates semantic retrieval, top_k bounding, metadata filtering, and structured responses.
"""

import pytest

from backend.app.ai.config import AIConfig
from backend.app.ai.documents import DocumentLoader
from backend.app.ai.embeddings.mock import MockEmbeddingProvider
from backend.app.ai.indexing import IndexingService
from backend.app.ai.retrieval import RetrievalService
from backend.app.ai.vector_store import QdrantVectorStore


@pytest.fixture
async def indexed_retrieval_service():
    """Build an in-memory indexed RetrievalService fixture."""
    cfg = AIConfig(
        rag_enabled=True,
        rag_embedding_provider="mock",
        qdrant_url=":memory:",
        qdrant_collection="test_retrieval",
    )
    provider = MockEmbeddingProvider(dimension=64)
    store = QdrantVectorStore(url=":memory:", default_collection="test_retrieval")

    # Run indexing on actual DealForge documents
    loader = DocumentLoader()
    indexer = IndexingService(
        document_loader=loader,
        embedding_provider=provider,
        vector_store=store,
        config=cfg,
    )
    diagnostics = await indexer.run_indexing()
    assert diagnostics.vectors_indexed > 0

    return RetrievalService(
        embedding_provider=provider,
        vector_store=store,
        config=cfg,
    )


@pytest.mark.anyio
async def test_retrieval_returns_structured_results(indexed_retrieval_service: RetrievalService):
    """Verify that retrieval returns structured ScoredChunkResults."""
    res = await indexed_retrieval_service.retrieve(query="Discounted cash flow WACC", top_k=3)

    assert res.query == "Discounted cash flow WACC"
    assert res.provider == "mock"
    assert len(res.results) <= 3
    assert res.retrieval_count == len(res.results)

    for item in res.results:
        assert item.chunk_id
        assert item.document_id
        assert item.document_name
        assert item.content
        assert item.similarity_score is not None
        assert isinstance(item.metadata, dict)


@pytest.mark.anyio
async def test_retrieval_top_k_bounding(indexed_retrieval_service: RetrievalService):
    """Verify top_k bounds between 1 and 20."""
    res1 = await indexed_retrieval_service.retrieve(query="Valuation multiples", top_k=1)
    assert len(res1.results) == 1

    res5 = await indexed_retrieval_service.retrieve(query="Valuation multiples", top_k=5)
    assert len(res5.results) <= 5


@pytest.mark.anyio
async def test_retrieval_metadata_filtering(indexed_retrieval_service: RetrievalService):
    """Verify metadata filtering restricts results to target phase."""
    res = await indexed_retrieval_service.retrieve(
        query="EBITDA",
        top_k=5,
        filters={"phase": "Phase 1"},
    )
    assert len(res.results) > 0
    for r in res.results:
        assert r.metadata.get("phase") == "Phase 1"


@pytest.mark.anyio
async def test_retrieval_empty_query_error(indexed_retrieval_service: RetrievalService):
    """Verify that an empty query raises ValueError."""
    with pytest.raises(ValueError, match="empty"):
        await indexed_retrieval_service.retrieve(query="   ")


@pytest.mark.anyio
async def test_retrieval_disabled_rag():
    """Verify that if rag_enabled is False, retrieval returns empty results cleanly."""
    cfg = AIConfig(rag_enabled=False)
    service = RetrievalService(
        embedding_provider=MockEmbeddingProvider(),
        vector_store=QdrantVectorStore(url=":memory:"),
        config=cfg,
    )
    res = await service.retrieve(query="Any query")
    assert res.retrieval_count == 0
    assert res.results == []
    assert res.provider == "disabled"
