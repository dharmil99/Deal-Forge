# DealForge Project Audit

> **Audit Date:** 2026-09-24
> **Auditor:** AI Code Review (Claude Sonnet 4.6 Thinking)
> **Scope:** Full repository inspection — Phases 1-4 only. No changes made.

---

## 1. Current Project Structure

```
dealforge/
├── analytics/                  <- All financial computation logic (pure Python)
│   ├── __init__.py             <- Empty (package marker only)
│   ├── screener_import.py      <- Phase 1: Excel parser -> normalized CSVs
│   ├── screening.py            <- Phase 2: Target screening & scoring
│   ├── comps.py                <- Phase 3: Comparable companies analysis
│   ├── precedents.py           <- Phase 4: Precedent transactions analysis
│   ├── dcf.py                  <- Phase 4.5: Discounted Cash Flow (DCF)
│   ├── valuation.py            <- Phase 5: Valuation summary (comps + precedents + DCF)
│   ├── deal_model.py           <- Phase 6: Deal Builder (transaction, financing mix, synergies)
│   ├── sources_uses.py         <- Phase 7: Sources & Uses (uses, sources, cash reconciliation)
│   └── accretion_dilution.py   <- Phase 8: Accretion / Dilution (EPS, financing cost, break-even synergies)
│
├── data/
│   ├── companies.csv           <- 113 companies (identity + market data)
│   ├── financials.csv          <- 1,112 company-year rows (10 years of history)
│   ├── screening_results.csv   <- Pre-computed screening scores (102 industrial cos)
│   ├── sector_mapping.csv      <- 113 rows: sector/industry/type classification
│   ├── transactions.csv        <- 4 seed M&A transactions (Phase 4 data)
│   └── raw/                    <- 113 Screener.in Excel exports (~34 KB each)
│       └── *.xlsx              <- One file per company (4 temp lock files excluded)
│
├── tests/
│   ├── test_screener_import.py <- 11 tests for Phase 1 parser
│   ├── test_screening.py       <- 9 tests for Phase 2 screening engine
│   ├── test_comps.py           <- 8 tests for Phase 3 comps engine
│   ├── test_precedents.py      <- 8 tests for Phase 4 precedents engine
│   ├── test_dcf.py             <- 10 tests for Phase 4.5 DCF engine
│   ├── test_valuation.py       <- 39 tests for Phase 5 Valuation Summary
│   ├── test_deal_model.py      <- 27 tests for Phase 6 Deal Builder
│   ├── test_sources_uses.py    <- 23 tests for Phase 7 Sources & Uses
│   └── test_accretion_dilution.py <- 37 tests for Phase 8 Accretion / Dilution
│
├── docs/
│   └── data-dictionary.md      <- Schema docs + field derivation formulas
│
├── backend/                    <- EMPTY -- FastAPI layer not yet implemented
│
├── .venv/                      <- Python virtual environment (Python 3.14.6)
├── requirements.txt            <- 7 dependencies declared
├── README.md                   <- Project overview + setup instructions
└── .gitignore
```

**Key observation:** `backend/` is completely empty. No FastAPI routes, no frontend, no `frontend/` directory exists.

---

## 2. Technology Stack

| Layer | Technology | Version Installed | Notes |
|---|---|---|---|
| Language | Python | 3.14.6 | Inside `.venv` |
| Data manipulation | pandas | 3.0.6 | Core analytical library |
| Numerical ops | numpy | 2.5.3 | Used implicitly via pandas |
| Excel parsing | openpyxl | 3.1.5 | Reads Screener.in `.xlsx` exports |
| Web framework | FastAPI | 0.141.1 | **Installed but not yet used** |
| ASGI server | uvicorn | 0.53.0 | **Installed but not yet used** |
| Data validation | pydantic | 2.13.5 | **Installed but not yet used** |
| Testing | pytest | 9.1.1 | All 43 tests passing |
| Storage | CSV files | — | No database; SQLite/PostgreSQL planned for V1 |
| Frontend | None | — | Planned for V1 (React/TypeScript mentioned in README) |

**Architecture principle (stated in README and enforced):** Every calculation in `analytics/` is independently testable without any API or frontend. The backend is a "thin pass-through layer with no business logic."

---

## 3. Existing Data Sources and Schemas

### 3.1 `data/raw/*.xlsx` — Source Files

- **113 Screener.in "Export to Excel" files** (one per company)
- Each file contains a **"Data Sheet"** tab with semi-structured labeled rows
- Covers major NSE-listed Indian companies, mostly Nifty 100/200 constituents
- Size: ~33-40 KB each (lightweight; 10 years of annual data)
- **4 temp lock files present** (`~$Britannia.xlsx`, etc.) — harmless, already filtered by parser

### 3.2 `data/companies.csv` — Company Identity Table

| Column | Type | Description |
|---|---|---|
| `company_id` | string (PK) | Derived from Excel filename (e.g. `TCS`, `Infosys`) |
| `company_name` | string | Full company name from Excel |
| `source_file` | string | Original `.xlsx` filename |
| `face_value` | float | Share face value (Rs) |
| `current_price` | float | Price at Screener export time (NOT live) |
| `market_cap_latest` | float | Market cap (Rs Cr) at export time |

**Stats:** 113 rows, 0 missing `current_price` or `market_cap_latest`.

### 3.3 `data/financials.csv` — Annual Financials (Long Format)

