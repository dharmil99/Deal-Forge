"""
backend/app/services/dataset_service.py

In-memory caching and safe data access service for DealForge CSV datasets.
Provides read-only access to source datasets without modifying financial data
or introducing database dependencies.
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

from backend.app.core.config import get_settings
from backend.app.core.errors import DatasetNotFoundError

logger = logging.getLogger("dealforge.services.dataset")


class DatasetService:
    """Service providing read-only, in-memory cached access to DealForge CSV datasets."""

    STANDARD_DATASETS: Dict[str, str] = {
        "companies": "companies.csv",
        "financials": "financials.csv",
        "screening_results": "screening_results.csv",
        "sector_mapping": "sector_mapping.csv",
        "transactions": "transactions.csv",
    }

    def __init__(self, data_dir: Optional[Path] = None) -> None:
        """
        Initialize DatasetService.

        Args:
            data_dir: Optional custom path to data directory. Defaults to
                      settings.data_dir.
        """
        self._data_dir = Path(data_dir) if data_dir is not None else get_settings().data_dir
        self._cache: Dict[str, pd.DataFrame] = {}

    @property
    def data_dir(self) -> Path:
        """Return the resolved data directory path."""
        return self._data_dir

    def resolve_dataset_path(self, dataset_name: str) -> Path:
        """
        Resolve the file path for a given dataset name.

        Args:
            dataset_name: Canonical name (e.g. 'companies') or filename ('companies.csv').

        Returns:
            Path object pointing to the expected dataset file.
        """
        filename = self.STANDARD_DATASETS.get(dataset_name)
        if not filename:
            if dataset_name.endswith(".csv"):
                filename = dataset_name
            else:
                filename = f"{dataset_name}.csv"
        return self._data_dir / filename

    def load_dataset(self, dataset_name: str, force_reload: bool = False) -> pd.DataFrame:
        """
        Load a dataset into memory with caching.

        Args:
            dataset_name: Key identifying the dataset.
            force_reload: If True, bypass in-memory cache and re-read from disk.

        Returns:
            Read-only shallow copy of the cached DataFrame.

        Raises:
            DatasetNotFoundError: If the CSV file does not exist on disk.
        """
        canonical_key = dataset_name.lower().replace(".csv", "")
        if not force_reload and canonical_key in self._cache:
            # Return shallow copy to prevent external mutation of cached structure
            return self._cache[canonical_key].copy(deep=False)

        path = self.resolve_dataset_path(dataset_name)
        if not path.is_file():
            logger.error("Dataset file missing: %s", path)
            raise DatasetNotFoundError(dataset_name=dataset_name, path=str(path))

        logger.info("Loading dataset '%s' from %s", canonical_key, path)
        # Load unmodified CSV without filling missing values or altering datatypes
        df = pd.read_csv(path)
        self._cache[canonical_key] = df

        return df.copy(deep=False)

    def is_cached(self, dataset_name: str) -> bool:
        """Check if a dataset is currently held in in-memory cache."""
        canonical_key = dataset_name.lower().replace(".csv", "")
        return canonical_key in self._cache

    def clear_cache(self, dataset_name: Optional[str] = None) -> None:
        """
        Clear in-memory cache for a single dataset or all datasets.

        Args:
            dataset_name: If specified, clear only this dataset. Otherwise clear all.
        """
        if dataset_name is not None:
            canonical_key = dataset_name.lower().replace(".csv", "")
            self._cache.pop(canonical_key, None)
        else:
            self._cache.clear()

    def cached_datasets(self) -> List[str]:
        """Return list of dataset keys currently cached in memory."""
        return sorted(list(self._cache.keys()))

    def preload_all(self) -> Dict[str, pd.DataFrame]:
        """
        Preload all standard datasets into in-memory cache.

        Returns:
            Dict mapping dataset names to loaded DataFrames.
        """
        loaded = {}
        for name in self.STANDARD_DATASETS:
            loaded[name] = self.load_dataset(name)
        return loaded

    # -------------------------------------------------------------------------
    # Convenience Accessors for Canonical Datasets
    # -------------------------------------------------------------------------

    def get_companies(self, force_reload: bool = False) -> pd.DataFrame:
        """Return companies dataset (companies.csv)."""
        return self.load_dataset("companies", force_reload=force_reload)

    def get_financials(self, force_reload: bool = False) -> pd.DataFrame:
        """Return financials dataset (financials.csv)."""
        return self.load_dataset("financials", force_reload=force_reload)

    def get_screening_results(self, force_reload: bool = False) -> pd.DataFrame:
        """Return screening results dataset (screening_results.csv)."""
        return self.load_dataset("screening_results", force_reload=force_reload)

    def get_sector_mapping(self, force_reload: bool = False) -> pd.DataFrame:
        """Return sector mapping dataset (sector_mapping.csv)."""
        return self.load_dataset("sector_mapping", force_reload=force_reload)

    def get_transactions(self, force_reload: bool = False) -> pd.DataFrame:
        """Return precedent transactions dataset (transactions.csv)."""
        return self.load_dataset("transactions", force_reload=force_reload)

    def get_metrics(self, force_reload: bool = False) -> pd.DataFrame:
        """
        Return company metrics DataFrame computed via analytics.screening.compute_metrics.
        Cached in memory to prevent recomputation across request cycles.
        """
        if not force_reload and "metrics" in self._cache:
            return self._cache["metrics"].copy(deep=False)

        from analytics.screening import compute_metrics

        financials = self.get_financials(force_reload=force_reload)
        companies = self.get_companies(force_reload=force_reload)
        sectors = self.get_sector_mapping(force_reload=force_reload)
        metrics = compute_metrics(financials, companies, sectors)
        self._cache["metrics"] = metrics
        return metrics.copy(deep=False)

    def get_loaded_transactions(self, force_reload: bool = False) -> pd.DataFrame:
        """
        Return transactions loaded via analytics.precedents.load_transactions
        with implied_ev_cr, ev_revenue, and ev_ebitda derived.
        """
        if not force_reload and "loaded_transactions" in self._cache:
            return self._cache["loaded_transactions"].copy(deep=False)

        from analytics.precedents import load_transactions

        path = self.resolve_dataset_path("transactions")
        if not path.is_file():
            logger.error("Transactions dataset file missing: %s", path)
            raise DatasetNotFoundError(dataset_name="transactions", path=str(path))

        tx = load_transactions(str(path))
        self._cache["loaded_transactions"] = tx
        return tx.copy(deep=False)
