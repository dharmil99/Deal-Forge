# DealForge — M&A Intelligence & Transaction Analytics Platform

*Evaluate. Model. Analyze. Execute.*

An institutional-style M&A analytics platform: target screening → comparable
companies → precedent transactions → valuation → deal modeling → sources &
uses → accretion/dilution → scenario analysis, built on real Indian company
financials (₹ Cr).

## Status: V0 — Phases 1–8 complete

- [x] Phase 0: repo scaffold, schemas, data dictionary
- [x] Phase 1: parse full 113-company dataset, sector mapping
- [x] Phase 2: target screening
- [x] Phase 3: comparable companies
- [x] Phase 4: precedent transactions
- [x] Phase 4.5: DCF valuation (WACC → FCFF → terminal value → implied equity)
- [x] Phase 5: valuation summary (comps + precedents + DCF)
- [x] Phase 6: deal builder
- [x] Phase 7: sources & uses
- [x] Phase 8: accretion / dilution
- [ ] Phase 9: FastAPI + basic frontend integration

## Architecture (V0)

```
Screener.in exports (.xlsx)
        |
analytics/screener_import.py   <- parses raw exports into normalized CSVs
        |
data/companies.csv, data/financials.csv
        |
analytics/{screening,comps,precedents,dcf,valuation,deal_model,sources_uses,accretion_dilution}.py
        |
backend/ (FastAPI, thin pass-through layer, no business logic)
        |
frontend/ (built in V1 to match target UI design)
```

**Principle: UI ≠ Financial Engine.** Every calculation in `analytics/` must
be independently testable by calling the function directly — no API or
frontend required.

## Data

All financials sourced from Screener.in exports, currency ₹ Cr. See
`docs/data-dictionary.md` for the full field mapping and derivation
formulas (notably: EBITDA is not a stored Screener field — it's derived,
and the derivation is only valid for `sector_type == "Industrial"`;
Financial-sector companies (banks/NBFCs) are tagged but excluded from
EV/EBITDA-based screening/comps in V0).

## Setup

```bash
pip install -r requirements.txt
python analytics/screener_import.py data/raw
pytest tests/
```

## Tech stack

- **V0**: Python, Pandas, CSV storage, FastAPI
- **V1**: PostgreSQL/SQLite, React/TypeScript frontend, sensitivity &
  scenario analysis, Investment Committee report export

## Methodology & assumptions

See `docs/data-dictionary.md` and `docs/methodology.md` (added as each
analytics module is built) for every formula and assumption used.