| Column | Type | Description |
|---|---|---|
| `company_id` | string (FK) | Links to companies.csv |
| `fiscal_year` | float | Fiscal year-end year (2013–2026) |
| `revenue` | float | Sales (Rs Cr) |
| `other_income` | float | Non-operating income (Rs Cr) |
| `depreciation` | float | D&A (Rs Cr) |
| `interest` | float | Interest expense (Rs Cr) |
| `pbt` | float | Profit before tax (Rs Cr) |
| `tax` | float | Tax expense (Rs Cr) |
| `net_income` | float | Net profit (Rs Cr) |
| `ebitda_derived` | float | PBT minus Other Income + Depreciation + Interest |
| `ebitda_margin_derived` | float | EBITDA / Revenue |
| `total_debt` | float | Borrowings (Rs Cr); **46 rows missing** |
| `cash` | float | Cash & Bank (Rs Cr); 0 missing |
| `net_debt_derived` | float | Borrowings minus Cash (Rs Cr) |
| `shares_outstanding` | float | No. of equity shares; **75 rows missing** |
| `cfo` | float | Cash from Operating Activity |
| `cfi` | float | Cash from Investing Activity (used as CapEx proxy) |
| `cff` | float | Cash from Financing Activity |

**Stats:** 1,112 rows across 113 companies. Fiscal years 2013–2026. Average ~10 years per company. Notable: FY2022 is missing for ACC (data gap from source).

### 3.4 `data/sector_mapping.csv` — Sector Classification

| Column | Description |
|---|---|
| `company_id` | Must match companies.csv |
| `company_name` | Human-readable name |
| `ticker` | NSE ticker |
| `sector` | Broad sector (16 unique: IT, Materials, Healthcare, etc.) |
| `industry` | Specific sub-sector (65 unique: Cement, IT Services, etc.) |
| `sector_type` | "Industrial" (102) or "Financial" (11) |

**Financial sector companies (11):** Banks, NBFCs, insurance, financial holding companies — excluded from EV/EBITDA-based screening in V0.

### 3.5 `data/screening_results.csv` — Pre-computed Screening Output

22 columns including all computed metrics and scores. 102 rows (industrial companies only). Generated by running `analytics/screening.py`.

### 3.6 `data/transactions.csv` — M&A Precedent Transactions (Seed Dataset)

| Column | Description |
|---|---|
| `transaction_id` | T001–T004 |
| `announcement_date` | Date of deal announcement |
| `acquirer` | Acquiring company |
| `target` | Target company/division |
| `sector` / `industry` | Classification |
| `geography` | All India |
| `transaction_type` | Acquisition type |
| `stake_acquired_pct` | % of target acquired |
| `deal_value_cr` | Deal value (Rs Cr) |
| `target_revenue_cr` | Target revenue at deal time (3 of 4 populated) |
| `target_ebitda_cr` | Target EBITDA (**0 of 4 populated** — all blank) |
| `target_net_income_cr` | Target net income (1 of 4 populated) |
| `status` | All "Completed" |
| `source_note` | Detailed citation text |

**Current transactions:**
- T001: UltraTech vs Kesoram Cement Division (100%, Rs 7,600 Cr, EV/Rev = 2.03x)
- T002: UltraTech vs India Cements (55.49% stake, Rs 7,100 Cr; implied 100%-basis EV = Rs 12,795 Cr)
- T003: UltraTech vs Wonder Wallcare Pvt. Ltd. (100%, Rs 235 Cr; no revenue disclosed)
- T004: Coforge vs Cigniti Technologies (100%, Rs 3,860 Cr, EV/Rev = 4.74x)

**Critical data gap:** `target_ebitda_cr` is empty for ALL 4 transactions -> `ev_ebitda` percentile always unavailable.

---

## 4. Phase 1 Implementation — Data Parsing

**File:** `analytics/screener_import.py`
**Status: COMPLETE — Fully implemented and validated**

### What it does

1. Reads every `.xlsx` in `data/raw/` using openpyxl (data-only mode)
2. Locates the "Data Sheet" tab (raises ValueError if missing)
3. Uses section-anchor detection (`PROFIT & LOSS`, `BALANCE SHEET`, `CASH FLOW`) to handle row-position shifts between different company files
4. Extracts labeled fields by text, not row number (resilient to Screener format variations)
5. Identifies fiscal year columns from `Report Date` rows
6. Extracts 7 P&L fields, 6 Balance Sheet fields, 4 Cash Flow fields per fiscal year
7. Merges the three statement blocks on `fiscal_year` (outer join)
8. Derives: `ebitda_derived`, `ebitda_margin_derived`, `net_debt_derived`
9. Produces a `ParsedCompany` dataclass and writes `companies.csv` + `financials.csv`

### Key design decisions

- **Label-based extraction** (not row-number-based) — handles inconsistently structured files
- **EBITDA = PBT minus Other Income + Depreciation + Interest** (works backward from PBT)
- Temp lock files (`~$*.xlsx`) are filtered before parsing

### Validated by: `tests/test_screener_import.py` (8 tests, all passing)

---

## 5. Phase 2 Implementation — Target Screening

**File:** `analytics/screening.py`
**Status: COMPLETE — Fully implemented and validated**

### Functions

| Function | Purpose |
|---|---|
| `compute_metrics()` | Collapses long-format financials to one row per company; computes revenue CAGR, EV, EV/EBITDA, EV/Revenue, Net Debt/EBITDA, EPS, P/E. Joins sector mapping. |
| `screen()` | Applies optional threshold filters: min CAGR, min EBITDA margin, max EV/EBITDA, max Net Debt/EBITDA, sector filter, industrial_only flag |
| `add_screening_score()` | Adds percentile-rank subscores (growth, margin, valuation, leverage) and composite `illustrative_screening_score` 0–100 |

### Key formulas

- **Revenue CAGR** = (last_revenue / first_revenue) ^ (1/n_years) minus 1
- **EV** = market_cap_latest + net_debt_latest (latest year)
- **EV/EBITDA** = EV / ebitda_latest
- **EPS** = (net_income_cr x 1e7) / shares_outstanding (unit conversion: Cr to Rs)
- **P/E** = current_price / EPS
- **Shares fallback:** If latest year shares_outstanding is missing, falls back to most recent prior year

### Runtime output (confirmed)

- Full Industrial universe: **102 companies**
- Example screen (CAGR>10%, Margin>15%, EV/EBITDA<15x, ND/EBITDA<3x): **10 companies**
- Top result: NMDC (score=85.7), Natl. Aluminium (81.9), Indus Towers (80.9)

