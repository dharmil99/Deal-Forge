"""
backend/app/ai/retrieval.py

Retrieval service for DealForge Phase AI-1: RAG Research Pilot Foundation.
Translates analytical search queries into vector embeddings, queries Qdrant,
and returns structured evidence without invoking LLM generation.
"""

import logging
from typing import Any, Dict, List, Optional

from backend.app.ai.config import AIConfig, get_ai_config
from backend.app.ai.embeddings import EmbeddingProvider, get_embedding_provider
from backend.app.ai.schemas import RetrievalRequest, RetrievalResponse, ScoredChunkResult
from backend.app.ai.vector_store import QdrantVectorStore

logger = logging.getLogger("dealforge.ai.retrieval")


class RetrievalService:
    """Institutional evidence retrieval service for DealForge RAG subsystem."""

    def __init__(
        self,
        embedding_provider: Optional[EmbeddingProvider] = None,
        vector_store: Optional[QdrantVectorStore] = None,
        config: Optional[AIConfig] = None,
    ) -> None:
        self.config = config or get_ai_config()
        self.embedding_provider = embedding_provider or get_embedding_provider(config=self.config)
        self.vector_store = vector_store or QdrantVectorStore(
            url=self.config.qdrant_url,
            api_key=self.config.qdrant_api_key,
            default_collection=self.config.qdrant_collection,
        )

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> RetrievalResponse:
        """
        Execute semantic evidence retrieval for a natural language or analytical query.
        Does NOT generate LLM answers; returns raw, scored provenance chunks.
        """
        if not self.config.rag_enabled:
            return RetrievalResponse(
                query=query,
                results=[],
                retrieval_count=0,
                provider="disabled",
                model="none",
            )

        cleaned_query = query.strip()
        if not cleaned_query:
            raise ValueError("Query string cannot be empty.")

        k = max(1, min(20, top_k))

        # 1. Generate query embedding vector
        logger.debug(f"Generating query embedding via {self.embedding_provider.provider_name}:{self.embedding_provider.model_name}")
        query_vector = await self.embedding_provider.embed_text(cleaned_query)

        # 2. Query Qdrant vector store
        logger.debug(f"Searching Qdrant collection '{self.vector_store.default_collection}' with top_k={k}")
        results = await self.vector_store.search(
            query_vector=query_vector,
            top_k=k,
            filters=filters,
        )

        return RetrievalResponse(
            query=cleaned_query,
            results=results,
            retrieval_count=len(results),
            provider=self.embedding_provider.provider_name,
            model=self.embedding_provider.model_name,
        )
