# DealForge Investment Committee Governance & Data Quality Rules

## Overview

The Investment Committee (IC) Report synthesizes deterministic model outputs into an executive transaction memorandum. This document outlines the governance principles, data quality invariants, and methodology disclosures required for institutional review.

---

## 1. Core Architecture Invariants

### Deterministic Financial Engine as Ground Truth
- All financial numbers presented in DealForge reports originate exclusively from deterministic mathematical modules (`analytics/`).
- **No LLM or AI system is permitted to calculate, approximate, or modify financial metrics.**
- The AI & RAG layer serves solely to retrieve authoritative documentation, methodology context, and qualitative evidence.

### Economic Result vs. Execution Feasibility
- DealForge maintains a strict boundary between:
  1. **Illustrative Economic Outcome**: What the mathematical model calculates if all financing commitments were funded.
  2. **Executable Transaction**: A deal whose Sources & Uses schedule contains zero funding shortfall against available liquidity.
  3. **Infeasible Transaction**: A deal where requested cash consideration exceeds available acquirer liquidity buffer.
- An infeasible deal that produces positive pro forma accretion is **never approved or labeled as viable**. It must be explicitly qualified:
  `"Illustrative structure is accretive, but requested funding is infeasible."`

---

## 2. Institutional Dataset & Governance Disclosures

Every IC Report discloses the following operational boundaries:

### Universe Coverage
- **113 Companies Covered**: Sourced from audited statutory filings and Screener.in data sheets.
- **Up to 10 Years Historical Financials**: Standardized financial statements from FY2013 to FY2026.
- **Audited Financial Reporting**: Financial metrics reflect standalone audited statements; unconsolidated subsidiary debt is noted where applicable.

### Precedent Transaction Limitations
- **4 Sourced Precedents**: Historical transaction database is limited to verified, sourced Indian acquisitions.
- **Target EBITDA Non-Disclosure**: In public Indian M&A transaction filings, target company EBITDA for the specific acquired perimeter was undisclosed at deal announcement.
- **Multiple Reliability**: Precedent EV/EBITDA multiples are officially unavailable. Valuation triangulation relies on Trading Comparables (P/E, EV/EBITDA, EV/Sales) and DCF intrinsic valuation.

### Modeling Boundaries
- **Tax Rate Benchmark**: Standard corporate income tax benchmark of 25.0% applies to operational synergies, interest deductions, and earnings contributions unless company-specific effective tax rates are overridden.
- **Stand-alone EPS Horizon**: Projections reflect 3 fiscal years post-closing with standardized synergy realization ramps (33% / 67% / 100%).
- **Balance Sheet Adjustments**: Minimum cash buffer of ₹1,000 Cr is maintained to preserve post-close operating liquidity.