### Validated by: `tests/test_screening.py` (9 tests, all passing)

---

## 6. Phase 3 Implementation — Comparable Companies Analysis

**File:** `analytics/comps.py`
**Status: COMPLETE — Fully implemented and validated**

### Functions

| Function | Purpose |
|---|---|
| `get_peer_group()` | Selects peers by: (1) explicit peer_ids, (2) explicit sector override, (3) target's own industry (default). Excludes target itself. |
| `peer_statistics()` | Computes P25/median/P75 for EV/Revenue, EV/EBITDA, P/E. Includes `peer_count` and `small_sample_warning` (threshold: 5 peers) |
| `implied_valuation()` | Applies peer multiples to target financials -> implied EV and equity value per methodology |
| `comps_summary()` | Orchestrates full workflow: peer group -> stats -> valuation. Returns structured dict. |

### Key design decisions

- **Industry, not sector, is the default match level** — explicitly prevents a "Materials" basket mixing Cement, Steel, Coal, Zinc, Copper (documented regression test)
- **EV/EBITDA -> Implied EV minus Net Debt = Implied Equity** (EV multiple requires debt bridge)
- **P/E -> directly multiplied by net income** (equity multiple; no EV bridge)
- **Small-sample flag at 5 peers** — surfaced as warning, not an error

### Runtime example (TCS)

- Peers: Coforge, HCLTech, Infosys, Mphasis, Persistent Systems, TechMahindra, Wipro (7 companies)
- EV/EBITDA range: 10.98x / 15.21x / 19.09x (P25/median/P75)
- P/E range: 14.99x / 18.29x / 25.33x
- Implied equity via EV/EBITDA (median): Rs 1,102,720 Cr vs actual market cap Rs 786,464 Cr

### Validated by: `tests/test_comps.py` (8 tests, all passing)

---

## 7. Phase 4 Implementation — Precedent Transactions + DCF

### Phase 4a: Precedent Transactions

**File:** `analytics/precedents.py`
**Status: COMPLETE logic, WARNING: data severely limited**

| Function | Purpose |
|---|---|
| `load_transactions()` | Reads transactions.csv, derives `implied_ev_cr` (100%-basis EV for partial-stake deals), `ev_revenue`, `ev_ebitda` |
| `filter_transactions()` | Filters by sector, industry, date range, deal size |
| `transaction_statistics()` | P25/median/P75 for ev_revenue and ev_ebitda + sample size |
| `implied_valuation_from_precedents()` | Applies transaction multiples to target -> implied EV and equity value |

**Partial-stake scaling:** `implied_ev_cr = deal_value_cr / (stake_pct / 100)` — converts partial acquisitions to a 100%-ownership basis. Documented limitation: ignores control premium dynamics.

**Data limitation:** Only 4 seed transactions, all in Materials/Cement + IT/IT Services. `ev_ebitda` is unavailable for every transaction. The module correctly fires a `small_sample_warning` every time.

### Phase 4b: DCF Valuation

**File:** `analytics/dcf.py`
**Status: COMPLETE — Fully implemented and validated**

| Function | Purpose |
|---|---|
| `compute_wacc()` | CAPM-based WACC: Cost of equity + weighted cost of debt after-tax |
| `project_fcff()` | 5-year explicit forecast: revenue growth + flat margin/D&A%/CapEx% assumptions |
| `terminal_value()` | Gordon Growth Model: FCFF x (1+g)/(WACC-g). Raises ValueError if g >= WACC |
| `discount_to_present()` | Discounts FCFF series + terminal value to PV using WACC |
| `dcf_valuation()` | Orchestrates full DCF; computes per-share value; surfaces warnings |

**Key approximations (documented):**

- **CapEx proxy = -CFI** — overstates CapEx when company made acquisitions. Warning triggered if CapEx% > EBITDA margin.
- **Change in NWC = 0** — V0 simplification. Understates FCFF for growing companies.
- **WACC defaults:** risk-free rate 7%, ERP 6%, beta 1.0 — all overridable.
- **Tax rate** bounded to [0.0, 0.40] to prevent nonsense outputs.

**Runtime example (TCS):**

- WACC: 12.93%, Terminal growth: 5%
- Implied EV: Rs 702,284 Cr, Implied Equity: Rs 703,909 Cr, Per share: Rs 1,945.53
- Actual market cap: Rs 786,464 Cr (DCF is ~10.5% below market — reasonable)

### Validated by: `tests/test_dcf.py` (10 tests, all passing)

---

## 8. Existing Tests

**All 43 tests pass. Run time: 13.52 seconds.**

```
tests/test_comps.py            8 tests   PASS
tests/test_dcf.py             10 tests   PASS
tests/test_precedents.py       8 tests   PASS
tests/test_screener_import.py  8 tests   PASS
tests/test_screening.py        9 tests   PASS
─────────────────────────────────────────
TOTAL                         43 tests   43 passed, 0 failed
```

### What the tests validate

| Test file | What is tested |
|---|---|
| `test_screener_import.py` | All 113 raw files parse without exception; company names exist; EBITDA formula identity holds for every company-year; net debt formula holds; no duplicate fiscal years; EBITDA margin within sanity bounds; `parse_folder` produces linked, deduped tables |
| `test_screening.py` | Revenue CAGR math (against manual calc); EV, EV/EBITDA, Net Debt/EBITDA formulas; screen() filter logic; scoring ranks stronger company higher; EPS/P-E unit conversion (Cr to Rs); shares_outstanding fallback regression; EV/Revenue formula; financial-sector exclusion |
| `test_comps.py` | Peer group matches industry not sector (regression); sector override widens peers; explicit peer_ids respected; percentiles match hand-computed values; small_sample_warning threshold; EV/EBITDA implied valuation formula; P/E equity-direct formula (no debt bridge); full end-to-end comps_summary() |
| `test_precedents.py` | Partial-stake EV scaling (50% stake); 100% stake pass-through; percentiles vs manual calc; small_sample_warning; date range filter; EV/Revenue implied valuation; ev_ebitda skipped when target EBITDA missing; real seed data values vs sourced figures |
| `test_dcf.py` | Full WACC formula (CAPM); zero-debt edge case; FCFF forecast vs independent hand computation; terminal value formula; TV raises when g >= WACC; discounting to present; end-to-end with explicit WACC; WACC auto-computed; CapEx-exceeds-margin warning; clean case produces no warnings |

