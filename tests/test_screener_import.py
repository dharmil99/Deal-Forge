"""
Data quality tests for the Screener parser.

These are written to run against WHATEVER .xlsx files currently sit in
data/raw/ -- not a fixed fixture list. As you drop in more of the 113
companies, running `pytest tests/` re-validates every one of them
automatically. A failure here means a real parsing problem on a specific
company, not a hypothetical edge case.
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics.screener_import import parse_screener_file, parse_folder

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"


def _raw_files():
    return sorted(RAW_DIR.glob("*.xlsx"))


@pytest.fixture(scope="module")
def parsed_all():
    """Parse every file once per test run, share across tests for speed."""
    results = {}
    for f in _raw_files():
        try:
            results[f.name] = parse_screener_file(f)
        except Exception as e:
            results[f.name] = e
    return results


def test_every_file_parses_without_exception(parsed_all):
    failures = {name: r for name, r in parsed_all.items() if isinstance(r, Exception)}
    assert not failures, f"{len(failures)} file(s) raised exceptions:\n" + "\n".join(
        f"  - {name}: {err}" for name, err in failures.items()
    )


def test_every_file_has_a_company_name(parsed_all):
    unnamed = [name for name, r in parsed_all.items() if not isinstance(r, Exception) and not r.company_name]
    assert not unnamed, f"Files with no company name found: {unnamed}"


def test_ebitda_formula_holds_for_every_company_year(parsed_all):
    """
    EBITDA = PBT - Other Income + Depreciation + Interest, exactly, since
    it's an arithmetic identity by construction -- if this ever fails it
    means a column got misaligned during parsing, not a data-quality issue
    with the underlying company.
    """
    violations = []
    for name, result in parsed_all.items():
        if isinstance(result, Exception):
            continue
        for _, row in result.annual.iterrows():
            required = ["Profit before tax", "Other Income", "Depreciation", "Interest", "ebitda_derived"]
            if any(pd.isna(row.get(f)) for f in required):
                continue
            expected = row["Profit before tax"] - row["Other Income"] + row["Depreciation"] + row["Interest"]
            if abs(row["ebitda_derived"] - expected) > 0.05:
                violations.append(f"{name} FY{row['fiscal_year']}: got {row['ebitda_derived']}, expected {expected}")
    assert not violations, "\n".join(violations)


def test_net_debt_formula_holds_for_every_company_year(parsed_all):
    violations = []
    for name, result in parsed_all.items():
        if isinstance(result, Exception):
            continue
        for _, row in result.annual.iterrows():
            borrowings = row["Borrowings"] if pd.notna(row["Borrowings"]) else 0
            cash = row["Cash & Bank"] if pd.notna(row["Cash & Bank"]) else 0
            expected = borrowings - cash
            if pd.notna(row["net_debt_derived"]) and abs(row["net_debt_derived"] - expected) > 0.05:
                violations.append(f"{name} FY{row['fiscal_year']}: got {row['net_debt_derived']}, expected {expected}")
    assert not violations, "\n".join(violations)


def test_no_duplicate_fiscal_years_within_a_company(parsed_all):
    violations = []
    for name, result in parsed_all.items():
        if isinstance(result, Exception):
            continue
        dupes = result.annual["fiscal_year"].duplicated()
        if dupes.any():
            violations.append(f"{name}: duplicate fiscal_year(s) {result.annual['fiscal_year'][dupes].tolist()}")
    assert not violations, "\n".join(violations)


def test_ebitda_margin_within_sane_bounds(parsed_all):
    """
    Loose bound (|margin| < 5.0) -- this only guards against gross parsing
    errors (e.g. a margin of 4000% from a column misalignment), not real
    business variation. Financial-sector companies can legitimately sit
    outside typical industrial ranges; this is not a sector_type check.
    """
    violations = []
    for name, result in parsed_all.items():
        if isinstance(result, Exception):
            continue
        bad = result.annual[result.annual["ebitda_margin_derived"].abs() > 5.0]
        if not bad.empty:
            violations.append(f"{name}: suspicious margin(s) in FY {bad['fiscal_year'].tolist()}")
    assert not violations, "\n".join(violations)


def test_parse_folder_produces_linked_tables():
    companies_df, financials_df, warnings = parse_folder(RAW_DIR)
    assert len(companies_df) == len(_raw_files())
    assert set(financials_df["company_id"]).issubset(set(companies_df["company_id"]))
    dupes = financials_df.duplicated(subset=["company_id", "fiscal_year"])
    assert not dupes.any()


def test_report_warning_summary(parsed_all, capsys):
    """
    Not a pass/fail check -- prints a summary of every warning across every
    file so you have one place to look after a full 113-file run. Run with
    `pytest tests/ -s` to see this output.
    """
    total_warnings = 0
    for name, result in parsed_all.items():
        if isinstance(result, Exception):
            print(f"{name}: EXCEPTION -- {result}")
            total_warnings += 1
            continue
        for w in result.warnings:
            print(f"{name}: {w}")
            total_warnings += 1
    print(f"\n{len(parsed_all)} files checked, {total_warnings} warning(s)/failure(s) total.")
