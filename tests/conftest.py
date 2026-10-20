"""
tests/conftest.py

Shared pytest infrastructure for DealForge tests.

PURPOSE
-------
This conftest provides:
  1. A project-root sys.path insert (so imports work from any working
     directory without needing it in every test file).
  2. Shared pytest markers and configuration.
  3. Shared synthetic data fixtures that are used across multiple test
     modules -- currently just the data-dir path fixture, because the
     per-module synthetic fixtures in test_screening.py and test_comps.py
     are not yet shared (they are still defined locally to avoid a broad
     refactor). Move them here once Phase 5 tests are written and a second
     consumer exists.

PHILOSOPHY
----------
Fixtures that are used by only ONE test module belong IN that module.
Move fixtures here only when a second test module needs the same data,
to keep the conftest from becoming a dumping ground.
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

# Ensure the project root is always on sys.path regardless of which
# directory pytest is invoked from.
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))


# ---------------------------------------------------------------------------
# Path fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def data_dir() -> Path:
    """Absolute path to the project data/ directory."""
    return _PROJECT_ROOT / "data"


@pytest.fixture(scope="session")
def raw_dir(data_dir: Path) -> Path:
    """Absolute path to the data/raw/ directory containing Screener .xlsx exports."""
    return data_dir / "raw"


@pytest.fixture(scope="session")
def transactions_path(data_dir: Path) -> Path:
    """Absolute path to data/transactions.csv."""
    return data_dir / "transactions.csv"
