"""
backend/app/ai/chunking.py

Deterministic Markdown chunker for DealForge Phase AI-1: RAG Research Pilot Foundation.
Preserves section headings, maintains table integrity, and produces stable chunk IDs.
"""

import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple

from backend.app.ai.schemas import Chunk, Document


class DeterministicChunker:
    """
    Deterministic Markdown chunker designed for financial and methodology documentation.
    - Preserves logical heading hierarchy and injects breadcrumb context.
    - Prevents markdown tables from being split across chunks.
    - Emits stable, repeatable chunk IDs based on document ID, section, index, and content hash.
    - Avoids duplicate chunks.
    """

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 100) -> None:
        self.chunk_size = max(50, chunk_size)
        self.chunk_overlap = min(chunk_overlap, self.chunk_size // 2)

    def chunk_document(self, document: Document) -> List[Chunk]:
        """Split a document into deterministic, context-rich chunks."""
        blocks = self._parse_markdown_blocks(document.content)
        chunks: List[Chunk] = []

        current_heading_path = [document.title]
        current_blocks: List[str] = []
        current_char_len = 0
        chunk_idx = 0
        seen_hashes = set()

        def build_chunk(blocks_to_join: List[str], heading_str: str) -> Optional[Chunk]:
            nonlocal chunk_idx
            raw_text = "\n\n".join(blocks_to_join).strip()
            if not raw_text:
                return None

            content_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()[:8]
            if content_hash in seen_hashes:
                return None
            seen_hashes.add(content_hash)

            # Prepend breadcrumb context so chunk is self-contained when retrieved
            context_prefix = f"[{document.title} > {heading_str}]\n\n"
            full_content = context_prefix + raw_text

            # Stable, deterministic chunk ID
            chunk_id = f"{document.metadata.document_id}-C{chunk_idx:03d}-{content_hash}"
            chunk_idx += 1

            chunk_meta: Dict[str, Any] = {
                "document_id": document.metadata.document_id,
                "document_name": document.metadata.document_name,
                "document_type": document.metadata.document_type,
                "section": document.metadata.section,
                "section_heading": heading_str,
                "phase": document.metadata.phase,
                "version": document.metadata.version,
                "source_type": document.metadata.source_type,
                "source_path": document.metadata.source_path,
                "created_at": document.metadata.created_at,
                "chunk_index": chunk_idx - 1,
            }
            # Optional metadata fields
            if document.metadata.company:
                chunk_meta["company"] = document.metadata.company
            if document.metadata.deal:
                chunk_meta["deal"] = document.metadata.deal
            if document.metadata.sector:
                chunk_meta["sector"] = document.metadata.sector

            return Chunk(
                chunk_id=chunk_id,
                document_id=document.metadata.document_id,
                document_name=document.metadata.document_name,
                section=document.metadata.section,
                section_heading=heading_str,
                content=full_content,
                raw_content=raw_text,
                chunk_index=chunk_idx - 1,
                metadata=chunk_meta,
            )

        for block_type, text, heading_level, heading_text in blocks:
            if block_type == "heading":
                # Flush existing chunk before changing major section if we have accumulated content
                if current_blocks and current_char_len >= (self.chunk_size // 2):
                    c = build_chunk(current_blocks, " > ".join(current_heading_path))
                    if c:
                        chunks.append(c)
                    current_blocks = []
                    current_char_len = 0

                # Update heading breadcrumbs
                idx = heading_level - 1
                if idx < len(current_heading_path):
                    current_heading_path = current_heading_path[:idx] + [heading_text]
                else:
                    current_heading_path.append(heading_text)
                continue

            # Regular text or table block
            block_len = len(text)
            if current_char_len + block_len > self.chunk_size and current_blocks:
                # Chunk size reached; flush current chunk
                c = build_chunk(current_blocks, " > ".join(current_heading_path))
                if c:
                    chunks.append(c)

                # Overlap handling: retain the last block if it fits within overlap limit
                last_block = current_blocks[-1]
                if len(last_block) <= self.chunk_overlap:
                    current_blocks = [last_block, text]
                    current_char_len = len(last_block) + block_len
                else:
                    current_blocks = [text]
                    current_char_len = block_len
            else:
                current_blocks.append(text)
                current_char_len += block_len

        # Final flush
        if current_blocks:
            c = build_chunk(current_blocks, " > ".join(current_heading_path))
            if c:
                chunks.append(c)

        return chunks

    def _parse_markdown_blocks(self, content: str) -> List[Tuple[str, str, int, str]]:
        """
        Parse markdown content into discrete logical units:
        Returns list of (block_type, text, heading_level, heading_text).
        block_type: 'heading', 'table', 'paragraph'
        """
        lines = content.splitlines()
        blocks: List[Tuple[str, str, int, str]] = []
        i = 0
        n = len(lines)

        while i < n:
            line = lines[i].rstrip()
            stripped = line.strip()

            # Empty lines
            if not stripped:
                i += 1
                continue

            # Heading
            heading_match = re.match(r"^(#{1,6})\s+(.*)$", stripped)
            if heading_match:
                level = len(heading_match.group(1))
                h_text = heading_match.group(2).strip()
                blocks.append(("heading", stripped, level, h_text))
                i += 1
                continue

            # Table detection (starts with | or contains |)
            if stripped.startswith("|") and stripped.endswith("|"):
                table_lines = []
                while i < n and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                    table_lines.append(lines[i].strip())
                    i += 1
                table_text = "\n".join(table_lines)
                blocks.append(("table", table_text, 0, ""))
                continue

            # Standard paragraph / bullet list / blockquote
            para_lines = []
            while i < n and lines[i].strip() and not re.match(r"^#{1,6}\s+", lines[i].strip()) and not (lines[i].strip().startswith("|") and lines[i].strip().endswith("|")):
                para_lines.append(lines[i].rstrip())
                i += 1
            para_text = "\n".join(para_lines).strip()
            if para_text:
                blocks.append(("paragraph", para_text, 0, ""))

        return blocks
