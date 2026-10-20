"""
backend/app/ai/__init__.py

DealForge Phase AI-1: RAG Research Pilot Foundation package.
Provides deterministic document loading, chunking, provider-agnostic embeddings,
Qdrant vector storage, and semantic retrieval for internal DealForge methodology.
"""

from backend.app.ai.chunking import DeterministicChunker
from backend.app.ai.config import AIConfig, get_ai_config
from backend.app.ai.documents import DocumentLoader
from backend.app.ai.embeddings import (
    EmbeddingProvider,
    GeminiEmbeddingProvider,
    MockEmbeddingProvider,
    OllamaEmbeddingProvider,
    get_embedding_provider,
)
from backend.app.ai.indexing import IndexingService
from backend.app.ai.retrieval import RetrievalService
from backend.app.ai.schemas import (
    Chunk,
    Document,
    IndexingDiagnostics,
    RAGHealthResponse,
    RetrievalRequest,
    RetrievalResponse,
    ScoredChunkResult,
    SourceRegistryItem,
)
from backend.app.ai.vector_store import IncompatibleEmbeddingDimensionError, QdrantVectorStore

__all__ = [
    "AIConfig",
    "get_ai_config",
    "SourceRegistryItem",
    "Document",
    "Chunk",
    "RetrievalRequest",
    "RetrievalResponse",
    "ScoredChunkResult",
    "RAGHealthResponse",
    "IndexingDiagnostics",
    "DocumentLoader",
    "DeterministicChunker",
    "EmbeddingProvider",
    "OllamaEmbeddingProvider",
    "GeminiEmbeddingProvider",
    "MockEmbeddingProvider",
    "get_embedding_provider",
    "QdrantVectorStore",
    "IncompatibleEmbeddingDimensionError",
    "RetrievalService",
    "IndexingService",
]
