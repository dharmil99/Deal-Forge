"""
backend/app/ai/vector_store.py

Qdrant vector store service abstraction for DealForge Phase AI-1: RAG Research Pilot Foundation.
Encapsulates collection lifecycle, dimension validation, vector upsert, and semantic search.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from backend.app.ai.schemas import Chunk, ScoredChunkResult

logger = logging.getLogger("dealforge.ai.vector_store")


class VectorStoreError(Exception):
    """Base exception for vector database operations."""
    pass


class IncompatibleEmbeddingDimensionError(VectorStoreError):
    """Raised when existing collection vector dimension conflicts with provider vector dimension."""
    pass


class QdrantVectorStore:
    """Institutional vector store service wrapping Qdrant with dimension validation."""

    def __init__(
        self,
        url: str = "http://localhost:6333",
        api_key: Optional[str] = None,
        default_collection: str = "dealforge_methodology",
        client: Optional[AsyncQdrantClient] = None,
    ) -> None:
        self.url = url
        self.default_collection = default_collection
        if client is not None:
            self._client = client
        elif url == ":memory:":
            self._client = AsyncQdrantClient(location=":memory:")
        else:
            self._client = AsyncQdrantClient(url=url, api_key=api_key)

    @property
    def client(self) -> AsyncQdrantClient:
        return self._client

    async def init_collection(
        self,
        collection_name: Optional[str] = None,
        vector_size: int = 768,
        distance: str = "Cosine",
        recreate_if_incompatible: bool = False,
    ) -> bool:
        """
        Initialize or verify collection with dimension consistency checks.
        If collection exists with different dimension:
        - raises IncompatibleEmbeddingDimensionError (or recreates if recreate_if_incompatible=True).
        """
        col = collection_name or self.default_collection
        dist = Distance.COSINE if distance.lower() == "cosine" else Distance.DOT

        try:
            exists = await self._client.collection_exists(col)
        except Exception as e:
            raise VectorStoreError(f"Failed to connect to Qdrant at {self.url}: {e}") from e

        if exists:
            info = await self._client.get_collection(col)
            params = info.config.params.vectors
            # In Qdrant, params can be VectorParams or dict of VectorParams
            existing_size = params.size if hasattr(params, "size") else getattr(params, "size", vector_size)

            if existing_size != vector_size:
                if recreate_if_incompatible:
                    logger.warning(
                        f"Recreating collection '{col}': dimension mismatch {existing_size} -> {vector_size}"
                    )
                    await self._client.delete_collection(col)
                    await self._client.create_collection(
                        collection_name=col,
                        vectors_config=VectorParams(size=vector_size, distance=dist),
                    )
                    return True
                else:
                    raise IncompatibleEmbeddingDimensionError(
                        f"Collection '{col}' exists with vector dimension {existing_size}, "
                        f"which conflicts with active provider dimension {vector_size}. "
                        f"Re-indexing required."
                    )
            logger.info(f"Verified collection '{col}' with dimension {vector_size}")
            return False
        else:
            logger.info(f"Creating new Qdrant collection '{col}' with dimension {vector_size}")
            await self._client.create_collection(
                collection_name=col,
                vectors_config=VectorParams(size=vector_size, distance=dist),
            )
            return True

    async def upsert_chunks(
        self,
        chunks: List[Chunk],
        vectors: List[List[float]],
        collection_name: Optional[str] = None,
    ) -> int:
        """
        Upsert a list of chunks and their corresponding embedding vectors into Qdrant.
        Returns the number of points upserted.
        """
        if len(chunks) != len(vectors):
            raise ValueError(f"Mismatched chunks ({len(chunks)}) and vectors ({len(vectors)})")
        if not chunks:
            return 0

        col = collection_name or self.default_collection
        points: List[PointStruct] = []

        for chunk, vec in zip(chunks, vectors):
            # Deterministic UUID derived from chunk_id
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk.chunk_id))
            payload = {
                "chunk_id": chunk.chunk_id,
                "document_id": chunk.document_id,
                "document_name": chunk.document_name,
                "section": chunk.section,
                "section_heading": chunk.section_heading,
                "content": chunk.content,
                "raw_content": chunk.raw_content,
                "chunk_index": chunk.chunk_index,
                **chunk.metadata,
            }
            points.append(PointStruct(id=point_id, vector=vec, payload=payload))

        try:
            await self._client.upsert(collection_name=col, points=points)
            logger.info(f"Successfully upserted {len(points)} points into '{col}'")
            return len(points)
        except Exception as e:
            raise VectorStoreError(f"Failed to upsert points into collection '{col}': {e}") from e

    async def search(
        self,
        query_vector: List[float],
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        collection_name: Optional[str] = None,
    ) -> List[ScoredChunkResult]:
        """Execute semantic vector search with optional metadata filtering."""
        col = collection_name or self.default_collection

        # Build Qdrant filter if provided
        query_filter: Optional[Filter] = None
        if filters:
            conditions = []
            for key, val in filters.items():
                if val is not None:
                    conditions.append(FieldCondition(key=key, match=MatchValue(value=val)))
            if conditions:
                query_filter = Filter(must=conditions)

        try:
            res = await self._client.query_points(
                collection_name=col,
                query=query_vector,
                query_filter=query_filter,
                limit=top_k,
            )
        except Exception as e:
            raise VectorStoreError(f"Qdrant search failed on collection '{col}': {e}") from e

        results: List[ScoredChunkResult] = []
        for pt in res.points:
            payload = pt.payload or {}
            results.append(
                ScoredChunkResult(
                    chunk_id=payload.get("chunk_id", str(pt.id)),
                    document_id=payload.get("document_id", "UNKNOWN"),
                    document_name=payload.get("document_name", "Unknown Document"),
                    section=payload.get("section", "General"),
                    section_heading=payload.get("section_heading", ""),
                    content=payload.get("content", ""),
                    similarity_score=float(pt.score) if pt.score is not None else 0.0,
                    metadata=payload,
                )
            )

        return results

    async def get_collection_info(self, collection_name: Optional[str] = None) -> Dict[str, Any]:
        """Fetch status and counts for the target collection."""
        col = collection_name or self.default_collection
        try:
            exists = await self._client.collection_exists(col)
            if not exists:
                return {
                    "exists": False,
                    "collection": col,
                    "points_count": 0,
                    "status": "not_found",
                }
            info = await self._client.get_collection(col)
            return {
                "exists": True,
                "collection": col,
                "points_count": info.points_count or 0,
                "status": getattr(info, "status", "ready"),
                "vectors_count": getattr(info, "vectors_count", 0),
            }
        except Exception as e:
            return {
                "exists": False,
                "collection": col,
                "error": str(e),
                "status": "unreachable",
            }

    async def check_health(self) -> Dict[str, Any]:
        """Check Qdrant database connectivity and cluster health."""
        try:
            collections = await self._client.get_collections()
            col_names = [c.name for c in collections.collections]
            return {
                "available": True,
                "url": self.url,
                "collections_count": len(col_names),
                "target_collection_exists": self.default_collection in col_names,
            }
        except Exception as e:
            return {
                "available": False,
                "url": self.url,
                "error": str(e),
            }
