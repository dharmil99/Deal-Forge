import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics.screener_import import parse_screener_file, parse_folder

FIXTURE_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"


def test_parses_jio_financial_without_warnings():
    result = parse_screener_file(FIXTURE_DIR / "Jio_Financial.xlsx")
    assert result.company_name == "JIO FINANCIAL SERVICES LTD"
    assert result.warnings == []
    assert len(result.annual) == 4  # FY23-FY26


def test_ebitda_derivation_matches_manual_formula():
    result = parse_screener_file(FIXTURE_DIR / "Jio_Financial.xlsx")
    row = result.annual[result.annual["fiscal_year"] == 2026].iloc[0]
    expected = row["Profit before tax"] - row["Other Income"] + row["Depreciation"] + row["Interest"]
    assert abs(row["ebitda_derived"] - expected) < 0.01


def test_net_debt_definitional_identity():
    result = parse_screener_file(FIXTURE_DIR / "Jio_Financial.xlsx")
    for _, row in result.annual.iterrows():
        borrowings = row["Borrowings"] if pd.notna(row["Borrowings"]) else 0
        cash = row["Cash & Bank"] if pd.notna(row["Cash & Bank"]) else 0
        expected = borrowings - cash
        got = row["net_debt_derived"]
        assert abs(got - expected) < 0.01


def test_parse_folder_produces_linked_tables():
    companies_df, financials_df, warnings = parse_folder(FIXTURE_DIR)
    assert len(companies_df) >= 1
    # every financials.company_id must exist in companies.company_id
    assert set(financials_df["company_id"]).issubset(set(companies_df["company_id"]))
    # no duplicate (company_id, fiscal_year) pairs
    dupes = financials_df.duplicated(subset=["company_id", "fiscal_year"])
    assert not dupes.any()


def test_ebitda_margin_within_sane_bounds():
    _, financials_df, _ = parse_folder(FIXTURE_DIR)
    valid = financials_df["ebitda_margin_derived"].dropna()
    # NOTE: this bound is only meaningful for Industrial sector_type.
    # Financial-sector companies (like Jio Financial itself) can legitimately
    # fall outside typical industrial margin ranges once Interest dominates.
    # This test just guards against gross parsing errors (e.g. margin of 4000%).
    assert (valid.abs() < 5.0).all()
