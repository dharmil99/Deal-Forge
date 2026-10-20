"""
backend/app/ai/documents.py

Source Registry & Document Loader for DealForge Phase AI-1: RAG Research Pilot Foundation.
Maintains the authoritative registry of trusted internal DealForge documents and
implements deterministic document loading with error diagnostics.
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from backend.app.ai.schemas import Document, SourceRegistryItem

logger = logging.getLogger("dealforge.ai.documents")

# Workspace root
_WORKSPACE_ROOT = Path(__file__).resolve().parents[3]


# ---------------------------------------------------------------------------
# Authoritative DealForge Source Registry
# ---------------------------------------------------------------------------

DEFAULT_SOURCE_REGISTRY: List[SourceRegistryItem] = [
    SourceRegistryItem(
        document_id="DOC-DATA-DICT",
        document_name="DealForge Data Dictionary & Schema Invariants",
        document_type="data_dictionary",
        source_path="docs/data-dictionary.md",
        section="Dataset & Invariants",
        phase="Phase 1",
        version="1.0",
        source_type="system_documentation",
        created_at="2026-10-12",
    ),
    SourceRegistryItem(
        document_id="DOC-METH-VALUATION",
        document_name="Valuation Triangulation: Comps, Precedents & DCF Methodology",
        document_type="methodology",
        source_path="docs/methodology/valuation.md",
        section="Valuation",
        phase="Phase 3-5",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    ),
    SourceRegistryItem(
        document_id="DOC-METH-DEAL-STRUCTURING",
        document_name="Deal Structuring, Consideration & Premium Mechanics",
        document_type="methodology",
        source_path="docs/methodology/deal-structuring.md",
        section="Deal Structuring",
        phase="Phase 6",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    ),
    SourceRegistryItem(
        document_id="DOC-METH-SOURCES-USES",
        document_name="Sources & Uses of Funds & Funding Feasibility Methodology",
        document_type="methodology",
        source_path="docs/methodology/sources-uses.md",
        section="Sources & Uses",
        phase="Phase 7",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    ),
    SourceRegistryItem(
        document_id="DOC-METH-ACCRETION-DILUTION",
        document_name="Accretion / Dilution, Pro Forma EPS & Break-Even Synergy Methodology",
        document_type="methodology",
        source_path="docs/methodology/accretion-dilution.md",
        section="Accretion / Dilution",
        phase="Phase 8",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    ),
    SourceRegistryItem(
        document_id="DOC-METH-SCENARIOS-SENSITIVITY",
        document_name="Scenario & 1D/2D Sensitivity Analysis Methodology",
        document_type="methodology",
        source_path="docs/methodology/scenarios-sensitivity.md",
        section="Scenarios & Sensitivity",
        phase="Phase 9",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    ),
    SourceRegistryItem(
        document_id="DOC-METH-IC-GOVERNANCE",
        document_name="Investment Committee Governance & Data Quality Rules",
        document_type="governance",
        source_path="docs/methodology/ic-report-governance.md",
        section="Governance",
        phase="Cross-Phase",
        version="1.0",
        source_type="internal_specification",
        created_at="2026-10-20",
    ),
]


class DocumentLoader:
    """Deterministic loader for approved internal DealForge source documents."""

    def __init__(self, workspace_root: Optional[Path] = None) -> None:
        self.workspace_root = workspace_root or _WORKSPACE_ROOT

    def get_registered_documents(self) -> List[SourceRegistryItem]:
        """Return all approved documents in the source registry."""
        return list(DEFAULT_SOURCE_REGISTRY)

    def load_document(self, item: SourceRegistryItem) -> Document:
        """
        Load a single document from the filesystem.
        Raises ValueError if unreadable, missing, or malformed.
        """
        full_path = self.workspace_root / item.source_path
        if not full_path.exists():
            raise FileNotFoundError(f"Registered document missing at path: {full_path}")

        # Check supported file type
        if full_path.suffix.lower() not in [".md", ".txt", ".markdown"]:
            raise ValueError(f"Unsupported document format '{full_path.suffix}'. Only Markdown/Text permitted.")

        try:
            content = full_path.read_text(encoding="utf-8")
        except Exception as e:
            raise IOError(f"Failed to read document at {full_path}: {e}") from e

        if not content.strip():
            raise ValueError(f"Document at {full_path} is empty.")

        # Extract title from first markdown heading or fallback to document_name
        title = item.document_name
        for line in content.splitlines():
            line_str = line.strip()
            if line_str.startswith("# "):
                title = line_str[2:].strip()
                break

        return Document(
            metadata=item,
            title=title,
            content=content,
            char_count=len(content),
        )

    def load_all(
        self, registry: Optional[List[SourceRegistryItem]] = None
    ) -> Tuple[List[Document], List[str]]:
        """
        Load all registered documents, returning successfully loaded documents
        and a list of error diagnostics for any failures.
        """
        targets = registry or self.get_registered_documents()
        documents: List[Document] = []
        errors: List[str] = []

        for item in targets:
            try:
                doc = self.load_document(item)
                documents.append(doc)
                logger.info(f"Loaded document '{item.document_id}' ({doc.char_count} chars)")
            except Exception as e:
                err_msg = f"Failed to load '{item.document_id}' ({item.source_path}): {e}"
                errors.append(err_msg)
                logger.error(err_msg)

        return documents, errors
