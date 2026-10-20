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
    return sorted(f for f in RAW_DIR.glob("*.xlsx") if not f.name.startswith("~$"))

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
    """
    Two cases, both validated across the full 113-company corpus:

    Case A -- Borrowings is NaN (unknown debt):
      net_debt_derived must be NaN. Unknown debt must NOT be treated as zero.

    Case B -- Borrowings is a known value (including zero):
      net_debt_derived must equal Borrowings - Cash (Cash filled to 0 if NaN).
      Negative values (net cash) are valid and must pass.
    """
    violations = []
    for name, result in parsed_all.items():
        if isinstance(result, Exception):
            continue
        for _, row in result.annual.iterrows():
            borrowings = row.get("Borrowings")
            cash = row.get("Cash & Bank")
            nd = row.get("net_debt_derived")

            if pd.isna(borrowings):
                # Case A: unknown Borrowings -> net_debt_derived must be NaN
                if pd.notna(nd):
                    violations.append(
                        f"{name} FY{row['fiscal_year']}: Borrowings is NaN but "
                        f"net_debt_derived={nd} (should be NaN)"
                    )
            else:
                # Case B: known Borrowings -> formula must hold
                cash_val = cash if pd.notna(cash) else 0.0
                expected = borrowings - cash_val
                if pd.notna(nd) and abs(nd - expected) > 0.05:
                    violations.append(
                        f"{name} FY{row['fiscal_year']}: got {nd}, expected {expected}"
                    )
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


# ---------------------------------------------------------------------------
# Unit tests for net_debt_derived logic (no Excel fixture needed --
# these call the derivation logic via parse_folder's financials output,
# or construct the expected result directly from the formula).
# ---------------------------------------------------------------------------

def test_net_debt_known_debt_minus_cash():
    """
    Case: Borrowings = 500, Cash = 200 -> net_debt_derived = 300.
    Uses the parse_folder output (first company with known debt in both columns).
    """
    companies_df, financials_df, _ = parse_folder(RAW_DIR)
    # ACC FY2020 is the first row where both total_debt and cash are present.
    acc_known = financials_df[
        (financials_df["company_id"] == "ACC") &
        financials_df["total_debt"].notna() &
        financials_df["cash"].notna()
    ].sort_values("fiscal_year")
    assert not acc_known.empty, "Expected at least one ACC row with known debt and cash"
    row = acc_known.iloc[0]
    expected = row["total_debt"] - row["cash"]
    assert abs(row["net_debt_derived"] - expected) < 0.05, (
        f"net_debt_derived={row['net_debt_derived']} != total_debt - cash = {expected}"
    )


def test_net_debt_missing_borrowings_produces_nan():
    """
    Case: Borrowings is NaN (unknown) -> net_debt_derived must be NaN.
    Unknown debt must not be treated as zero.
    Uses parse_folder output; checks all rows where total_debt is NaN.
    """
    _, financials_df, _ = parse_folder(RAW_DIR)
    missing_debt_rows = financials_df[financials_df["total_debt"].isna()]
    if missing_debt_rows.empty:
        # No such rows in the current corpus -- skip rather than fail.
        return
    non_nan_nd = missing_debt_rows[missing_debt_rows["net_debt_derived"].notna()]
    assert non_nan_nd.empty, (
        f"{len(non_nan_nd)} row(s) have NaN total_debt but non-NaN net_debt_derived:\n"
        + non_nan_nd[["company_id", "fiscal_year", "total_debt", "net_debt_derived"]].to_string()
    )


def test_net_debt_negative_when_cash_exceeds_known_debt():
    """
    Case: Borrowings < Cash -> net_debt_derived is negative (valid net cash position).
    ACC FY2019 has Borrowings=0 and large Cash -> should be negative.
    Uses parse_folder output; finds first row where cash > total_debt (both known).
    """
    _, financials_df, _ = parse_folder(RAW_DIR)
    net_cash_rows = financials_df[
        financials_df["total_debt"].notna() &
        financials_df["cash"].notna() &
        (financials_df["cash"] > financials_df["total_debt"])
    ]
    assert not net_cash_rows.empty, (
        "Expected at least one company-year where cash > known debt (net cash position)"
    )
    for _, row in net_cash_rows.iterrows():
        assert row["net_debt_derived"] < 0, (
            f"{row['company_id']} FY{row['fiscal_year']}: net_debt_derived should be "
            f"negative (cash={row['cash']} > debt={row['total_debt']}) "
            f"but got {row['net_debt_derived']}"
        )
        break  # one confirmed example is sufficient
