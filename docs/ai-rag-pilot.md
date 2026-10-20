# DealForge Phase AI-1: RAG Research Pilot Foundation

> **Document Type:** AI & RAG Subsystem Architectural Blueprint & Reference  
> **Phase:** AI-1 (Pilot Foundation — Evidence Retrieval Only)  
> **Status:** Active & Implemented  
> **Workspace Root:** `dealforge/`  

---

## Core System Principle

> [!IMPORTANT]
> **RAG retrieves evidence.**  
> **DealForge deterministic services provide financial truth.**  
> **The LLM will explain evidence in AI-2.**  
>
> Under no circumstances does the AI/RAG layer calculate, alter, or approximate financial metrics. Financial calculations (valuation, DCF, screening, Sources & Uses, Accretion/Dilution, scenarios, sensitivities) are strictly performed by the audited mathematical modules in `analytics/`.

---

## 1. System Architecture

DealForge Phase AI-1 establishes a provider-agnostic, deterministic Retrieval-Augmented Generation (RAG) foundation. The subsystem indexes trusted internal methodology documentation and surfaces high-precision evidence chunks for corporate finance queries.

```
                           DEALFORGE WORKSTATION
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
     Deterministic Financial Subsystem        AI & RAG Subsystem (Phase AI-1)
                 │                                       │
         analytics/ Modules                    Trusted Documentation
     (Comps, DCF, S&U, A/D, Scenarios)                   │
                 │                                Document Loading
           FastAPI Routes                                │
    (/api/v1/deals, /api/v1/screening)          Deterministic Chunking
                 │                                       │
                 │                              Embedding Provider
                 │                          ┌────────────┴────────────┐
                 │                          │                         │
                 │                     Local Ollama             Remote Gemini
                 │                          │                         │
                 │                          └────────────┬────────────┘
                 │                                       │
                 │                              Qdrant Vector Store
                 │                             (dealforge_methodology)
                 │                                       │
                 │                                Semantic Search
                 │                                       │
                 │                               Retrieved Evidence
                 │                         (/api/v1/ai/research/retrieve)
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     │
                             Future Phase AI-2
                          (Gemini LLM Synthesis)
```

---

## 2. Source Material & Registry

The RAG foundation indexes **strictly trusted internal DealForge documentation**. It does NOT ingest external websites, unverified news, frontend source code, or generated PDFs.

### Active Source Registry (`backend/app/ai/documents.py`)

| Document ID | Name | Source Path | Phase | Functional Area |
|---|---|---|---|---|
| `DOC-DATA-DICT` | Data Dictionary & Invariants | `docs/data-dictionary.md` | Phase 1 | Dataset & Invariants |
| `DOC-METH-VALUATION` | Valuation Triangulation & Football Field | `docs/methodology/valuation.md` | Phase 3–5 | Valuation & Comps |
| `DOC-METH-DEAL-STRUCTURING` | Deal Structuring & Consideration Mix | `docs/methodology/deal-structuring.md` | Phase 6 | Deal Builder |
| `DOC-METH-SOURCES-USES` | Sources & Uses & Funding Feasibility | `docs/methodology/sources-uses.md` | Phase 7 | Sources & Uses |
| `DOC-METH-ACCRETION-DILUTION` | Pro Forma EPS & Break-Even Synergy | `docs/methodology/accretion-dilution.md` | Phase 8 | Accretion / Dilution |
| `DOC-METH-SCENARIOS-SENSITIVITY` | Scenario & 1D/2D Sensitivity Analysis | `docs/methodology/scenarios-sensitivity.md` | Phase 9 | Scenarios & Risk |
| `DOC-METH-IC-GOVERNANCE` | IC Governance & Data Quality Rules | `docs/methodology/ic-report-governance.md` | Cross-Phase | Committee Governance |

Each registered document preserves structured metadata:
- `document_id`: Unique identifier
- `document_name`: Institutional title
- `document_type`: `methodology`, `data_dictionary`, or `governance`
- `source_path`: Relative workspace path
- `section`: Primary category
- `phase`: Associated DealForge development phase
- `version`: Document version string
- `source_type`: `internal_specification` or `system_documentation`
- `created_at`: Revision date
- Extensible fields for future deal indexing: `company`, `deal`, `sector`, `document_date`, `source_url`

---

## 3. Deterministic Chunking Strategy

Implemented in `backend/app/ai/chunking.py`:
- **Markdown-Aware Block Parsing**: Identifies structural headings (`#`, `##`, `###`), tables, and paragraphs.
- **Heading Breadcrumb Injection**: Every chunk prepends document and section hierarchy:
  ```
  [Document Title > Section Heading > Subsection Heading]

  Chunk text content...
  ```
