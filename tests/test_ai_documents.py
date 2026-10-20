"""
tests/test_ai_documents.py

Unit tests for DealForge Phase AI-1: Document Loader & Source Registry.
Validates deterministic loading, error handling for malformed/missing files, and metadata preservation.
"""

from pathlib import Path
import pytest

from backend.app.ai.documents import DEFAULT_SOURCE_REGISTRY, DocumentLoader
from backend.app.ai.schemas import SourceRegistryItem


def test_source_registry_completeness():
    """Verify that all core DealForge methodology areas are represented in the registry."""
    doc_ids = {item.document_id for item in DEFAULT_SOURCE_REGISTRY}
    assert "DOC-DATA-DICT" in doc_ids
    assert "DOC-METH-VALUATION" in doc_ids
    assert "DOC-METH-DEAL-STRUCTURING" in doc_ids
    assert "DOC-METH-SOURCES-USES" in doc_ids
    assert "DOC-METH-ACCRETION-DILUTION" in doc_ids
    assert "DOC-METH-SCENARIOS-SENSITIVITY" in doc_ids
    assert "DOC-METH-IC-GOVERNANCE" in doc_ids

    for item in DEFAULT_SOURCE_REGISTRY:
        assert item.document_name
        assert item.source_path.endswith((".md", ".txt"))
        assert item.section
        assert item.phase
        assert item.version
        assert item.created_at


def test_document_loader_loads_all_registered_docs():
    """Verify that all approved registered documents exist and load successfully."""
    loader = DocumentLoader()
    docs, errors = loader.load_all()

    assert len(errors) == 0, f"Encountered document load errors: {errors}"
    assert len(docs) == len(DEFAULT_SOURCE_REGISTRY)

    for doc in docs:
        assert doc.title
        assert len(doc.content) > 100
        assert doc.char_count == len(doc.content)
        assert doc.metadata.document_id in [item.document_id for item in DEFAULT_SOURCE_REGISTRY]


def test_document_loader_missing_file_handling(tmp_path: Path):
    """Verify that missing files raise FileNotFoundError."""
    loader = DocumentLoader(workspace_root=tmp_path)
    fake_item = SourceRegistryItem(
        document_id="DOC-TEST-MISSING",
        document_name="Missing Document",
        document_type="methodology",
        source_path="nonexistent.md",
        section="Test",
        phase="Phase 1",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    )
    with pytest.raises(FileNotFoundError, match="missing at path"):
        loader.load_document(fake_item)


def test_document_loader_empty_file_handling(tmp_path: Path):
    """Verify that empty files raise ValueError with clear error message."""
    empty_file = tmp_path / "empty.md"
    empty_file.write_text("   \n\n  ", encoding="utf-8")

    loader = DocumentLoader(workspace_root=tmp_path)
    fake_item = SourceRegistryItem(
        document_id="DOC-TEST-EMPTY",
        document_name="Empty Document",
        document_type="methodology",
        source_path="empty.md",
        section="Test",
        phase="Phase 1",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    )
    with pytest.raises(ValueError, match="is empty"):
        loader.load_document(fake_item)


def test_document_loader_unsupported_extension_handling(tmp_path: Path):
    """Verify that non-markdown/text files are rejected."""
    bin_file = tmp_path / "data.pdf"
    bin_file.write_bytes(b"%PDF-1.4...")

    loader = DocumentLoader(workspace_root=tmp_path)
    fake_item = SourceRegistryItem(
        document_id="DOC-TEST-PDF",
        document_name="PDF Document",
        document_type="methodology",
        source_path="data.pdf",
        section="Test",
        phase="Phase 1",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    )
    with pytest.raises(ValueError, match="Unsupported document format"):
        loader.load_document(fake_item)


def test_document_loader_load_all_partial_failure(tmp_path: Path):
    """Verify load_all returns valid docs and error list without crashing."""
    valid_file = tmp_path / "valid.md"
    valid_file.write_text("# Valid Title\n\nContent here.", encoding="utf-8")

    loader = DocumentLoader(workspace_root=tmp_path)
    item_valid = SourceRegistryItem(
        document_id="DOC-VALID",
        document_name="Valid",
        document_type="methodology",
        source_path="valid.md",
        section="Test",
        phase="Phase 1",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    )
    item_missing = SourceRegistryItem(
        document_id="DOC-MISSING",
        document_name="Missing",
        document_type="methodology",
        source_path="missing.md",
        section="Test",
        phase="Phase 1",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    )

    docs, errors = loader.load_all([item_valid, item_missing])
    assert len(docs) == 1
    assert docs[0].metadata.document_id == "DOC-VALID"
    assert len(errors) == 1
    assert "DOC-MISSING" in errors[0]