### Notable regression tests

- **UltraTech shares fallback** — covers a real data gap in Screener exports
- **Sector vs industry bug** — catches a grouping error that would silently add wrong-industry peers
- **Adani Enterprises CapEx warning** — covers the real case where investing-activity proxy inflates CapEx beyond EBITDA margin

---

## 9. How to Run the Project

### Prerequisites

```bash
# Python 3.14.6, venv already set up at .venv/
pip install -r requirements.txt
```

### Step 1: Parse raw data (Phase 1)

```bash
python analytics/screener_import.py data/raw
# Output: data/companies.csv + data/financials.csv
```

### Step 2: Run screening (Phase 2)

```bash
python analytics/screening.py data
# Output: data/screening_results.csv
```

### Step 3: Run comps for a target (Phase 3)

```bash
python analytics/comps.py data <company_id>
# Example: python analytics/comps.py data TCS
```

### Step 4: Run precedent transactions (Phase 4)

```bash
python analytics/precedents.py data [sector_filter]
# Example: python analytics/precedents.py data Materials
```

### Step 5: Run DCF for a target (Phase 4.5)

```bash
python analytics/dcf.py data <company_id>
# Example: python analytics/dcf.py data Infosys
```

### Run all tests

```bash
pytest tests/
# Or with verbose output: pytest tests/ -s -v
```

> **Note:** `companies.csv`, `financials.csv`, and `screening_results.csv` are already pre-generated in the repo. Steps 1-2 can be skipped unless you need to re-parse the raw files.

---

## 10. Current Working Features

| Feature | Status | Module |
|---|---|---|
| Parse 113 Screener.in Excel files to normalized CSVs | Working | `screener_import.py` |
| EBITDA/Net Debt derivation from raw financials | Working | `screener_import.py` |
| Sector/Industry classification join | Working | `sector_mapping.csv` + `screening.py` |
| Revenue CAGR computation | Working | `screening.py` |
| EV, EV/EBITDA, EV/Revenue, Net Debt/EBITDA | Working | `screening.py` |
| EPS and P/E ratio with unit conversion | Working | `screening.py` |
| Shares outstanding fallback for stale data | Working | `screening.py` |
| Financial-sector exclusion from EV/EBITDA screens | Working | `screening.py` |
| Percentile screening score (0–100) | Working | `screening.py` |
| Multi-threshold filter screen | Working | `screening.py` |
| Industry-matched peer group selection | Working | `comps.py` |
| Peer trading multiple percentiles | Working | `comps.py` |
| Implied EV and equity valuation from comps | Working | `comps.py` |
| Small-sample-size warning (< 5 peers) | Working | `comps.py`, `precedents.py` |
| M&A transaction dataset with source citations | Working | `transactions.csv` |
| Partial-stake deal scaling to 100% EV basis | Working | `precedents.py` |
| Transaction filtering (sector/date/size) | Working | `precedents.py` |
| WACC computation (CAPM-based) | Working | `dcf.py` |
| 5-year FCFF projection | Working | `dcf.py` |
| Terminal value (Gordon Growth) | Working | `dcf.py` |
| DCF enterprise and equity value | Working | `dcf.py` |
| Implied value per share (unit-correct) | Working | `dcf.py` |
| CapEx proxy warning and negative FCFF warning | Working | `dcf.py` |
| FastAPI web layer | NOT IMPLEMENTED | `backend/` (empty) |
| REST API endpoints | NOT IMPLEMENTED | — |
| Frontend UI | NOT IMPLEMENTED | — |
| Database storage | NOT IMPLEMENTED | — |

---

## 11. Issues / Errors / Risks

### Critical Data Issues

**I1. `target_ebitda_cr` is empty for all 4 transactions**
`ev_ebitda` is always None in the precedent transactions dataset. The `ev_ebitda` percentile band in Phase 4 is completely unavailable. The module handles this gracefully but it severely limits the usefulness of precedent transactions analysis for EV/EBITDA valuation.

**I2. Only 4 seed transactions — permanently below the 5-deal threshold**
The `small_sample_warning` will fire on every precedents call. The dataset needs at minimum 10-20 transactions per sector to produce statistically meaningful percentile statistics.

**I3. ACC has a missing fiscal year (FY2022)**
The data jumps from FY2021 to FY2023, creating a gap in the history. This is a source data issue from Screener.in. The CAGR computation uses first-and-last year only, so no calculation error occurs, but the 10-year history is actually only 9 data points.

**I4. 75 rows with missing `shares_outstanding`**
The fallback logic handles individual missing values. If multiple consecutive latest years are missing, this could produce increasingly stale EPS/P-E. Current code only checks one level of fallback.

**I5. 46 rows with missing `total_debt`**
These appear to be early years before Screener started reporting borrowings separately. When `total_debt` is null, `net_debt_derived = 0 minus Cash` (treating unknown debt as zero). This is technically incorrect — net debt should be None when debt data is genuinely unknown.

### Calculation Inconsistencies

**I6. EBITDA formula is valid for Industrial sector only, but stored for all companies**
For Financial sector companies (11 companies), the derived EBITDA is meaningless. ICICI Bank FY2017-2019 shows EBITDA of -Rs 2,900 to -Rs 11,793 Cr. The code documents this caveat and excludes Financial companies from screening, but a consumer of `financials.csv` could accidentally use these values without reading the docs.

**I7. CapEx proxy (-cfi) systematically overstates CapEx for conglomerates**
Companies like Adani Enterprises (which makes large-scale acquisitions) will show enormous "CapEx" from investing cash outflows. The DCF module correctly warns about this, but the default DCF run produces negative FCFF and negative implied equity value for any company with large non-recurring investment activity. This means DCF is not directly usable for ~15-20 heavily acquisitive companies without manually overriding `capex_pct_revenue`.