- **Table Integrity Guarantee**: Markdown tables are treated as atomic units. Tables are never split midway, ensuring complete financial matrices and formulas remain intact.
- **Configurable Sizing & Overlap**: Default chunk size of `800` characters with `100` characters overlap.
- **Deterministic Chunk IDs**: Emits reproducible IDs formatted as:
  ```
  {document_id}-C{chunk_index:03d}-{content_hash[:8]}
  ```
  Re-indexing identical documents guarantees identical chunk IDs across runs.
- **Deduplication**: Identical content blocks are deduplicated to prevent redundant vector storage.

---

## 4. Provider-Agnostic Embedding Architecture

The embedding layer (`backend/app/ai/embeddings/`) decouples vector generation from the storage and retrieval engine.

```
                  EmbeddingProvider (ABC)
                             │
     ┌───────────────────────┼───────────────────────┐
     │                       │                       │
OllamaEmbeddingProvider  GeminiEmbeddingProvider  MockEmbeddingProvider
 (Local nomic-embed)      (Remote google-genai)   (Hermetic Unit Tests)
```

### Supported Providers

1. **Ollama (`OllamaEmbeddingProvider`)**:
   - **Protocol**: Asynchronous HTTP client communicating with local Ollama daemon via the modern `POST /api/embed` endpoint.
   - **Payload**: `{"model": "...", "input": "..."}` for single embeddings and `{"model": "...", "input": ["...", "..."]}` for batch embeddings.
   - **Response**: Extracts vectors from `response["embeddings"]`.
   - **Default Model**: `nomic-embed-text` (768 dimensions).
   - **Configuration**: `OLLAMA_BASE_URL` (default: `http://localhost:11434`), `RAG_EMBEDDING_MODEL`.
   - **Dimension Safety**: Enforces returned vector size matches configured dimension; raises `EmbeddingDimensionError` on mismatch without mutating configured dimension.
   - **Error Handling**: Explicit `EmbeddingProviderUnavailableError` if daemon is stopped or unreachable. Never silently falls back.

2. **Google Gemini (`GeminiEmbeddingProvider`)**:
   - **SDK**: Official `google-genai` SDK (`genai.Client`).
   - **Default Model**: `gemini-embedding-2` (supports 768, 1536, 3072 output dimensions; default: 3072).
   - **Configuration**: `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, `GEMINI_EMBEDDING_DIMENSION`.
   - **Dimension Safety**: Strict dimension contract. Verifies returned vector dimension matches configured `dimension`; raises `EmbeddingDimensionError` on mismatch without mutating configured dimension.
   - **Security**: Credentials are read strictly from environment variables. API keys are never logged, committed, or exposed via diagnostics.
   - **Error Handling**: Differentiates authentication failures (`EmbeddingAuthError`), rate limits (`429 RESOURCE_EXHAUSTED`), model not found (`EmbeddingModelError`), and network timeouts.

3. **Mock Provider (`MockEmbeddingProvider`)**:
   - Used for zero-dependency hermetic unit testing. Produces normalized pseudo-semantic vectors based on term hashing.

---

## 5. Embedding Consistency & Dimension Invariant

> [!WARNING]
> Different embedding models generate vectors of differing dimensions (e.g., 384 vs 768 vs 1024). Storing vectors of conflicting sizes within the same Qdrant collection causes database corruption.

DealForge enforces **strict embedding consistency**:
1. When `QdrantVectorStore.init_collection()` executes, it queries the target collection's existing vector dimension.
2. If the collection exists and its dimension does not match the active embedding provider's output dimension, the system raises `IncompatibleEmbeddingDimensionError`:
   `"Collection 'dealforge_methodology' has vector dimension 384, which conflicts with active provider dimension 768. Re-indexing required."`
3. Silent vector mixing or corruption is mathematically prevented.

---

## 6. Qdrant Vector Store Integration

Implemented in `backend/app/ai/vector_store.py`:
- **Default Endpoint**: `http://localhost:6333` (or in-memory `:memory:` for testing).
- **Default Collection**: `dealforge_methodology`.
- **Distance Metric**: Cosine distance (`Distance.COSINE`).
- **Point Payload**:
  - `chunk_id`: Deterministic chunk identifier
  - `document_id`: Provenance document
  - `document_name`: Source document title
  - `section`: Functional section
  - `section_heading`: Specific subsection heading
  - `content`: Enriched text with breadcrumbs
  - `raw_content`: Unmodified markdown snippet
  - `chunk_index`: Position integer
  - Complete document metadata dictionary
