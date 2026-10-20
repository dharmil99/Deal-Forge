"""
tests/test_dataset_service.py

Unit tests for DatasetService in backend/app/services/dataset_service.py.
Validates safe path resolution, in-memory caching, read-only guarantees,
and clean failure modes for missing datasets.
"""

from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from backend.app.core.errors import DatasetNotFoundError
from backend.app.services.dataset_service import DatasetService


@pytest.fixture
def dataset_service() -> DatasetService:
    """Provide a fresh DatasetService instance."""
    return DatasetService()


def test_dataset_paths_resolve(dataset_service: DatasetService) -> None:
    """Test that all canonical dataset names resolve to the expected relative files."""
    data_dir = dataset_service.data_dir
    assert data_dir.name == "data"
    assert data_dir.exists()

    expected_files = {
        "companies": "companies.csv",
        "financials": "financials.csv",
        "screening_results": "screening_results.csv",
        "sector_mapping": "sector_mapping.csv",
        "transactions": "transactions.csv",
    }

    for name, expected_filename in expected_files.items():
        path = dataset_service.resolve_dataset_path(name)
        assert path == data_dir / expected_filename
        assert path.exists(), f"File {expected_filename} should exist on disk"


def test_load_companies(dataset_service: DatasetService) -> None:
    """Test loading companies.csv: 113 companies, correct columns."""
    df = dataset_service.get_companies()
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 113
    expected_cols = {"company_id", "company_name", "face_value", "current_price", "market_cap_latest"}
    assert expected_cols.issubset(df.columns)
    assert dataset_service.is_cached("companies")


def test_load_financials(dataset_service: DatasetService) -> None:
    """Test loading financials.csv: 1,112 company-year rows, correct columns."""
    df = dataset_service.get_financials()
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 1112
    expected_cols = {"company_id", "fiscal_year", "revenue", "ebitda_derived", "net_income"}
    assert expected_cols.issubset(df.columns)
    assert dataset_service.is_cached("financials")


def test_load_transactions(dataset_service: DatasetService) -> None:
    """Test loading transactions.csv: 4 seed M&A transactions, correct columns."""
    df = dataset_service.get_transactions()
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 4
    expected_cols = {"transaction_id", "acquirer", "target", "deal_value_cr"}
    assert expected_cols.issubset(df.columns)
    assert dataset_service.is_cached("transactions")


def test_load_screening_results_and_sector_mapping(dataset_service: DatasetService) -> None:
    """Test loading screening_results.csv and sector_mapping.csv."""
    screening_df = dataset_service.get_screening_results()
    assert isinstance(screening_df, pd.DataFrame)
    assert len(screening_df) == 102  # 102 industrial companies

    sector_df = dataset_service.get_sector_mapping()
    assert isinstance(sector_df, pd.DataFrame)
    assert len(sector_df) == 113


def test_repeated_access_uses_cache(dataset_service: DatasetService) -> None:
    """Test that subsequent calls return cached data without reading from disk."""
    # First access loads into cache
    df1 = dataset_service.get_companies()
    assert dataset_service.is_cached("companies")

    # Spy on pandas.read_csv to ensure it is NOT called on second access
    with patch("pandas.read_csv") as mock_read_csv:
        df2 = dataset_service.get_companies()
        mock_read_csv.assert_not_called()

    # DataFrames contain the same data
    pd.testing.assert_frame_equal(df1, df2)


def test_missing_dataset_produces_clear_error(dataset_service: DatasetService) -> None:
    """Test that requesting a missing dataset raises DatasetNotFoundError with clear diagnostics."""
    nonexistent = "nonexistent_financial_data"
    with pytest.raises(DatasetNotFoundError) as exc_info:
        dataset_service.load_dataset(nonexistent)

    err = exc_info.value
    assert err.dataset_name == nonexistent
    assert "not found" in str(err)
    assert str(dataset_service.data_dir) in str(err)


def test_clear_cache(dataset_service: DatasetService) -> None:
    """Test clearing specific dataset from cache and clearing all."""
    dataset_service.get_companies()
    dataset_service.get_transactions()
    assert dataset_service.is_cached("companies")
    assert dataset_service.is_cached("transactions")

    # Clear single
    dataset_service.clear_cache("companies")
    assert not dataset_service.is_cached("companies")
    assert dataset_service.is_cached("transactions")

    # Clear all
    dataset_service.clear_cache()
    assert not dataset_service.is_cached("transactions")
    assert len(dataset_service.cached_datasets()) == 0


def test_works_with_custom_data_dir(tmp_path: Path) -> None:
    """Test that DatasetService operates correctly with any relative or custom data directory."""
    dummy_csv = tmp_path / "custom_test.csv"
    dummy_csv.write_text("id,val\nA,100\nB,200\n", encoding="utf-8")

    custom_service = DatasetService(data_dir=tmp_path)
    df = custom_service.load_dataset("custom_test")
    assert len(df) == 2
    assert list(df["id"]) == ["A", "B"]
