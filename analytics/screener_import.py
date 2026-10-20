"""
screener_import.py

Parses Screener.in "Export to Excel" files (the "Data Sheet" tab specifically)
into DealForge's normalized schema: one row per company in companies.csv,
one row per company-fiscal-year in financials.csv.

WHY THIS EXISTS
----------------
Screener's raw export is a semi-structured sheet: labeled rows in column A,
values in fixed-but-section-dependent columns to the right. Row *positions*
shift slightly between companies (more/fewer populated cost line items above
push things down), so we locate every field by its LABEL TEXT, not by row
number. This is what lets one parser run across all 113 files unattended.

KNOWN LIMITATIONS (see docs/data-dictionary.md for the full writeup):
  1. Screener's export does NOT include sector/industry. We join against a
     separately-maintained sector_mapping.csv (company_name -> sector,
     sector_type). Unmatched companies are reported, not silently dropped.
  2. EBITDA is not a stored field for annual periods; it's derived as
     PBT - Other Income + Depreciation + Interest. This formula is only
     financially meaningful for sector_type == "Industrial". For
     sector_type == "Financial" (banks/NBFCs), it's computed and stored
     but should NOT be used for EV/EBITDA screening/comps in V0.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl
import pandas as pd

DATA_SHEET_NAME = "Data Sheet"

# Labels we pull out of the annual PROFIT & LOSS block.
PL_FIELDS = [
    "Sales",
    "Other Income",
    "Depreciation",
    "Interest",
    "Profit before tax",
    "Tax",
    "Net profit",
]

# Labels we pull out of the annual BALANCE SHEET block.
BS_FIELDS = [
    "Equity Share Capital",
    "Reserves",
    "Borrowings",
    "Other Liabilities",
    "Cash & Bank",
    "No. of Equity Shares",
]

# Labels we pull out of the annual CASH FLOW block.
CF_FIELDS = [
    "Cash from Operating Activity",
    "Cash from Investing Activity",
    "Cash from Financing Activity",
    "Net Cash Flow",
]


@dataclass
class ParsedCompany:
    company_name: str
    source_file: str
    shares_outstanding_meta: float | None
    face_value: float | None
    current_price: float | None
    market_cap: float | None
    annual: pd.DataFrame  # one row per fiscal_year, wide columns
    warnings: list[str] = field(default_factory=list)


def _col_letter_to_label_row(ws) -> dict[str, int]:
    """Map every non-empty column-A label (as text) to its row index (1-based)."""
    labels: dict[str, int] = {}
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row):
        cell = row[0]
        if cell.value is not None and isinstance(cell.value, str):
            # Later duplicate labels (e.g. "Report Date" appears 3x) overwrite;
            # we handle that by locating sections first, see _section_bounds.
            labels.setdefault(cell.value.strip(), cell.row)
    return labels


def _section_bounds(ws) -> dict[str, tuple[int, int]]:
    """
    Find (start_row, end_row) for each of the three annual sections by
    locating the ALL-CAPS section header rows, which are stable anchors
    even when the labeled rows beneath them shift.
    """
    anchors = {}
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row):
        val = row[0].value
        if not isinstance(val, str):
            continue
        v = val.strip().upper()
        if v == "PROFIT & LOSS":
            anchors["PL"] = row[0].row
        elif v == "BALANCE SHEET":
            anchors["BS"] = row[0].row
        elif v.startswith("CASH FLOW"):
            anchors["CF"] = row[0].row
        elif v.startswith("PRICE"):
            anchors["PRICE"] = row[0].row

    bounds = {}
    if "PL" in anchors:
        bounds["PL"] = (anchors["PL"], anchors.get("BS", anchors["PL"] + 40) - 1)
    if "BS" in anchors:
        bounds["BS"] = (anchors["BS"], anchors.get("CF", anchors["BS"] + 40) - 1)
    if "CF" in anchors:
        bounds["CF"] = (anchors["CF"], anchors.get("PRICE", anchors["CF"] + 15) - 1)
    return bounds


def _extract_section(ws, start_row: int, end_row: int, wanted_fields: list[str]) -> pd.DataFrame:
    """
    Within one section, find the 'Report Date' row to get fiscal year-end
    dates and the column offsets they occupy, then pull each wanted field
    from the same column offsets on its own row.
    """
    report_date_row = None
    for r in range(start_row, end_row + 1):
        val = ws.cell(row=r, column=1).value
        if isinstance(val, str) and val.strip() == "Report Date":
            report_date_row = r
            break
    if report_date_row is None:
        return pd.DataFrame()

    # Identify which columns hold actual dates.
    date_cols = []
    for c in range(2, ws.max_column + 1):
        v = ws.cell(row=report_date_row, column=c).value
        if isinstance(v, dt.datetime):
            date_cols.append(c)

    fiscal_years = [ws.cell(row=report_date_row, column=c).value.year for c in date_cols]

    # Map label -> row within this section only.
    local_labels: dict[str, int] = {}
    for r in range(start_row, end_row + 1):
        val = ws.cell(row=r, column=1).value
        if isinstance(val, str):
            local_labels.setdefault(val.strip(), r)

    records = []
    for i, fy in enumerate(fiscal_years):
        rec = {"fiscal_year": fy}
        col = date_cols[i]
        for fname in wanted_fields:
            r = local_labels.get(fname)
            rec[fname] = ws.cell(row=r, column=col).value if r else None
        records.append(rec)

    return pd.DataFrame(records)


def parse_screener_file(filepath: str | Path) -> ParsedCompany:
    filepath = Path(filepath)
    wb = openpyxl.load_workbook(filepath, data_only=True)
    if DATA_SHEET_NAME not in wb.sheetnames:
        raise ValueError(f"{filepath.name}: no '{DATA_SHEET_NAME}' tab found")
    ws = wb[DATA_SHEET_NAME]

    warnings: list[str] = []

    # --- Company name + META ---
    labels = _col_letter_to_label_row(ws)
    company_name = None
    if "COMPANY NAME" in labels:
        company_name = ws.cell(row=labels["COMPANY NAME"], column=2).value
    if not company_name:
        company_name = filepath.stem.replace("_", " ")
        warnings.append("COMPANY NAME not found in file; used filename instead")

    def meta_val(label):
        r = labels.get(label)
        return ws.cell(row=r, column=2).value if r else None

    shares_meta = meta_val("Number of shares")
    face_value = meta_val("Face Value")
    current_price = meta_val("Current Price")
    market_cap = meta_val("Market Capitalization")

    # --- Sectioned annual data ---
    bounds = _section_bounds(ws)
    if "PL" not in bounds:
        warnings.append("PROFIT & LOSS section not found")
        pl = pd.DataFrame()
    else:
        pl = _extract_section(ws, *bounds["PL"], PL_FIELDS)

    if "BS" not in bounds:
        warnings.append("BALANCE SHEET section not found")
        bs = pd.DataFrame()
    else:
        bs = _extract_section(ws, *bounds["BS"], BS_FIELDS)

    if "CF" not in bounds:
        warnings.append("CASH FLOW section not found")
        cf = pd.DataFrame()
    else:
        cf = _extract_section(ws, *bounds["CF"], CF_FIELDS)

    # Merge PL + BS + CF on fiscal_year (outer join; some years may be missing
    # from one statement but present in another -- flag rather than drop).
    annual = pl
    for other in (bs, cf):
        if not other.empty:
            annual = annual.merge(other, on="fiscal_year", how="outer") if not annual.empty else other
    if annual.empty:
        warnings.append("No annual data could be parsed at all -- check file manually")
        annual = pd.DataFrame(columns=["fiscal_year"])

    annual = annual.sort_values("fiscal_year").reset_index(drop=True)

    # --- Derived fields ---
    # EBITDA = PBT - Other Income + Depreciation + Interest.
    # Meaningful for Industrial sector_type only -- see module docstring.
    if {"Profit before tax", "Other Income", "Depreciation", "Interest"}.issubset(annual.columns):
        annual["ebitda_derived"] = (
            annual["Profit before tax"].fillna(0)
            - annual["Other Income"].fillna(0)
            + annual["Depreciation"].fillna(0)
            + annual["Interest"].fillna(0)
        )
    else:
        annual["ebitda_derived"] = None
        warnings.append("Could not derive EBITDA -- missing one of PBT/Other Income/Depreciation/Interest")

    if "Sales" in annual.columns:
        annual["ebitda_margin_derived"] = annual.apply(
            lambda row: (row["ebitda_derived"] / row["Sales"]) if row.get("Sales") else None, axis=1
        )

    if {"Borrowings", "Cash & Bank"}.issubset(annual.columns):
        # net_debt = total_debt - cash.
        # IMPORTANT: do NOT fillna(0) on Borrowings -- unknown debt must not be treated
        # as zero debt. When Borrowings is NaN, net_debt_derived is NaN (unknown).
        # Cash & Bank is filled to 0 (conservative: missing cash treated as no cash).
        # Valid negative net debt is preserved when known debt < known cash.
        annual["net_debt_derived"] = annual["Borrowings"] - annual["Cash & Bank"].fillna(0)
    else:
        annual["net_debt_derived"] = None

    return ParsedCompany(
        company_name=str(company_name).strip(),
        source_file=filepath.name,
        shares_outstanding_meta=shares_meta,
        face_value=face_value,
        current_price=current_price,
        market_cap=market_cap,
        annual=annual,
        warnings=warnings,
    )


def parse_folder(raw_dir: str | Path) -> tuple[pd.DataFrame, pd.DataFrame, list[str]]:
    """
    Parse every .xlsx in raw_dir. Returns (companies_df, financials_df, warnings_log).
    companies_df: one row per company (identity + latest meta).
    financials_df: one row per company-fiscal_year (long format, matches DealForge schema).
    """
    raw_dir = Path(raw_dir)
    company_rows = []
    financial_rows = []
    all_warnings = []

    for xlsx_path in sorted(raw_dir.glob("*.xlsx")):
        if xlsx_path.name.startswith("~$"):
            continue
        try:
            parsed = parse_screener_file(xlsx_path)
        except Exception as e:
            all_warnings.append(f"{xlsx_path.name}: FAILED TO PARSE -- {e}")
            continue

        company_id = xlsx_path.stem  # placeholder ID until sector_mapping assigns tickers
        company_rows.append(
            {
                "company_id": company_id,
                "company_name": parsed.company_name,
                "source_file": parsed.source_file,
                "face_value": parsed.face_value,
                "current_price": parsed.current_price,
                "market_cap_latest": parsed.market_cap,
            }
        )

        for _, r in parsed.annual.iterrows():
            financial_rows.append(
                {
                    "company_id": company_id,
                    "fiscal_year": r.get("fiscal_year"),
                    "revenue": r.get("Sales"),
                    "other_income": r.get("Other Income"),
                    "depreciation": r.get("Depreciation"),
                    "interest": r.get("Interest"),
                    "pbt": r.get("Profit before tax"),
                    "tax": r.get("Tax"),
                    "net_income": r.get("Net profit"),
                    "ebitda_derived": r.get("ebitda_derived"),
                    "ebitda_margin_derived": r.get("ebitda_margin_derived"),
                    "total_debt": r.get("Borrowings"),
                    "cash": r.get("Cash & Bank"),
                    "net_debt_derived": r.get("net_debt_derived"),
                    "shares_outstanding": r.get("No. of Equity Shares"),
                    "cfo": r.get("Cash from Operating Activity"),
                    "cfi": r.get("Cash from Investing Activity"),
                    "cff": r.get("Cash from Financing Activity"),
                }
            )

        for w in parsed.warnings:
            all_warnings.append(f"{xlsx_path.name}: {w}")

    companies_df = pd.DataFrame(company_rows)
    financials_df = pd.DataFrame(financial_rows)
    return companies_df, financials_df, all_warnings


if __name__ == "__main__":
    import sys

    raw_dir = sys.argv[1] if len(sys.argv) > 1 else "data/raw"
    companies_df, financials_df, warnings = parse_folder(raw_dir)

    print(f"Parsed {len(companies_df)} companies, {len(financials_df)} company-year rows.")
    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for w in warnings:
            print(f"  - {w}")

    companies_df.to_csv("data/companies.csv", index=False)
    financials_df.to_csv("data/financials.csv", index=False)
    print("\nWrote data/companies.csv and data/financials.csv")