- **Metadata Filtering**: Supports exact match filtering on `phase`, `document_type`, `document_id`, `section`, etc.

---

## 7. Retrieval Service & API

### API Endpoints (`backend/app/api/v1/ai.py`)

#### 1. Evidence Retrieval
`POST /api/v1/ai/research/retrieve`
- **Request**:
  ```json
  {
    "query": "Why is precedent EV/EBITDA unavailable?",
    "top_k": 5,
    "filters": {
      "phase": "Phase 3-5"
    }
  }
  ```
- **Response**:
  ```json
  {
    "query": "Why is precedent EV/EBITDA unavailable?",
    "results": [
      {
        "chunk_id": "DOC-METH-VALUATION-C003-8f2a1b0c",
        "document_id": "DOC-METH-VALUATION",
        "document_name": "Valuation Triangulation: Comps, Precedents & DCF Methodology",
        "section": "Valuation",
        "section_heading": "2. Precedent Transactions Analysis > Important Analytical Limitation: Precedent EV/EBITDA",
        "content": "[Valuation Triangulation > 2. Precedent Transactions Analysis] In historical Indian public M&A filings, target companies frequently do not disclose audited EBITDA specifically for the acquisition perimeter...",
        "similarity_score": 0.8841,
        "metadata": {
          "phase": "Phase 3-5",
          "document_type": "methodology"
        }
      }
    ],
    "retrieval_count": 1,
    "provider": "ollama",
    "model": "nomic-embed-text"
  }
  ```

#### 2. Subsystem Health & Diagnostics
`GET /api/v1/ai/research/health`
- Reports status of configured embedding provider, Ollama connectivity, Gemini credentials, Qdrant database status, and indexed vector counts.

#### 3. Administrative Indexing Trigger
`POST /api/v1/ai/research/index?recreate=false`
- Triggers deterministic loading, chunking, embedding, and Qdrant upsert across all approved registry documents.

---

## 8. Pilot Retrieval Quality Verification

The RAG foundation was verified against the 5 canonical DealForge corporate finance queries without using an LLM:

1. **"Why is precedent EV/EBITDA unavailable?"**  
   → Successfully retrieves `DOC-METH-VALUATION` and `DOC-METH-IC-GOVERNANCE` disclosing target EBITDA non-disclosure in Indian public M&A filings.
2. **"What assumptions does the DCF use?"**  
   → Successfully retrieves `DOC-METH-VALUATION` surfacing WACC (CAPM), 5.0% perpetual growth, and 5-year discrete UFCF formulas.
3. **"How does DealForge calculate accretion/dilution?"**  
   → Successfully retrieves `DOC-METH-ACCRETION-DILUTION` surfacing Pro Forma Net Income, share issuance, after-tax synergies, and EPS formulas.
4. **"How does DealForge determine funding feasibility?"**  
   → Successfully retrieves `DOC-METH-SOURCES-USES` surfacing usable cash buffers, funding shortfall, and cash deficit mechanics.
5. **"What are the known dataset limitations?"**  
   → Successfully retrieves `DOC-METH-IC-GOVERNANCE` and `DOC-DATA-DICT` disclosing 113 company sample depth and statutory filing boundaries.

---

## 9. Environment Variables Configuration

Copy `.env.example` to `.env`:
```bash
# RAG Enablement
RAG_ENABLED=true

# Embedding Provider Selection ('ollama' or 'gemini')
RAG_EMBEDDING_PROVIDER=ollama
RAG_EMBEDDING_MODEL=nomic-embed-text

# Ollama Endpoint
OLLAMA_BASE_URL=http://localhost:11434

# Gemini Credentials (required if RAG_EMBEDDING_PROVIDER=gemini)
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
GEMINI_EMBEDDING_DIMENSION=3072

# Qdrant Vector DB
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=dealforge_methodology
QDRANT_API_KEY=

# Chunking Parameters
RAG_CHUNK_SIZE=800
RAG_CHUNK_OVERLAP=100
```

---

## 10. AI-2 Transition Plan

Phase AI-1 is strictly confined to the backend retrieval foundation. When moving to Phase AI-2, the system will introduce:
1. **Gemini LLM Answer Generation**: Synthesizing evidence chunks into formal investment banking commentary.
2. **Research Copilot UI**: Interactive sidebar and workspace modal in the DealForge frontend.
3. **Financial State Injection**: Injecting live, deterministic model snapshots from DealForge APIs into the LLM context alongside retrieved methodology chunks.