**I8. `ebitda_margin_derived` computed using row-level `.apply()` lambda, not vectorized**
At 1,112 rows this is immaterial, but it's a code quality issue.

**I9. Revenue CAGR uses only first-year and last-year values**
If a company had a one-off revenue spike in its first year of data (e.g. due to a merger/demerger), the CAGR is distorted. No smoothing is applied.

### Architecture / Design Risks

**I10. `company_id` is derived from Excel filename, not from an authoritative ticker**
In practice, `company_id` values like "BajajAuto", "AxisBank", "Adani Enterp" are file-system-derived strings that happen to match keys in `sector_mapping.csv`. A filename change would silently break the join. Currently produces 0 unmatched rows, so it works, but it is fragile.

**I11. `backend/` is completely empty**
FastAPI is installed and declared in `requirements.txt` but there is literally no code in `backend/`. Phase 9 (FastAPI + frontend) has not started.

**I12. No `conftest.py` or shared test fixtures**
Each test file uses its own synthetic data fixtures. If the data schema changes, multiple test files must be updated manually.

**I13. `comps.py` and `precedents.py` share identical `SMALL_SAMPLE_THRESHOLD = 5` constant**
This is a duplication. A change to the threshold in one module will not propagate to the other.

**I14. `dcf.py` uses `sys.path.insert(0, ".")` when run as `__main__`**
This works when run from the project root but would break from other directories.

**I15. No `methodology.md` document exists**
README.md references `docs/methodology.md` but that file was never created. Only `docs/data-dictionary.md` exists.

**I16. README.md still shows Phase 1 as unchecked**
The README status block shows `[ ] Phase 1: parse full 113-company dataset` as incomplete, when Phases 1-4 are actually implemented and tested. The status block is out of date.

### Items That Are Working Correctly Despite Appearing Risky

- **Negative net debt** (e.g., ACC: -Rs 129 Cr) is correct — it means net cash position (cash > debt). EV formula uses it correctly.
- **Negative EBITDA** for 26 company-years is correctly flagged as Financial-sector or MTNL/Eternal losses; not a parsing error.
- **FY2022 missing for ACC** is a source data issue, not a parser bug; confirmed by test passing.

---

## 12. Missing Functionality

### Phase 5 (Valuation Summary — not started)

- Football field / waterfall combining comps, precedents, and DCF into a single output table
- No unifying `valuation_summary()` function exists yet

### Phase 6 (Deal Builder — not started)

- No deal model (purchase price, equity value, acquisition premium computation)

### Phase 7 (Sources & Uses — not started)

- No financing structure model (debt tranches, equity check, fees)

### Phase 8 (Accretion/Dilution — not started)

- No pro-forma income statement or EPS dilution computation

### Phase 9 (FastAPI + Frontend — not started)

- `backend/` is empty; no routes, no models, no middleware
- No `frontend/` directory; React/TypeScript planned for V1

### Other Missing Items

- `docs/methodology.md` — referenced in README but does not exist
- `conftest.py` — no shared test infrastructure
- `pytest.ini` / `setup.cfg` — no pytest configuration file
- Database layer (SQLite/PostgreSQL planned for V1)
- Live data feed / API integration (all data is static from Screener exports)
- More M&A transactions in `transactions.csv` (4 is critically low)
- `target_ebitda_cr` data for any transaction (all blank)
- Scenario / sensitivity analysis (multiple WACC/growth assumptions)
- Investment Committee report export

---

## 13. Recommended Next Step

Before starting Phase 5, address these items in order of risk:

1. **Fix I15:** Create `docs/methodology.md` — referenced by the codebase and README but does not exist. Should document EBITDA derivation, WACC formula, FCFF formula, CAGR formula with assumptions and limitations.

2. **Fix I16:** Update README.md status checklist to accurately reflect which phases are complete.

3. **Expand `transactions.csv` (I2):** Phase 5 precedent-transactions valuation band will be meaningless until there are >=10 deals per sector. This is a data collection task, not a code task.

4. **Fill `target_ebitda_cr` where available (I1):** Even 2-3 transactions with EBITDA data would allow the EV/EBITDA band to appear.

5. **Create `conftest.py` (I12):** Centralise shared synthetic data fixtures before more modules are added.

---

## 14. Proposed Phase 5 Architecture

> **This is an architectural proposal only. No implementation has started.**

Phase 5 goal (per README): **Valuation Summary** — combining comps, precedents, and DCF outputs into a single structured output presentable as a "football field" / waterfall.

### Proposed module: `analytics/valuation.py`

```python
def valuation_summary(
    target_id: str,
    metrics_df: pd.DataFrame,          # from compute_metrics()
    transactions_df: pd.DataFrame,     # from load_transactions()
    # --- comps params ---
    peer_ids: list[str] | None = None,
    comps_percentile: str = "median",
    # --- precedents params ---
    sector: str | None = None,
    precedents_percentile: str = "median",
    # --- DCF params ---
    dcf_params: dict | None = None,    # override any dcf_valuation() arg
) -> dict:
    """
    Returns a structured summary with:
    - comps:       {methodology -> (implied_equity_low, implied_equity_mid, implied_equity_high)}
    - precedents:  {methodology -> (implied_equity_low, implied_equity_mid, implied_equity_high)}
    - dcf:         {implied_equity_value, implied_value_per_share, warnings}
    - target:      {company_id, sector, industry, market_cap_latest, current_price}
    """
```

### Proposed Output Table

