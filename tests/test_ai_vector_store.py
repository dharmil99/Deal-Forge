"""
tests/test_ai_vector_store.py

Unit tests for DealForge Phase AI-1: Qdrant Vector Store Abstraction.
Validates collection initialization, dimension consistency, vector upsert, and metadata filtering.
Uses hermetic in-memory Qdrant (:memory:).
"""

import pytest

from backend.app.ai.schemas import Chunk
from backend.app.ai.vector_store import (
    IncompatibleEmbeddingDimensionError,
    QdrantVectorStore,
    VectorStoreError,
)


@pytest.fixture
def memory_store():
    """Create an in-memory Qdrant store fixture."""
    return QdrantVectorStore(
        url=":memory:",
        default_collection="test_methodology",
    )


@pytest.mark.anyio
async def test_qdrant_collection_init_and_dimension_validation(memory_store: QdrantVectorStore):
    """Verify collection initialization and dimension conflict detection."""
    # 1. Initialize with dimension 64
    created = await memory_store.init_collection(vector_size=64)
    assert created is True

    # 2. Verifying with same dimension succeeds
    created2 = await memory_store.init_collection(vector_size=64)
    assert created2 is False

    # 3. Trying to initialize with incompatible dimension raises error
    with pytest.raises(IncompatibleEmbeddingDimensionError, match="dimension 64, which conflicts with active provider dimension 768"):
        await memory_store.init_collection(vector_size=768, recreate_if_incompatible=False)

    # 4. Recreate with recreate_if_incompatible=True succeeds
    recreated = await memory_store.init_collection(vector_size=768, recreate_if_incompatible=True)
    assert recreated is True

    info = await memory_store.get_collection_info()
    assert info["exists"] is True
    assert info["points_count"] == 0


@pytest.mark.anyio
async def test_qdrant_upsert_and_semantic_search(memory_store: QdrantVectorStore):
    """Verify vector upsert and semantic search with score ordering."""
    await memory_store.init_collection(vector_size=4)

    chunk1 = Chunk(
        chunk_id="CHUNK-001",
        document_id="DOC-VAL",
        document_name="Valuation Doc",
        section="Valuation",
        section_heading="DCF",
        content="DCF perpetual growth model",
        raw_content="DCF perpetual growth model",
        chunk_index=0,
        metadata={"phase": "Phase 4.5", "section": "Valuation"},
    )
    chunk2 = Chunk(
        chunk_id="CHUNK-002",
        document_id="DOC-SU",
        document_name="Sources Uses Doc",
        section="Sources & Uses",
        section_heading="Feasibility",
        content="Funding feasibility cash buffer",
        raw_content="Funding feasibility cash buffer",
        chunk_index=1,
        metadata={"phase": "Phase 7", "section": "Sources & Uses"},
    )

    vec1 = [1.0, 0.0, 0.0, 0.0]
    vec2 = [0.0, 1.0, 0.0, 0.0]

    upserted = await memory_store.upsert_chunks([chunk1, chunk2], [vec1, vec2])
    assert upserted == 2

    # Query closest to vec1
    results = await memory_store.search(query_vector=[0.9, 0.1, 0.0, 0.0], top_k=2)
    assert len(results) == 2
    assert results[0].chunk_id == "CHUNK-001"
    assert results[0].document_id == "DOC-VAL"
    assert results[0].similarity_score > results[1].similarity_score


@pytest.mark.anyio
async def test_qdrant_metadata_filtering(memory_store: QdrantVectorStore):
    """Verify metadata filtering restricts retrieval to matching criteria."""
    await memory_store.init_collection(vector_size=4)

    chunk1 = Chunk(
        chunk_id="CHUNK-001",
        document_id="DOC-VAL",
        document_name="Valuation",
        section="Valuation",
        content="Comps multiple",
        raw_content="Comps multiple",
        chunk_index=0,
        metadata={"phase": "Phase 3", "section": "Valuation"},
    )
    chunk2 = Chunk(
        chunk_id="CHUNK-002",
        document_id="DOC-AD",
        document_name="Accretion",
        section="Accretion",
        content="EPS accretion",
        raw_content="EPS accretion",
        chunk_index=1,
        metadata={"phase": "Phase 8", "section": "Accretion"},
    )

    await memory_store.upsert_chunks(
        [chunk1, chunk2],
        [[1.0, 0.0, 0.0, 0.0], [0.95, 0.05, 0.0, 0.0]]
    )

    # Filter for Phase 8 only
    filtered = await memory_store.search(
        query_vector=[1.0, 0.0, 0.0, 0.0],
        top_k=5,
        filters={"phase": "Phase 8"},
    )
    assert len(filtered) == 1
    assert filtered[0].chunk_id == "CHUNK-002"
    assert filtered[0].metadata["phase"] == "Phase 8"


@pytest.mark.anyio
async def test_qdrant_health_check(memory_store: QdrantVectorStore):
    """Verify health reporting."""
    health = await memory_store.check_health()
    assert health["available"] is True
    assert health["url"] == ":memory:"
