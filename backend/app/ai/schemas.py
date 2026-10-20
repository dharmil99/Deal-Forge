"""
backend/app/ai/schemas.py

Pydantic schemas for DealForge Phase AI-1: RAG Research Pilot Foundation.
Strictly typed data models for:
- Source Registry metadata
- Document and Chunk representations
- Retrieval requests, scored results, and responses
- Provider health diagnostics and indexing telemetry
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Source Registry & Document Schemas
# ---------------------------------------------------------------------------

class SourceRegistryItem(BaseModel):
    """Metadata specification for an approved DealForge source document."""
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., description="Unique document identifier (e.g., DOC-METH-VALUATION)")
    document_name: str = Field(..., description="Institutional human-readable document name")
    document_type: str = Field(..., description="Type: methodology, data_dictionary, architecture_audit, governance")
    source_path: str = Field(..., description="Relative file path from workspace root")
    section: str = Field(..., description="Functional area: Valuation, Deal Structuring, Governance, Dataset")
    phase: str = Field(..., description="Applicable DealForge phase: Phase 1-9, Cross-Phase")
    version: str = Field("1.0", description="Document version string")
    source_type: str = Field("internal_specification", description="Source classification: internal_specification, system_documentation, audit_report")
    created_at: str = Field(..., description="ISO creation/revision date")

    # Extensible future metadata fields
    company: Optional[str] = Field(None, description="Optional associated company")
    deal: Optional[str] = Field(None, description="Optional associated deal")
    sector: Optional[str] = Field(None, description="Optional associated sector")
    document_date: Optional[str] = Field(None, description="Optional publication date")
    source_url: Optional[str] = Field(None, description="Optional external/internal URL reference")


class Document(BaseModel):
    """Loaded and validated in-memory document with content and metadata."""
    model_config = ConfigDict(extra="forbid")

    metadata: SourceRegistryItem
    title: str = Field(..., description="Extracted document title")
    content: str = Field(..., description="Full text/markdown content")
    char_count: int = Field(..., description="Character count")


# ---------------------------------------------------------------------------
# Chunking Schemas
# ---------------------------------------------------------------------------

class Chunk(BaseModel):
    """Deterministic document chunk with preserved context and stable ID."""
    model_config = ConfigDict(extra="forbid")

    chunk_id: str = Field(..., description="Deterministic stable chunk identifier")
    document_id: str = Field(..., description="Parent document identifier")
    document_name: str = Field(..., description="Parent document name")
    section: str = Field(..., description="Primary section category")
    section_heading: str = Field("", description="Nearest heading context for the chunk")
    content: str = Field(..., description="Chunk text content including contextual breadcrumb")
    raw_content: str = Field(..., description="Chunk text content without prepended breadcrumbs")
    chunk_index: int = Field(..., description="0-indexed position within the document")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata payload for filtering")


# ---------------------------------------------------------------------------
# Retrieval Schemas
# ---------------------------------------------------------------------------

class RetrievalRequest(BaseModel):
    """Semantic search query request for DealForge RAG layer."""
    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., min_length=2, max_length=1000, description="Analytical query text")
    top_k: int = Field(5, ge=1, le=20, description="Maximum number of evidence chunks to retrieve")
    filters: Optional[Dict[str, Any]] = Field(None, description="Optional metadata filter predicates (e.g. phase, document_type)")


class ScoredChunkResult(BaseModel):
    """Retrieved evidence chunk with similarity scoring and full provenance."""
    model_config = ConfigDict(extra="forbid")

    chunk_id: str = Field(..., description="Unique chunk identifier")
    document_id: str = Field(..., description="Source document identifier")
    document_name: str = Field(..., description="Source document name")
    section: str = Field(..., description="Functional section category")
    section_heading: str = Field("", description="Section heading context")
    content: str = Field(..., description="Retrieved evidence text")
    similarity_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Complete chunk metadata")


class RetrievalResponse(BaseModel):
    """Structured response containing retrieved evidence and telemetry."""
    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., description="Original search query")
    results: List[ScoredChunkResult] = Field(..., description="Ranked evidence results")
    retrieval_count: int = Field(..., description="Number of results returned")
    provider: str = Field(..., description="Active embedding provider name")
    model: str = Field(..., description="Active embedding model name")


# ---------------------------------------------------------------------------
# Health & Diagnostics Schemas
# ---------------------------------------------------------------------------

class ProviderHealthStatus(BaseModel):
    """Individual embedding provider availability diagnostic."""
    provider: str
    model: str
    available: bool
    dimension: Optional[int] = None
    error_message: Optional[str] = None


class RAGHealthResponse(BaseModel):
    """System health diagnostic for AI/RAG infrastructure."""
    status: str = Field(..., description="'ok', 'degraded', or 'unavailable'")
    rag_enabled: bool = Field(..., description="Whether RAG subsystem is active")
    embedding_provider: str = Field(..., description="Configured embedding provider")
    embedding_model: str = Field(..., description="Configured embedding model")
    embedding_dimension: Optional[int] = Field(None, description="Active vector dimension")
    ollama_available: bool = Field(False, description="Ollama endpoint availability")
    gemini_available: bool = Field(False, description="Gemini API availability")
    qdrant_available: bool = Field(False, description="Qdrant vector database availability")
    qdrant_collection: str = Field(..., description="Target Qdrant collection name")
    indexed_document_count: int = Field(0, description="Count of documents currently indexed")
    indexed_chunk_count: int = Field(0, description="Count of vector chunks currently in collection")
    diagnostics_notes: List[str] = Field(default_factory=list, description="System notes or error details")


class IndexingDiagnostics(BaseModel):
    """Telemetry report produced by the document indexing pipeline."""
    documents_discovered: int = 0
    documents_loaded: int = 0
    documents_failed: int = 0
    chunks_generated: int = 0
    vectors_generated: int = 0
    vectors_indexed: int = 0
    embedding_provider: str = ""
    embedding_model: str = ""
    qdrant_collection: str = ""
    errors: List[str] = Field(default_factory=list)
