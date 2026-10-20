"""
tests/test_ai_chunking.py

Unit tests for DealForge Phase AI-1: Deterministic Chunking.
Validates stable chunk IDs, table preservation, heading hierarchy breadcrumbs, and overlap.
"""

from backend.app.ai.chunking import DeterministicChunker
from backend.app.ai.documents import DocumentLoader
from backend.app.ai.schemas import Document, SourceRegistryItem


def test_chunking_stable_ids():
    """Verify that chunk IDs are strictly deterministic and reproducible."""
    loader = DocumentLoader()
    doc = loader.load_document(loader.get_registered_documents()[0])

    chunker1 = DeterministicChunker(chunk_size=500, chunk_overlap=50)
    chunks1 = chunker1.chunk_document(doc)

    chunker2 = DeterministicChunker(chunk_size=500, chunk_overlap=50)
    chunks2 = chunker2.chunk_document(doc)

    assert len(chunks1) > 0
    assert len(chunks1) == len(chunks2)

    for c1, c2 in zip(chunks1, chunks2):
        assert c1.chunk_id == c2.chunk_id
        assert c1.content == c2.content
        assert c1.chunk_index == c2.chunk_index
        assert c1.document_id == doc.metadata.document_id


def test_chunking_heading_breadcrumbs_preservation():
    """Verify that section headings are preserved as breadcrumb prefixes."""
    content = """# DealForge Master Valuation

## Section 1: DCF Analysis

### Sub-item: Terminal Value
This describes the perpetual growth formula and Gordon Growth Model in full detail for institutional discounted cash flow valuation models.

### Sub-item: WACC Discounting
This describes the Capital Asset Pricing Model (CAPM) and weighted average cost of capital estimation used throughout DealForge.
"""
    item = SourceRegistryItem(
        document_id="DOC-TEST-HEADINGS",
        document_name="Test Headings",
        document_type="methodology",
        source_path="test.md",
        section="Valuation",
        phase="Phase 4.5",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    )
    doc = Document(
        metadata=item,
        title="DealForge Master Valuation",
        content=content,
        char_count=len(content),
    )

    chunker = DeterministicChunker(chunk_size=100, chunk_overlap=20)
    chunks = chunker.chunk_document(doc)

    assert len(chunks) >= 2
    for c in chunks:
        assert c.content.startswith("[DealForge Master Valuation >")
        assert "DCF Analysis" in c.content


def test_chunking_preserves_tables_intact():
    """Verify that markdown tables are kept intact and not split midway."""
    content = """# Data Dictionary

Here is the financial metrics mapping table:

| Field | Type | Source | Notes |
|---|---|---|---|
| revenue | float | Sales | INR Cr |
| ebitda_derived | float | PBT - Other Income + D&A + Interest | Core operational EBITDA |
| net_debt_derived | float | total_debt - cash | Definitional net debt |
| tax | float | Tax expense | Corporate income tax |

Post table commentary goes here.
"""
    item = SourceRegistryItem(
        document_id="DOC-TEST-TABLE",
        document_name="Table Test",
        document_type="data_dictionary",
        source_path="test_table.md",
        section="Data",
        phase="Phase 1",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    )
    doc = Document(
        metadata=item,
        title="Data Dictionary",
        content=content,
        char_count=len(content),
    )

    chunker = DeterministicChunker(chunk_size=400, chunk_overlap=50)
    chunks = chunker.chunk_document(doc)

    # Find the chunk containing the table
    table_chunk = next((c for c in chunks if "| ebitda_derived |" in c.content), None)
    assert table_chunk is not None
    # Verify the entire table header and rows are present
    assert "| Field | Type |" in table_chunk.content
    assert "| net_debt_derived |" in table_chunk.content
    assert "| tax |" in table_chunk.content


def test_chunking_no_duplicate_chunks():
    """Verify that no identical chunks are emitted."""
    content = """# Repeated Header

Same content block here.

Same content block here.
"""
    item = SourceRegistryItem(
        document_id="DOC-TEST-DUP",
        document_name="Dup Test",
        document_type="methodology",
        source_path="test_dup.md",
        section="Test",
        phase="Phase 1",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    )
    doc = Document(
        metadata=item,
        title="Repeated Header",
        content=content,
        char_count=len(content),
    )

    chunker = DeterministicChunker(chunk_size=200, chunk_overlap=0)
    chunks = chunker.chunk_document(doc)

    chunk_ids = [c.chunk_id for c in chunks]
    assert len(chunk_ids) == len(set(chunk_ids))
