"""
backend/app/ai/indexing.py

Deterministic document indexing pipeline for DealForge Phase AI-1: RAG Research Pilot Foundation.
Orchestrates: Document Discovery -> Loading -> Deterministic Chunking -> Vector Embedding -> Qdrant Upsert.
"""

import logging
from typing import List, Optional

from backend.app.ai.chunking import DeterministicChunker
from backend.app.ai.config import AIConfig, get_ai_config
from backend.app.ai.documents import DocumentLoader
from backend.app.ai.embeddings import EmbeddingProvider, get_embedding_provider
from backend.app.ai.schemas import IndexingDiagnostics, SourceRegistryItem
from backend.app.ai.vector_store import QdrantVectorStore

logger = logging.getLogger("dealforge.ai.indexing")


class IndexingService:
    """End-to-end indexing pipeline for trusted DealForge methodology documentation."""

    def __init__(
        self,
        document_loader: Optional[DocumentLoader] = None,
        chunker: Optional[DeterministicChunker] = None,
        embedding_provider: Optional[EmbeddingProvider] = None,
        vector_store: Optional[QdrantVectorStore] = None,
        config: Optional[AIConfig] = None,
    ) -> None:
        self.config = config or get_ai_config()
        self.document_loader = document_loader or DocumentLoader()
        self.chunker = chunker or DeterministicChunker(
            chunk_size=self.config.chunk_size,
            chunk_overlap=self.config.chunk_overlap,
        )
        self.embedding_provider = embedding_provider or get_embedding_provider(config=self.config)
        self.vector_store = vector_store or QdrantVectorStore(
            url=self.config.qdrant_url,
            api_key=self.config.qdrant_api_key,
            default_collection=self.config.qdrant_collection,
        )

    async def run_indexing(
        self,
        registry: Optional[List[SourceRegistryItem]] = None,
        recreate_collection: bool = False,
    ) -> IndexingDiagnostics:
        """
        Execute full indexing cycle over approved documentation.
        Returns comprehensive telemetry and diagnostics.
        """
        diagnostics = IndexingDiagnostics(
            embedding_provider=self.embedding_provider.provider_name,
            embedding_model=self.embedding_provider.model_name,
            qdrant_collection=self.vector_store.default_collection,
        )

        # 1. Discover registered documents
        targets = registry or self.document_loader.get_registered_documents()
        diagnostics.documents_discovered = len(targets)

        # 2. Load documents deterministically
        documents, load_errors = self.document_loader.load_all(targets)
        diagnostics.documents_loaded = len(documents)
        diagnostics.documents_failed = len(load_errors)
        diagnostics.errors.extend(load_errors)

        if not documents:
            logger.warning("No documents were loaded. Indexing aborted.")
            return diagnostics

        # 3. Deterministic chunking
        all_chunks = []
        for doc in documents:
            doc_chunks = self.chunker.chunk_document(doc)
            all_chunks.extend(doc_chunks)
            logger.info(f"Generated {len(doc_chunks)} chunks for document '{doc.metadata.document_id}'")

        diagnostics.chunks_generated = len(all_chunks)
        if not all_chunks:
            logger.warning("No chunks generated from loaded documents.")
            return diagnostics

        # 4. Initialize Qdrant collection with dimension validation
        await self.vector_store.init_collection(
            vector_size=self.embedding_provider.dimension,
            recreate_if_incompatible=recreate_collection,
        )

        # 5. Generate vector embeddings in batch
        chunk_texts = [c.content for c in all_chunks]
        try:
            vectors = await self.embedding_provider.embed_batch(chunk_texts)
            diagnostics.vectors_generated = len(vectors)
        except Exception as e:
            err = f"Failed to generate embeddings via {self.embedding_provider.provider_name}: {e}"
            logger.error(err)
            diagnostics.errors.append(err)
            return diagnostics

        # 6. Upsert vectors and metadata payloads into Qdrant
        try:
            upserted_count = await self.vector_store.upsert_chunks(
                chunks=all_chunks,
                vectors=vectors,
            )
            diagnostics.vectors_indexed = upserted_count
        except Exception as e:
            err = f"Failed to upsert points into Qdrant: {e}"
            logger.error(err)
            diagnostics.errors.append(err)
            return diagnostics

        logger.info(
            f"Indexing complete: {diagnostics.documents_loaded} docs, "
            f"{diagnostics.chunks_generated} chunks, {diagnostics.vectors_indexed} indexed."
        )
        return diagnostics
