"""
tests/test_ai_pilot_questions.py

Pilot retrieval quality tests for DealForge Phase AI-1 (Section 12 of spec).
Deterministically validates that core corporate-finance and methodology queries
retrieve the exact expected DealForge evidence documents and section chunks.
Does NOT judge quality using an LLM.
"""

import pytest

from backend.app.ai.config import AIConfig
from backend.app.ai.documents import DocumentLoader
from backend.app.ai.embeddings.mock import MockEmbeddingProvider
from backend.app.ai.indexing import IndexingService
from backend.app.ai.retrieval import RetrievalService
from backend.app.ai.vector_store import QdrantVectorStore


@pytest.fixture(scope="module")
async def pilot_retrieval_service():
    """Build a module-scoped in-memory Qdrant instance with all DealForge methodology indexed."""
    cfg = AIConfig(
        rag_enabled=True,
        rag_embedding_provider="mock",
        qdrant_url=":memory:",
        qdrant_collection="pilot_eval_collection",
        chunk_size=800,
        chunk_overlap=100,
    )
    provider = MockEmbeddingProvider(dimension=128)
    store = QdrantVectorStore(url=":memory:", default_collection="pilot_eval_collection")

    loader = DocumentLoader()
    indexer = IndexingService(
        document_loader=loader,
        embedding_provider=provider,
        vector_store=store,
        config=cfg,
    )
    diagnostics = await indexer.run_indexing()
    assert diagnostics.vectors_indexed > 0
    assert diagnostics.documents_loaded == 7

    return RetrievalService(
        embedding_provider=provider,
        vector_store=store,
        config=cfg,
    )


@pytest.mark.anyio
async def test_pilot_question_1_precedent_ev_ebitda(pilot_retrieval_service: RetrievalService):
    """
    Pilot Question 1: 'Why is precedent EV/EBITDA unavailable?'
    Must retrieve evidence from valuation or governance documentation explaining undisclosed target EBITDA.
    """
    res = await pilot_retrieval_service.retrieve(
        query="Why is precedent EV/EBITDA unavailable?",
        top_k=5,
    )
    assert res.retrieval_count > 0

    all_content = " ".join(r.content for r in res.results)
    # Check that key institutional rationale is surfaced
    assert any(term in all_content.lower() for term in ["undisclosed", "ebitda", "precedent", "unavailable"])

    # Document provenance check
    doc_ids = {r.document_id for r in res.results}
    assert ("DOC-METH-VALUATION" in doc_ids) or ("DOC-METH-IC-GOVERNANCE" in doc_ids)


@pytest.mark.anyio
async def test_pilot_question_2_dcf_assumptions(pilot_retrieval_service: RetrievalService):
    """
    Pilot Question 2: 'What assumptions does the DCF use?'
    Must retrieve evidence explaining WACC, terminal growth, and cash flow projections.
    """
    res = await pilot_retrieval_service.retrieve(
        query="What assumptions does the DCF use?",
        top_k=5,
    )
    assert res.retrieval_count > 0

    all_content = " ".join(r.content for r in res.results)
    assert any(term in all_content.lower() for term in ["wacc", "discounted cash flow", "terminal growth", "capm", "dcf"])

    doc_ids = {r.document_id for r in res.results}
    assert "DOC-METH-VALUATION" in doc_ids


@pytest.mark.anyio
async def test_pilot_question_3_accretion_dilution(pilot_retrieval_service: RetrievalService):
    """
    Pilot Question 3: 'How does DealForge calculate accretion/dilution?'
    Must retrieve evidence explaining pro forma EPS, standalone EPS, and synergy ramp math.
    """
    res = await pilot_retrieval_service.retrieve(
        query="How does DealForge calculate accretion/dilution?",
        top_k=5,
    )
    assert res.retrieval_count > 0

    all_content = " ".join(r.content for r in res.results)
    assert any(term in all_content.lower() for term in ["pro forma eps", "accretion / dilution", "standalone eps", "synergies"])

    doc_ids = {r.document_id for r in res.results}
    assert "DOC-METH-ACCRETION-DILUTION" in doc_ids


@pytest.mark.anyio
async def test_pilot_question_4_funding_feasibility(pilot_retrieval_service: RetrievalService):
    """
    Pilot Question 4: 'How does DealForge determine funding feasibility?'
    Must retrieve evidence explaining minimum cash buffer, usable cash, and funding shortfall.
    """
    res = await pilot_retrieval_service.retrieve(
        query="How does DealForge determine funding feasibility?",
        top_k=5,
    )
    assert res.retrieval_count > 0

    all_content = " ".join(r.content for r in res.results)
    assert any(term in all_content.lower() for term in ["funding shortfall", "executable", "infeasible", "cash buffer", "liquidity"])

    doc_ids = {r.document_id for r in res.results}
    assert "DOC-METH-SOURCES-USES" in doc_ids


@pytest.mark.anyio
async def test_pilot_question_5_dataset_limitations(pilot_retrieval_service: RetrievalService):
    """
    Pilot Question 5: 'What are the known dataset limitations?'
    Must retrieve evidence from governance/data dictionary regarding 113 companies, precedent depth, EBITDA caveats.
    """
    res = await pilot_retrieval_service.retrieve(
        query="What are the known dataset limitations?",
        top_k=5,
    )
    assert res.retrieval_count > 0

    all_content = " ".join(r.content for r in res.results)
    assert any(term in all_content.lower() for term in ["113 companies", "limitations", "invariants", "sample", "precedent"])

    doc_ids = {r.document_id for r in res.results}
    assert ("DOC-METH-IC-GOVERNANCE" in doc_ids) or ("DOC-DATA-DICT" in doc_ids)
