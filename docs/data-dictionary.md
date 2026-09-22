# DealForge V0 Data Dictionary

## Source

All company financial data is sourced from Screener.in "Export to Excel"
files, parsed by `analytics/screener_import.py`. The parser reads the
**"Data Sheet"** tab only (the other tabs — Profit & Loss, Balance Sheet,
Cash Flow, Quarters — are display-formatted views of the same underlying
data and are not parsed).

## companies.csv

| Field | Type | Source |
|---|---|---|
| company_id | string (PK) | derived from source filename (placeholder until sector_mapping assigns a real ticker-based ID) |
| company_name | string | Data Sheet, "COMPANY NAME" |
| source_file | string | original .xlsx filename, kept for traceability/audit |
| face_value | float | Data Sheet META, "Face Value" |
| current_price | float | Data Sheet META, "Current Price" — price as of Screener export date, NOT a live feed |
| market_cap_latest | float | Data Sheet META, "Market Capitalization", ₹ Cr |

After parsing, this table is **joined with `sector_mapping.csv`** (see below)
to add sector, industry, and sector_type. Rows with no match are logged as
warnings, not silently dropped.

## financials.csv (long format: one row per company_id × fiscal_year)

| Field | Type | Source | Notes |
|---|---|---|---|
| company_id | string (FK) | | |
| fiscal_year | int | Data Sheet, "Report Date" row (year of the date) | |
| revenue | float | "Sales" | ₹ Cr |
| other_income | float | "Other Income" | non-operating |
| depreciation | float | "Depreciation" | |
| interest | float | "Interest" | |
| pbt | float | "Profit before tax" | |
| tax | float | "Tax" | |
| net_income | float | "Net profit" | |
| **ebitda_derived** | float | **derived**, see formula below | see sector_type caveat |
| **ebitda_margin_derived** | float | ebitda_derived / revenue | |
| total_debt | float | "Borrowings" | |
| cash | float | "Cash & Bank" | |
| **net_debt_derived** | float | total_debt − cash | |
| shares_outstanding | float | "No. of Equity Shares" | sometimes blank in source for latest year; falls back needed in V1 |
| cfo / cfi / cff | float | Cash Flow section | operating / investing / financing activity |

### EBITDA derivation formula

```
EBITDA = PBT − Other Income + Depreciation + Interest
```

This avoids depending on itemized cost line items (Raw Material, Employee
Cost, etc.) which are inconsistently populated across sectors — instead it
works backward from PBT, which Screener always reports.

**Caveat (important):** this formula treats Interest as a below-the-line
financing cost to add back. That's correct for industrials, IT, pharma,
consumer companies. It is **not meaningful for banks/NBFCs**, where interest
expense (cost of funds) is a core operating cost, not a financing add-back.
The field is still computed and stored for every company (so nothing is
silently missing), but `sector_type` must be checked before using it in
screening or comps:

- `sector_type == "Industrial"` → EV/EBITDA valid, used per Section 8/9 of
  the master spec.
- `sector_type == "Financial"` → EV/EBITDA should NOT be used. V0 excludes
  these companies from screening/comps entirely; V1 adds P/E and P/B-based
  equivalents instead.

## sector_mapping.csv (manually maintained)

Screener's export does not include sector/industry classification. This
file is maintained by hand (or scraped from Screener's website in a future
phase) and joined against companies.csv by company_name.

| Field | Type | Notes |
|---|---|---|
| company_id | string | must match companies.csv |
| company_name | string | for human readability / matching |
| ticker | string | NSE/BSE ticker |
| sector | string | e.g. "IT Services", "Financial Services" |
| industry | string | e.g. "NBFC", "Cement" |
| sector_type | string | "Industrial" or "Financial" — drives which valuation logic applies |

## Data quality invariants (enforced in tests/test_screener_import.py)

- `net_debt_derived == total_debt − cash` (definitional, always true by construction)
- `ebitda_margin_derived` between -1.0 and 1.0 for sector_type == "Industrial" (a margin outside this range signals a parsing error, not a real company)
- No fiscal_year duplicated within a single company_id
- Every company_id in financials.csv exists in companies.csv