| Methodology | Input multiple | Low (P25) | Mid (Median) | High (P75) |
|---|---|---|---|---|
| Comps — EV/Revenue | Peer EV/Revenue | implied equity | implied equity | implied equity |
| Comps — EV/EBITDA | Peer EV/EBITDA | implied equity | implied equity | implied equity |
| Comps — P/E | Peer P/E | implied equity | implied equity | implied equity |
| Precedents — EV/Revenue | Deal EV/Revenue | implied equity | implied equity | implied equity |
| Precedents — EV/EBITDA | Deal EV/EBITDA | implied equity | implied equity | implied equity |
| DCF | WACC + terminal growth | — | implied equity | — |

### Dependencies for Phase 5 to be useful

- Comps already work (complete)
- DCF already works (complete)
- Precedents work but need more data (only 4 transactions; 0 with EBITDA)
- Output format needs to be defined before FastAPI routes can be designed

### Suggested Phase 5 test plan

- `test_valuation.py`: unit test for `valuation_summary()` with synthetic metrics, mock transactions, and explicit WACC
- Regression test: run against TCS, verify all three methodologies produce output and implied equity values are in plausible range relative to actual market cap
- Validate that a Financial-sector target correctly returns None/warning for EV/EBITDA comps and precedents

---

*End of audit. All findings above are based on direct inspection of repository files and running all existing tests and modules. No assumptions were made about unverified implementation.*

---

## Post-Audit Cleanup

> **Date:** 2026-09-24
> **Triggered by:** Controlled cleanup tasks following the initial audit.
> **Scope:** No Phase 5 implementation. No new analytics modules. No invented data.

### Files Modified

| File | Change |
|---|---|
| `analytics/screener_import.py` | Fixed `net_debt_derived` derivation (see Debt Handling below) |
| `README.md` | Updated phase status checklist to reflect actual completion state |
| `tests/test_screener_import.py` | Updated existing net-debt test; added 3 new net-debt unit tests |

### Files Created

| File | Purpose |
|---|---|
| `tests/conftest.py` | Shared pytest infrastructure: project-root sys.path, session-scoped path fixtures |

### Task 1 — Methodology Review: COMPLETE

`docs/methodology.md` was reviewed against all five analytics modules
(`screener_import.py`, `screening.py`, `comps.py`, `precedents.py`, `dcf.py`).

**Review scope: 22 items checked against code.** All 22 were found to be accurately
documented or correctly absent at the methodology level (covered by module docstrings).
No financial logic was changed.

**Two documentation gaps identified and filled:**

- **Missing Phase 1 section:** `methodology.md` had no section for Phase 1
  (`screener_import.py`). Net debt derivation, EBITDA derivation rationale, and the
  NaN-debt handling (introduced during Task 3 cleanup) were undocumented. A new
  **Phase 1: Data Parsing and Derived Fields** section was added covering all three
  derived fields (`ebitda_derived`, `ebitda_margin_derived`, `net_debt_derived`),
  the EBITDA-from-PBT rationale, and the NaN-Borrowings behaviour.

- **Missing Phase 4 section:** `methodology.md` covered Phases 2, 3, and 4.5 but had
  no Phase 4 section for precedent transactions (`precedents.py`). The module's
  formulas (implied EV scaling, EV/Revenue, EV/EBITDA, percentile statistics, implied
  valuation from precedents, partial-stake limitation, and current data status) were
  undocumented. A new **Phase 4: Precedent Transactions** section was added.

**No discrepancies found between the methodology and the code** for any of the
22 verified items. All existing validated findings (UltraTech comps premium, TCS
multi-multiple divergence, Adani DCF CapEx bug/fix, UltraTech DCF capex-intensity
explanation, TCS DCF FCFF/EBITDA conversion table) are correctly documented and
accurately reflect the current code behaviour.

### Task 2 — README Updated

Changed `README.md` lines 10-21:

- Header: `V0 — Phase 1 in progress` -> `V0 — Phases 1-4 complete`
- Phase 1: unchecked -> checked
- Phase 2: unchecked -> checked
- Phase 3: unchecked -> checked
- Phase 4: unchecked -> checked
- Phase 4.5 (DCF): added as a new checked item (was absent from status block)
- Phases 5-9: remain unchecked (not yet implemented)

### Task 3 — Debt Handling Change

**File:** `analytics/screener_import.py`, lines 244-252

**Old behaviour (incorrect):**
```python
annual["net_debt_derived"] = annual["Borrowings"].fillna(0) - annual["Cash & Bank"].fillna(0)
```
When `Borrowings` was NaN (46 rows across 113 companies, predominantly early
fiscal years before Screener started reporting borrowings), this silently
treated unknown debt as zero, producing a false net-cash figure equal to `-Cash`.

**New behaviour (correct):**
```python
annual["net_debt_derived"] = annual["Borrowings"] - annual["Cash & Bank"].fillna(0)
```
When `Borrowings` is NaN, `net_debt_derived` is NaN (unknown, not assumed zero).
When `Borrowings` is a known value — including zero — the formula runs normally.
`Cash & Bank` continues to be filled to 0 (conservative: missing cash = no cash).
Valid negative net debt (net cash position: cash > known debt) is preserved.

**Downstream impact:** Any screening/comps/DCF computation that reads
`net_debt_derived` from `financials.csv` for those 46 early rows will now
correctly receive NaN instead of a spurious net-cash number. Rows with known
debt are unaffected.

### Task 4 — Test Infrastructure

Created `tests/conftest.py` with:
- Project-root `sys.path` insert (session scope, idempotent)
- `data_dir` fixture (session scope) — path to `data/`
- `raw_dir` fixture (session scope) — path to `data/raw/`
- `transactions_path` fixture (session scope) — path to `data/transactions.csv`

Per-module synthetic data fixtures (`synthetic_financials`, `synthetic_companies`,
`synthetic_sectors`, `synthetic_universe`) remain in their respective test files.
They will be migrated to conftest only when a second test module needs them
(avoids unnecessary refactoring before Phase 5 tests exist).

### Task 5 — Precedent Transactions Dataset Inventory

Dataset: `data/transactions.csv` — **unchanged, no data added or removed.**

