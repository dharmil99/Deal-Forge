"""
backend/app/services/utils.py

Data cleaning and serialization helpers for pandas and numpy interoperability.
Ensures that missing values (NaN, inf, pd.NA) are cleanly converted to None
without fabricating values or altering valid financial figures.
"""

from typing import Any
import numpy as np
import pandas as pd


def clean_nan(val: Any) -> Any:
    """
    Recursively convert float NaN/inf and pd.NA/NaT to None for clean JSON serialization.
    Preserves exact numeric values, strings, lists, and dicts.
    """
    if val is None:
        return None
    if isinstance(val, (pd.DataFrame, pd.Series)):
        return val
    if isinstance(val, (float, np.floating)):
        if np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    if isinstance(val, (int, np.integer)):
        return int(val)
    if isinstance(val, (bool, np.bool_)):
        return bool(val)
    if isinstance(val, dict):
        return {k: clean_nan(v) for k, v in val.items()}
    if isinstance(val, list):
        return [clean_nan(v) for v in val]
    try:
        if pd.isna(val):
            return None
    except Exception:
        pass
    return val
