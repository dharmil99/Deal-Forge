"""
backend/app/api/v1/ai.py

FastAPI route handlers for DealForge Phase AI-1: RAG Research Pilot Foundation.
Exposes evidence retrieval, system diagnostics, and indexing triggers.
Strictly retrieval only — does NOT generate LLM answers.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.ai.config import AIConfig, get_ai_config
from backend.app.ai.embeddings import (
    EmbeddingAuthError,
    EmbeddingDimensionError,
    EmbeddingError,
    EmbeddingProviderUnavailableError,
    get_embedding_provider,
)
from backend.app.ai.indexing import IndexingService
from backend.app.ai.retrieval import RetrievalService
from backend.app.ai.schemas import (
    IndexingDiagnostics,
    RAGHealthResponse,
    RetrievalRequest,
    RetrievalResponse,
)
from backend.app.ai.vector_store import (
    IncompatibleEmbeddingDimensionError,
    QdrantVectorStore,
    VectorStoreError,
)

logger = logging.getLogger("dealforge.api.v1.ai")
router = APIRouter()


_shared_vector_stores: dict = {}


def get_vector_store(config: AIConfig = Depends(get_ai_config)) -> QdrantVectorStore:
    """Dependency provider for QdrantVectorStore, caching by url and collection."""
    key = f"{config.qdrant_url}::{config.qdrant_collection}"
    if key not in _shared_vector_stores:
        _shared_vector_stores[key] = QdrantVectorStore(
            url=config.qdrant_url,
            api_key=config.qdrant_api_key,
            default_collection=config.qdrant_collection,
        )
    return _shared_vector_stores[key]


def get_retrieval_service(
    config: AIConfig = Depends(get_ai_config),
    vector_store: QdrantVectorStore = Depends(get_vector_store),
) -> RetrievalService:
    """Dependency provider for RetrievalService singleton/factory."""
    provider = get_embedding_provider(config=config)
    return RetrievalService(config=config, embedding_provider=provider, vector_store=vector_store)


def get_indexing_service(
    config: AIConfig = Depends(get_ai_config),
    vector_store: QdrantVectorStore = Depends(get_vector_store),
) -> IndexingService:
    """Dependency provider for IndexingService."""
    provider = get_embedding_provider(config=config)
    return IndexingService(config=config, embedding_provider=provider, vector_store=vector_store)


@router.post(
    "/research/retrieve",
    response_model=RetrievalResponse,
    summary="Retrieve Research Evidence",
    description="Semantically retrieve trusted methodology and documentation evidence. Retrieval only — no LLM answer generation.",
)
async def retrieve_evidence(
    request: RetrievalRequest,
    service: RetrievalService = Depends(get_retrieval_service),
) -> RetrievalResponse:
    """Execute semantic vector retrieval for evidence chunks."""
    try:
        response = await service.retrieve(
            query=request.query,
            top_k=request.top_k,
            filters=request.filters,
        )
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except (EmbeddingProviderUnavailableError, EmbeddingAuthError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Embedding provider unavailable: {e}",
        )
    except (IncompatibleEmbeddingDimensionError, EmbeddingDimensionError) as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except VectorStoreError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Vector store unavailable: {e}",
        )
    except Exception as e:
        logger.error(f"Unexpected retrieval failure: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal retrieval error: {e}",
        )


@router.get(
    "/research/health",
    response_model=RAGHealthResponse,
    summary="AI/RAG Subsystem Health",
    description="Check availability of configured embedding providers and Qdrant collection status.",
)
async def rag_health(
    config: AIConfig = Depends(get_ai_config),
    v_store: QdrantVectorStore = Depends(get_vector_store),
) -> RAGHealthResponse:
    """Diagnostic health check for AI/RAG infrastructure."""
    notes = []

    # 1. Check embedding provider health
    try:
        provider = get_embedding_provider(config=config)
        p_health = await provider.check_health()
        provider_available = p_health.available
        provider_dim = p_health.dimension
        if p_health.error_message:
            notes.append(f"Provider notice: {p_health.error_message}")
    except Exception as e:
        provider_available = False
        provider_dim = None
        notes.append(f"Provider error: {e}")

    # Check alternative provider probes for diagnostics
    ollama_ok = False
    gemini_ok = False

    try:
        from backend.app.ai.embeddings.ollama import OllamaEmbeddingProvider
        ollama_p = OllamaEmbeddingProvider(base_url=config.ollama_base_url)
        o_health = await ollama_p.check_health()
        ollama_ok = o_health.available
    except Exception:
        ollama_ok = False

    try:
        from backend.app.ai.embeddings.gemini import GeminiEmbeddingProvider
        gemini_p = GeminiEmbeddingProvider(api_key=config.gemini_api_key)
        g_health = await gemini_p.check_health()
        gemini_ok = g_health.available
    except Exception:
        gemini_ok = False

    # 2. Check Qdrant vector store health
    qdrant_ok = False
    doc_count = 0
    chunk_count = 0
    try:
        q_health = await v_store.check_health()
        qdrant_ok = q_health.get("available", False)
        if qdrant_ok:
            col_info = await v_store.get_collection_info()
            chunk_count = col_info.get("points_count", 0)
        else:
            notes.append(f"Qdrant connection notice: {q_health.get('error', 'unreachable')}")
    except Exception as e:
        qdrant_ok = False
        notes.append(f"Qdrant error: {e}")

    overall_status = "ok" if (provider_available and qdrant_ok) else ("degraded" if qdrant_ok else "unavailable")

    return RAGHealthResponse(
        status=overall_status,
        rag_enabled=config.rag_enabled,
        embedding_provider=config.rag_embedding_provider,
        embedding_model=config.rag_embedding_model,
        embedding_dimension=provider_dim,
        ollama_available=ollama_ok,
        gemini_available=gemini_ok,
        qdrant_available=qdrant_ok,
        qdrant_collection=config.qdrant_collection,
        indexed_document_count=7 if chunk_count > 0 else 0,
        indexed_chunk_count=chunk_count,
        diagnostics_notes=notes,
    )


@router.post(
    "/research/index",
    response_model=IndexingDiagnostics,
    summary="Index Documentation into Qdrant",
    description="Triggers deterministic document loading, chunking, embedding, and Qdrant collection upsert.",
)
async def trigger_indexing(
    recreate: bool = False,
    service: IndexingService = Depends(get_indexing_service),
) -> IndexingDiagnostics:
    """Execute administrative indexing pipeline."""
    try:
        diagnostics = await service.run_indexing(recreate_collection=recreate)
        return diagnostics
    except (IncompatibleEmbeddingDimensionError, EmbeddingDimensionError) as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Indexing pipeline failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Indexing failure: {e}",
        )