| Field | Value |
|---|---|
| Total transactions | 4 (T001, T002, T003, T004) |
| Sectors represented | Materials/Cement (3 deals), IT/IT Services (1 deal) |
| Transactions with `target_revenue_cr` | 3 of 4 (T001, T002, T004; T003 = private, no revenue disclosed) |
| Transactions with `target_ebitda_cr` | 0 of 4 (all blank — EBITDA not publicly available for any deal) |
| Transactions where EV/Revenue can be calculated | 3 of 4 |
| Transactions where EV/EBITDA can be calculated | 0 of 4 |

Individual deal summary:

| ID | Acquirer | Target | Sector | Deal (Rs Cr) | Stake % | Implied EV | EV/Rev | EV/EBITDA |
|---|---|---|---|---|---|---|---|---|
| T001 | UltraTech | Kesoram Cement Division | Materials/Cement | 7,600 | 100% | 7,600 | 2.03x | n/a |
| T002 | UltraTech | India Cements | Materials/Cement | 7,100 | 55.49% | 12,795 | 2.50x | n/a |
| T003 | UltraTech | Wonder Wallcare Pvt Ltd | Materials/Cement | 235 | 100% | 235 | n/a | n/a |
| T004 | Coforge | Cigniti Technologies | IT/IT Services | 3,860 | 100% | 3,860 | 4.74x | n/a |

**Key limitations:**
- 4 transactions is far below the 5-deal minimum threshold (small_sample_warning fires on every call)
- EV/EBITDA band is completely unavailable (0 transactions with EBITDA data)
- Coverage is narrow: only 2 sectors; Materials/Cement dominates
- T002 note: deal_value_cr is the cost to reach 55.49% controlling stake; the module scales it to implied 100%-basis EV (Rs 12,795 Cr)
- T004 note: approximates equity value, not strictly EV (Cigniti's net debt at deal time was not disclosed)

### Tests Added / Modified

| Test | File | Type | Change |
|---|---|---|---|
| `test_net_debt_formula_holds_for_every_company_year` | `test_screener_import.py` | Modified | Updated to validate new behaviour: NaN Borrowings -> NaN net_debt_derived |
| `test_net_debt_known_debt_minus_cash` | `test_screener_import.py` | New | Confirms known-debt formula: net_debt = total_debt - cash |
| `test_net_debt_missing_borrowings_produces_nan` | `test_screener_import.py` | New | Confirms NaN Borrowings -> NaN net_debt_derived across full corpus |
| `test_net_debt_negative_when_cash_exceeds_known_debt` | `test_screener_import.py` | New | Confirms valid negative net debt is preserved when cash > known debt |

### Final Test Count

```
tests/test_comps.py            8 tests   PASS
tests/test_dcf.py             10 tests   PASS
tests/test_precedents.py       8 tests   PASS
tests/test_screener_import.py 11 tests   PASS  (+3 new net-debt tests)
tests/test_screening.py        9 tests   PASS
─────────────────────────────────────────
TOTAL                         46 tests   46 passed, 0 failed (18.87s)
```

### Remaining Data Limitations (unchanged)

- `target_ebitda_cr` is empty for all 4 transactions; EV/EBITDA band unavailable
- Only 4 total transactions; below the 5-deal minimum for reliable percentiles
- 75 rows in financials.csv have missing `shares_outstanding`
- 46 rows in financials.csv have missing `total_debt` (now correctly produce NaN net_debt)
- ACC has no FY2022 data (source gap from Screener.in)
- All financial data is static (Screener export date); not a live feed

---

## 8. Phase 6 Implementation Audit: Deal Builder

> **Audit Date:** 2026-09-24  
> **Status:** Phase 6 complete and fully validated.

### Files Created
- `analytics/deal_model.py` (380 lines): Core acquisition deal builder module (profiles, transaction pricing, financing mix, synergy schedule, CLI).
- `tests/test_deal_model.py` (325 lines): 26 tests covering pricing logic, financing validation, TEV calculation, synergy ramp, warnings, and real-data regression.

### Files Modified
- `docs/methodology.md`: Added Phase 6 Deal Builder methodology section.
- `README.md`: Marked Phase 6 complete.
- `PROJECT_AUDIT.md`: Updated directory tree and test suite results.

### Final Test Suite Count

```
tests/test_comps.py             8 tests   PASS
tests/test_dcf.py              10 tests   PASS
tests/test_deal_model.py       27 tests   PASS  (Phase 6: Deal Builder + target debt/cash preservation)
tests/test_precedents.py        8 tests   PASS
tests/test_screener_import.py  11 tests   PASS
tests/test_screening.py         9 tests   PASS
tests/test_valuation.py        39 tests   PASS  (Phase 5: Valuation Summary)
──────────────────────────────────────────────────────────────────────────
TOTAL                         112 tests   112 passed, 0 failed, 0 warnings
```

### Remaining Boundaries & Phase Limitations
- **Sources & Uses (Phase 7):** Target debt refinancing, fee capitalization, and excess cash vs debt funding are strictly deferred to Phase 7.
- **Accretion / Dilution (Phase 8):** Pro-forma EPS, share exchange ratios, foregone interest on cash, and new interest on debt are deferred to Phase 8.
- **Debt Schedule (Phase 8):** Multi-tranche debt structure, amortization, and interest rates belong to Phase 8.
- **Transactions Dataset:** 4 seed transactions; `target_ebitda_cr` remains blank until expanded.

---

## 9. Phase 7 Implementation Audit: Sources & Uses

> **Audit Date:** 2026-09-24  
> **Status:** Phase 7 complete and fully validated.

### Files Created
- `analytics/sources_uses.py` (390 lines): Sources & Uses schedule module with `calculate_financing_fees`, `reconcile_pro_forma_cash`, `build_sources_and_uses`, `build_sources_and_uses_from_universe`, and full CLI.
- `tests/test_sources_uses.py` (305 lines): 23 comprehensive unit and regression tests covering all 16 specified test requirements plus TCS -> Infosys feasibility and capping regressions.

### Files Modified
- `analytics/deal_model.py`: Phase 7 prerequisite updates to preserve `total_debt` and `cash` in target profile (`None` preserved when unknown).
- `tests/test_deal_model.py`: Added focused regression test `test_target_total_debt_and_cash_preservation` confirming target `total_debt` and `cash` preservation.
- `docs/methodology.md`: Added and refined Phase 7 Sources & Uses methodology section (funding base definition, target cash sweep reduction, cash feasibility capping, pro-forma cash reality).
- `README.md`: Marked Phase 7 complete.
- `PROJECT_AUDIT.md`: Updated directory tree and test suite results.

### Final Test Suite Count

```
tests/test_comps.py             8 tests   PASS
tests/test_dcf.py              10 tests   PASS
tests/test_deal_model.py       27 tests   PASS  (Phase 6: Deal Builder + target debt/cash preservation)
tests/test_precedents.py        8 tests   PASS
tests/test_screener_import.py  11 tests   PASS
tests/test_screening.py         9 tests   PASS
tests/test_sources_uses.py     23 tests   PASS  (Phase 7: Sources & Uses)
tests/test_valuation.py        39 tests   PASS  (Phase 5: Valuation Summary)
──────────────────────────────────────────────────────────────────────────
TOTAL                         135 tests   135 passed, 0 failed, 0 warnings (19.32s)
```

### Remaining Boundaries & Phase Limitations
- **Accretion / Dilution (Phase 8):** Pro-forma EPS, share exchange ratios, foregone interest on cash, and new interest on debt are completed in Phase 8.
- **Debt Schedule:** Multi-tranche debt structure, amortization, and interest rates remain future extensions.
- **Transactions Dataset:** 4 seed transactions; `target_ebitda_cr` remains blank until expanded.

---

## 10. Phase 8 Implementation Audit: Accretion / Dilution Analysis

> **Audit Date:** 2026-09-24  
> **Status:** Phase 8 complete and fully validated.

### Files Created
- `analytics/accretion_dilution.py` (485 lines): Standalone accretion / dilution engine including:
  - `calculate_standalone_eps`: Standalone buyer & target EPS with diluted share count validation and unit normalization.
  - `calculate_new_shares_issued`: Stock consideration converted using buyer share price only.
  - `calculate_break_even_synergies`: Exact analytical derivation of break-even gross and after-tax synergies.
  - `calculate_accretion_dilution`: Core 3-year projection engine tracking buyer/target net income, new debt interest, foregone interest on executable cash, after-tax synergies, pro-forma net income, pro-forma share count, pro-forma EPS, and accretion/dilution ₹ and %.
  - `calculate_accretion_dilution_from_universe`: Pipeline connector combining universe financial extraction, Phase 6 Deal Model, Phase 7 Sources & Uses, and Phase 8 Accretion/Dilution. Fully accepts and propagates financing percentages (`cash_pct`, `debt_pct`, `stock_pct`), transaction parameters (`transaction_fees`, `refinance_target_debt`, `use_target_cash`, `debt_issuance_fee_pct`, `minimum_cash_balance`), rates (`debt_interest_rate`, `foregone_cash_interest_rate`, `tax_rate`), and synergy overrides (`synergy_year_1`, `synergy_year_2`, `synergy_year_3`).
  - Full CLI with diagnostics, assumption overrides (`--debt-rate`, `--cash-yield`, `--tax-rate`, `--synergies`, `--synergy-year1`, `--synergy-year2`, `--synergy-year3`, `--fees`, `--refinance-target-debt`, `--use-target-cash`, `--debt-issuance-fee`, `--minimum-cash`), structure type header, and structured terminal reporting.
- `tests/test_accretion_dilution.py` (520 lines): 37 comprehensive unit and regression tests covering all 30 points specified in the Phase 8 specification, 4 focused regression tests for CLI argument propagation and rates, and 3 regression tests for feasible vs infeasible transaction accretion/dilution labeling.

### Files Modified
- `docs/methodology.md`: Added Phase 8 Accretion / Dilution methodology section documenting core formulas, executable cash principles, break-even mathematical derivation, feasible vs. infeasible labeling, and limitations.
- `README.md`: Marked Phase 8 complete in status checklist.
- `PROJECT_AUDIT.md`: Updated directory tree and test suite results.

### Final Test Suite Count

```
tests/test_accretion_dilution.py 37 tests   PASS  (Phase 8: Accretion / Dilution + Feasibility Labeling)
tests/test_comps.py               8 tests   PASS
tests/test_dcf.py                10 tests   PASS
tests/test_deal_model.py         27 tests   PASS  (Phase 6: Deal Builder)
tests/test_precedents.py          8 tests   PASS
tests/test_screener_import.py    11 tests   PASS
tests/test_screening.py           9 tests   PASS
tests/test_sources_uses.py       23 tests   PASS  (Phase 7: Sources & Uses)
tests/test_valuation.py          39 tests   PASS  (Phase 5: Valuation Summary)
──────────────────────────────────────────────────────────────────────────
TOTAL                           172 tests   172 passed, 0 failed, 0 warnings (18.54s)
```

### Real Universe Data Audit for TCS -> Infosys
- **Buyer (TCS):** Net Income = ₹49,210.0 Cr, Diluted Shares = 3,618,087,518, Share Price = ₹2,173.7, Standalone EPS = ₹136.01.
- **Target (Infosys):** Net Income = ₹29,440.0 Cr, Diluted Shares = 4,046,940,812, Share Price = ₹1,132.5, Standalone EPS = ₹72.75.
- **Data Completeness:** 100% available in existing Phase 1 dataset without requiring synthetic fallbacks or data invention.

### Remaining Boundaries & Phase Limitations
- **Projections beyond Year 3:** Deferred.
- **Full 3-Statement Model:** Deferred.
- **Debt Amortization Schedules & Multi-Tranche Debt:** Deferred.
- **Purchase Accounting & Goodwill / Intangibles Amortization:** Deferred.
- **Phase 9 (Scenarios / FastAPI / Frontend):** NOT started.




