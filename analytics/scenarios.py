"""
scenarios.py

Phase 9: Scenario Analysis & Sensitivity Analysis.

Deterministic orchestration layer that evaluates multiple transaction
assumption sets through the EXISTING Deal Builder → Sources & Uses →
Accretion/Dilution pipeline.

CRITICAL ARCHITECTURAL RULE
----------------------------
This module does NOT contain any financial calculation logic.

Scenario logic determines WHAT assumptions change.
Existing financial engines (deal_model.py, sources_uses.py,
accretion_dilution.py) determine WHAT the resulting transaction means.

No duplicate:
  - purchase price formulas
  - transaction EV
  - financing calculations
  - cash availability
  - debt issuance fees
  - Sources & Uses balancing
  - EPS
  - synergy treatment
  - A/D
  - break-even synergy

DESIGN REFERENCE
-----------------
DESIGN_SYSTEM.md.md Section 6: Scenario Analysis UI (Phase 9)
  - Scenario inputs map 1-to-1 onto parameters that
    calculate_accretion_dilution_from_universe already accepts.
  - Base / Downside / Upside / Custom are saved parameter sets.
  - Sensitivity matrices invoke the same pipeline per cell.
"""

from __future__ import annotations

import copy
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add project root to sys.path so standalone execution works
_PROJECT_ROOT = str(Path(__file__).resolve().parents[1])
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import pandas as pd

from analytics.accretion_dilution import (
    calculate_accretion_dilution,
    calculate_accretion_dilution_from_universe,
)
from analytics.deal_model import build_deal_from_universe
from analytics.sources_uses import build_sources_and_uses


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Supported scenario types
SCENARIO_TYPES = ("BASE", "UPSIDE", "DOWNSIDE", "CUSTOM")

# Maximum sensitivity matrix dimensions
MAX_SENSITIVITY_AXIS = 20

# All supported assumption parameters (maps to the existing deterministic
# engine parameters). This is the single source of truth for what can be
# varied in scenarios and sensitivity analysis.
SUPPORTED_ASSUMPTIONS = {
    "acquisition_premium",
    "cash_pct",
    "debt_pct",
    "stock_pct",
    "transaction_fees",
    "debt_issuance_fee_pct",
    "minimum_cash_balance",
    "refinance_target_debt",
    "use_target_cash",
    "debt_interest_rate",
    "foregone_cash_interest_rate",
    "tax_rate",
    "synergy_year_1",
    "synergy_year_2",
    "synergy_year_3",
    "expected_annual_synergies",
}

# Supported sensitivity output metrics
SUPPORTED_OUTPUT_METRICS = {
    "year_1_eps",
    "year_1_ad_pct",
    "year_2_eps",
    "year_2_ad_pct",
    "year_3_eps",
    "year_3_ad_pct",
    "break_even_gross_synergy",
    "transaction_ev",
    "purchase_equity_value",
    "is_feasible",
}

# Supported sensitivity input variables (subset of assumptions that are
# numeric and can be varied across a range)
SUPPORTED_SENSITIVITY_VARIABLES = {
    "acquisition_premium",
    "cash_pct",
    "debt_pct",
    "stock_pct",
    "transaction_fees",
    "debt_issuance_fee_pct",
    "minimum_cash_balance",
    "debt_interest_rate",
    "foregone_cash_interest_rate",
    "tax_rate",
    "synergy_year_1",
    "synergy_year_2",
    "synergy_year_3",
    "expected_annual_synergies",
}


# ---------------------------------------------------------------------------
# Default Assumptions
# ---------------------------------------------------------------------------

DEFAULT_ASSUMPTIONS: Dict[str, Any] = {
    "acquisition_premium": 0.20,
    "cash_pct": 0.02,
    "debt_pct": 0.60,
    "stock_pct": 0.38,
    "transaction_fees": 0.0,
    "debt_issuance_fee_pct": 0.02,
    "minimum_cash_balance": 1000.0,
    "refinance_target_debt": True,
    "use_target_cash": True,
    "debt_interest_rate": 0.08,
    "foregone_cash_interest_rate": 0.05,
    "tax_rate": 0.25,
    "synergy_year_1": None,
    "synergy_year_2": None,
    "synergy_year_3": None,
    "expected_annual_synergies": 0.0,
}


# ---------------------------------------------------------------------------
# Scenario Definition
# ---------------------------------------------------------------------------

class ScenarioDefinition:
    """
    A named set of transaction assumption overrides.

    The base scenario represents the active transaction assumptions.
    An override changes only explicitly supplied assumptions.
    """

    def __init__(
        self,
        name: str,
        scenario_type: str = "CUSTOM",
        description: str = "",
        overrides: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not name or not name.strip():
            raise ValueError("Scenario name cannot be empty.")

        scenario_type = scenario_type.upper()
        if scenario_type not in SCENARIO_TYPES:
            raise ValueError(
                f"Invalid scenario type '{scenario_type}'. "
                f"Must be one of: {', '.join(SCENARIO_TYPES)}"
            )

        if overrides:
            unknown = set(overrides.keys()) - SUPPORTED_ASSUMPTIONS
            if unknown:
                raise ValueError(
                    f"Unsupported assumption parameters: {', '.join(sorted(unknown))}. "
                    f"Supported: {', '.join(sorted(SUPPORTED_ASSUMPTIONS))}"
                )

        self.name = name.strip()
        self.scenario_type = scenario_type
        self.description = description
        self.overrides = overrides or {}

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "scenario_type": self.scenario_type,
            "description": self.description,
            "overrides": dict(self.overrides),
        }


# ---------------------------------------------------------------------------
# Assumption Resolution
# ---------------------------------------------------------------------------

def resolve_assumptions(
    base_assumptions: Dict[str, Any],
    overrides: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Merge overrides into base assumptions. Only explicitly supplied
    overrides change values; all unspecified assumptions remain identical
    to base.

    Parameters
    ----------
    base_assumptions : dict
        The base scenario assumption set.
    overrides : dict
        Only the parameters to change.

    Returns
    -------
    dict
        Complete resolved assumption set.
    """
    resolved = dict(base_assumptions)
    for key, value in overrides.items():
        if key not in SUPPORTED_ASSUMPTIONS:
            raise ValueError(f"Unsupported assumption: {key}")
        resolved[key] = value
    return resolved


def validate_assumptions(assumptions: Dict[str, Any]) -> List[str]:
    """
    Validate a complete assumption set. Returns list of validation errors.
    Does NOT silently normalize — returns errors for the caller to handle.
    """
    errors: List[str] = []

    cash_pct = assumptions.get("cash_pct", 0.0)
    debt_pct = assumptions.get("debt_pct", 0.0)
    stock_pct = assumptions.get("stock_pct", 0.0)

    # All three must be present and numeric
    try:
        mix_sum = float(cash_pct) + float(debt_pct) + float(stock_pct)
        if abs(mix_sum - 1.0) > 1e-4:
            errors.append(
                f"Financing mix must sum to 100%. "
                f"Got cash={cash_pct}, debt={debt_pct}, stock={stock_pct} (sum={mix_sum:.4f})"
            )
    except (TypeError, ValueError):
        errors.append("Financing percentages must be numeric values.")

    # Validate numeric ranges
    premium = assumptions.get("acquisition_premium")
    if premium is not None:
        try:
            p = float(premium)
            if p < -0.5 or p > 5.0:
                errors.append(f"Acquisition premium {p} is outside reasonable range [-0.5, 5.0].")
        except (TypeError, ValueError):
            errors.append("acquisition_premium must be numeric.")

    tax_rate = assumptions.get("tax_rate")
    if tax_rate is not None:
        try:
            t = float(tax_rate)
            if t < 0.0 or t >= 1.0:
                errors.append(f"tax_rate must be in [0.0, 1.0), got {t}.")
        except (TypeError, ValueError):
            errors.append("tax_rate must be numeric.")

    debt_rate = assumptions.get("debt_interest_rate")
    if debt_rate is not None:
        try:
            d = float(debt_rate)
            if d < 0.0:
                errors.append(f"debt_interest_rate cannot be negative, got {d}.")
        except (TypeError, ValueError):
            errors.append("debt_interest_rate must be numeric.")

    cash_yield = assumptions.get("foregone_cash_interest_rate")
    if cash_yield is not None:
        try:
            c = float(cash_yield)
            if c < 0.0:
                errors.append(f"foregone_cash_interest_rate cannot be negative, got {c}.")
        except (TypeError, ValueError):
            errors.append("foregone_cash_interest_rate must be numeric.")

    return errors


# ---------------------------------------------------------------------------
# Single Scenario Execution
# ---------------------------------------------------------------------------

def execute_scenario(
    acquirer_id: str,
    target_id: str,
    metrics_df: pd.DataFrame,
    financials_df: pd.DataFrame,
    assumptions: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Execute a single scenario through the complete deterministic pipeline:
    Deal Builder → Sources & Uses → Accretion/Dilution.

    Parameters
    ----------
    acquirer_id : str
        Acquirer company identifier.
    target_id : str
        Target company identifier.
    metrics_df : pd.DataFrame
        Screening metrics dataframe.
    financials_df : pd.DataFrame
        Financial history dataframe.
    assumptions : dict
        Complete resolved assumption set.

    Returns
    -------
    dict
        Full pipeline result including deal, sources_uses, and accretion_dilution.
    """
    # Step 1: Build Deal (Phase 6)
    deal = build_deal_from_universe(
        acquirer_id=acquirer_id,
        target_id=target_id,
        metrics_df=metrics_df,
        financials_df=financials_df,
        acquisition_premium=assumptions.get("acquisition_premium", 0.20),
        cash_pct=assumptions.get("cash_pct", 0.50),
        debt_pct=assumptions.get("debt_pct", 0.30),
        stock_pct=assumptions.get("stock_pct", 0.20),
        transaction_fees=assumptions.get("transaction_fees", 0.0),
        expected_annual_synergies=assumptions.get("expected_annual_synergies", 0.0),
    )

    # Step 2: Build Sources & Uses (Phase 7)
    su = build_sources_and_uses(
        deal=deal,
        refinance_target_debt=assumptions.get("refinance_target_debt", False),
        use_target_cash=assumptions.get("use_target_cash", False),
        debt_issuance_fee_pct=assumptions.get("debt_issuance_fee_pct", 0.0),
        minimum_cash_balance=assumptions.get("minimum_cash_balance", 0.0),
    )

    # Step 3: Accretion / Dilution (Phase 8)
    ad = calculate_accretion_dilution(
        buyer=deal.get("acquirer", {}),
        target=deal.get("target", {}),
        deal=deal,
        sources_uses=su,
        debt_interest_rate=assumptions.get("debt_interest_rate", 0.08),
        foregone_cash_interest_rate=assumptions.get("foregone_cash_interest_rate", 0.05),
        tax_rate=assumptions.get("tax_rate", 0.25),
        synergy_year_1=assumptions.get("synergy_year_1"),
        synergy_year_2=assumptions.get("synergy_year_2"),
        synergy_year_3=assumptions.get("synergy_year_3"),
    )

    return {
        "deal": deal,
        "sources_uses": su,
        "accretion_dilution": ad,
    }


# ---------------------------------------------------------------------------
# Scenario Result Extraction
# ---------------------------------------------------------------------------

def extract_scenario_result(
    scenario_def: ScenarioDefinition,
    assumptions: Dict[str, Any],
    pipeline_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Extract a structured scenario result from pipeline output.

    Returns enough information for the eventual UI to compare transactions.
    """
    deal = pipeline_result["deal"]
    su = pipeline_result["sources_uses"]
    ad = pipeline_result["accretion_dilution"]

    # Identity
    identity = {
        "name": scenario_def.name,
        "scenario_type": scenario_def.scenario_type,
        "description": scenario_def.description,
    }

    # Assumptions
    assumptions_section = {
        "effective": dict(assumptions),
        "overrides": dict(scenario_def.overrides),
    }

    # Deal section
    txn = deal.get("transaction", {})
    financing = deal.get("financing", {})
    deal_section = {
        "purchase_equity_value": txn.get("purchase_equity_value"),
        "offer_price_per_share": txn.get("offer_price_per_share"),
        "transaction_enterprise_value": txn.get("transaction_enterprise_value"),
        "cash_amount": financing.get("cash_amount"),
        "debt_amount": financing.get("debt_amount"),
        "stock_amount": financing.get("stock_amount"),
        "cash_pct": financing.get("cash_pct"),
        "debt_pct": financing.get("debt_pct"),
        "stock_pct": financing.get("stock_pct"),
    }

    # Sources & Uses section
    su_sources = su.get("sources", {})
    su_uses = su.get("uses", {})
    rec = su.get("reconciliation", {})
    cash_rec = su.get("cash_reconciliation", {})
    sources_uses_section = {
        "total_uses": su_uses.get("total_uses", su_uses.get("total")),
        "total_sources": su_sources.get("total_sources", su_sources.get("total")),
        "buyer_cash": su_sources.get("acquirer_cash"),
        "new_debt": su_sources.get("new_debt"),
        "stock_issuance": su_sources.get("stock_issuance"),
        "target_cash": su_sources.get("target_cash_sweep", su_sources.get("target_cash", 0.0)),
        "balance": rec.get("difference", 0.0) if rec.get("difference") is not None else su.get("balance"),
        "is_feasible": rec.get("is_feasible", True),
        "pro_forma_cash": cash_rec.get("pro_forma_combined_cash", rec.get("pro_forma_cash")),
    }

    # A/D section
    standalone = ad.get("standalone", {})
    pf = ad.get("pro_forma", {})
    be = ad.get("break_even", {})
    years_data = pf.get("years", {})

    def _year_data(key: str) -> dict:
        yd = years_data.get(key, {})
        bed = be.get(key, {})
        return {
            "eps": yd.get("pro_forma_eps"),
            "accretion_dilution_pct": yd.get("accretion_dilution_pct"),
            "status": yd.get("status"),
            "break_even_gross_synergy": bed.get("break_even_gross_synergy"),
        }

    ad_section = {
        "standalone_eps": standalone.get("buyer_eps"),
        "year_1": _year_data("year_1"),
        "year_2": _year_data("year_2"),
        "year_3": _year_data("year_3"),
    }

    # Diagnostics
    warnings = []
    for w in deal.get("warnings", []):
        if w not in warnings:
            warnings.append(w)
    for w in su.get("warnings", []):
        if w not in warnings:
            warnings.append(w)
    for w in ad.get("diagnostics", []):
        if w not in warnings:
            warnings.append(w)

    return {
        "identity": identity,
        "assumptions": assumptions_section,
        "deal": deal_section,
        "sources_uses": sources_uses_section,
        "accretion_dilution": ad_section,
        "diagnostics": {
            "warnings": warnings,
            "is_feasible": ad.get("is_feasible", True),
            "is_available": ad.get("is_available", True),
        },
    }


# ---------------------------------------------------------------------------
# Run Multiple Scenarios
# ---------------------------------------------------------------------------

def run_scenarios(
    acquirer_id: str,
    target_id: str,
    metrics_df: pd.DataFrame,
    financials_df: pd.DataFrame,
    base_assumptions: Dict[str, Any],
    scenarios: List[ScenarioDefinition],
) -> Dict[str, Any]:
    """
    Execute multiple scenarios and return structured comparison results.

    Parameters
    ----------
    acquirer_id : str
        Acquirer company identifier.
    target_id : str
        Target company identifier.
    metrics_df : pd.DataFrame
        Screening metrics dataframe.
    financials_df : pd.DataFrame
        Financial history dataframe.
    base_assumptions : dict
        The base assumption set that scenarios override.
    scenarios : list[ScenarioDefinition]
        List of scenario definitions to evaluate.

    Returns
    -------
    dict
        Comparison result containing all scenario outputs.
    """
    if not scenarios:
        raise ValueError("At least one scenario must be provided.")

    results = []
    for scenario in scenarios:
        # Resolve: base + overrides
        resolved = resolve_assumptions(base_assumptions, scenario.overrides)

        # Validate
        validation_errors = validate_assumptions(resolved)
        if validation_errors:
            # Include as a failed scenario result rather than throwing
            results.append({
                "identity": scenario.to_dict(),
                "assumptions": {
                    "effective": resolved,
                    "overrides": dict(scenario.overrides),
                },
                "deal": None,
                "sources_uses": None,
                "accretion_dilution": None,
                "diagnostics": {
                    "warnings": validation_errors,
                    "is_feasible": False,
                    "is_available": False,
                    "validation_errors": validation_errors,
                },
            })
            continue

        # Execute through deterministic pipeline
        pipeline_result = execute_scenario(
            acquirer_id=acquirer_id,
            target_id=target_id,
            metrics_df=metrics_df,
            financials_df=financials_df,
            assumptions=resolved,
        )

        result = extract_scenario_result(scenario, resolved, pipeline_result)
        results.append(result)

    return {
        "acquirer_id": acquirer_id,
        "target_id": target_id,
        "scenario_count": len(results),
        "scenarios": results,
    }


# ---------------------------------------------------------------------------
# Output Metric Extraction
# ---------------------------------------------------------------------------

def _extract_output_metric(
    pipeline_result: Dict[str, Any],
    output_metric: str,
) -> Any:
    """
    Extract a single output metric from a pipeline execution result.

    Returns the metric value, or None if unavailable.
    """
    deal = pipeline_result["deal"]
    ad = pipeline_result["accretion_dilution"]

    pf = ad.get("pro_forma", {})
    years = pf.get("years", {})
    be = ad.get("break_even", {})

    if output_metric == "year_1_eps":
        return years.get("year_1", {}).get("pro_forma_eps")
    elif output_metric == "year_1_ad_pct":
        return years.get("year_1", {}).get("accretion_dilution_pct")
    elif output_metric == "year_2_eps":
        return years.get("year_2", {}).get("pro_forma_eps")
    elif output_metric == "year_2_ad_pct":
        return years.get("year_2", {}).get("accretion_dilution_pct")
    elif output_metric == "year_3_eps":
        return years.get("year_3", {}).get("pro_forma_eps")
    elif output_metric == "year_3_ad_pct":
        return years.get("year_3", {}).get("accretion_dilution_pct")
    elif output_metric == "break_even_gross_synergy":
        return be.get("year_1", {}).get("break_even_gross_synergy")
    elif output_metric == "transaction_ev":
        return deal.get("transaction", {}).get("transaction_enterprise_value")
    elif output_metric == "purchase_equity_value":
        return deal.get("transaction", {}).get("purchase_equity_value")
    elif output_metric == "is_feasible":
        return ad.get("is_feasible")
    else:
        return None


# ---------------------------------------------------------------------------
# 1D Sensitivity Analysis
# ---------------------------------------------------------------------------

def run_sensitivity_1d(
    acquirer_id: str,
    target_id: str,
    metrics_df: pd.DataFrame,
    financials_df: pd.DataFrame,
    base_assumptions: Dict[str, Any],
    variable: str,
    values: List[float],
    output_metric: str,
) -> Dict[str, Any]:
    """
    Execute a 1D sensitivity analysis.

    Evaluates one variable across multiple values, executing the complete
    deterministic pipeline for each. Each cell uses the same pipeline.

    Parameters
    ----------
    variable : str
        The assumption to vary (must be in SUPPORTED_SENSITIVITY_VARIABLES).
    values : list[float]
        The values to evaluate for the variable.
    output_metric : str
        The metric to extract (must be in SUPPORTED_OUTPUT_METRICS).

    Returns
    -------
    dict
        Structured 1D sensitivity result.
    """
    # Validate inputs
    if variable not in SUPPORTED_SENSITIVITY_VARIABLES:
        raise ValueError(
            f"Invalid sensitivity variable '{variable}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_SENSITIVITY_VARIABLES))}"
        )

    if output_metric not in SUPPORTED_OUTPUT_METRICS:
        raise ValueError(
            f"Invalid output metric '{output_metric}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_OUTPUT_METRICS))}"
        )

    if not values:
        raise ValueError("At least one value must be provided for the sensitivity variable.")

    if len(values) > MAX_SENSITIVITY_AXIS:
        raise ValueError(
            f"1D sensitivity is limited to {MAX_SENSITIVITY_AXIS} values. "
            f"Got {len(values)}."
        )

    cells = []
    for val in values:
        overrides = {variable: val}
        resolved = resolve_assumptions(base_assumptions, overrides)

        validation_errors = validate_assumptions(resolved)
        if validation_errors:
            cells.append({
                "value": val,
                "output": None,
                "is_feasible": False,
                "diagnostics": validation_errors,
            })
            continue

        try:
            pipeline_result = execute_scenario(
                acquirer_id=acquirer_id,
                target_id=target_id,
                metrics_df=metrics_df,
                financials_df=financials_df,
                assumptions=resolved,
            )
            is_feasible = pipeline_result["accretion_dilution"].get("is_feasible", True)
            if not is_feasible and output_metric != "is_feasible":
                metric_value = None
            else:
                metric_value = _extract_output_metric(pipeline_result, output_metric)

            cell_diags = []
            if not is_feasible:
                cell_diags = pipeline_result["accretion_dilution"].get("diagnostics", [])

            cells.append({
                "value": val,
                "output": metric_value,
                "is_feasible": is_feasible,
                "diagnostics": cell_diags,
            })
        except Exception as exc:
            cells.append({
                "value": val,
                "output": None,
                "is_feasible": False,
                "diagnostics": [str(exc)],
            })

    return {
        "acquirer_id": acquirer_id,
        "target_id": target_id,
        "variable": variable,
        "values": values,
        "output_metric": output_metric,
        "cells": cells,
    }


# ---------------------------------------------------------------------------
# 2D Sensitivity Analysis
# ---------------------------------------------------------------------------

def run_sensitivity_2d(
    acquirer_id: str,
    target_id: str,
    metrics_df: pd.DataFrame,
    financials_df: pd.DataFrame,
    base_assumptions: Dict[str, Any],
    x_variable: str,
    x_values: List[float],
    y_variable: str,
    y_values: List[float],
    output_metric: str,
) -> Dict[str, Any]:
    """
    Execute a 2D sensitivity analysis matrix.

    Each cell:
    1. Clones the base assumptions
    2. Applies X-axis override
    3. Applies Y-axis override
    4. Validates the assumptions
    5. Executes the deterministic transaction pipeline
    6. Records the requested output metric
    7. Records feasibility/diagnostics

    Parameters
    ----------
    x_variable : str
        The column-axis assumption variable.
    x_values : list[float]
        Values for the X-axis.
    y_variable : str
        The row-axis assumption variable.
    y_values : list[float]
        Values for the Y-axis.
    output_metric : str
        The output metric to extract for each cell.

    Returns
    -------
    dict
        Structured 2D sensitivity result with a matrix of cells.
    """
    # Validate variables
    for var_name, var_val in [("x_variable", x_variable), ("y_variable", y_variable)]:
        if var_val not in SUPPORTED_SENSITIVITY_VARIABLES:
            raise ValueError(
                f"Invalid sensitivity variable '{var_val}' for {var_name}. "
                f"Supported: {', '.join(sorted(SUPPORTED_SENSITIVITY_VARIABLES))}"
            )

    if x_variable == y_variable:
        raise ValueError(
            f"x_variable and y_variable must be different. Got '{x_variable}' for both."
        )

    if output_metric not in SUPPORTED_OUTPUT_METRICS:
        raise ValueError(
            f"Invalid output metric '{output_metric}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_OUTPUT_METRICS))}"
        )

    if not x_values or not y_values:
        raise ValueError("Both x_values and y_values must be non-empty.")

    if len(x_values) > MAX_SENSITIVITY_AXIS:
        raise ValueError(
            f"X-axis is limited to {MAX_SENSITIVITY_AXIS} values. "
            f"Got {len(x_values)}."
        )
    if len(y_values) > MAX_SENSITIVITY_AXIS:
        raise ValueError(
            f"Y-axis is limited to {MAX_SENSITIVITY_AXIS} values. "
            f"Got {len(y_values)}."
        )

    total_cells = len(x_values) * len(y_values)
    max_cells = MAX_SENSITIVITY_AXIS * MAX_SENSITIVITY_AXIS
    if total_cells > max_cells:
        raise ValueError(
            f"Total matrix size ({len(x_values)} × {len(y_values)} = {total_cells}) "
            f"exceeds maximum ({MAX_SENSITIVITY_AXIS} × {MAX_SENSITIVITY_AXIS} = {max_cells})."
        )

    matrix: List[List[Dict[str, Any]]] = []

    for y_val in y_values:
        row: List[Dict[str, Any]] = []
        for x_val in x_values:
            # Clone base, apply both axis overrides
            overrides = {
                x_variable: x_val,
                y_variable: y_val,
            }
            resolved = resolve_assumptions(base_assumptions, overrides)

            validation_errors = validate_assumptions(resolved)
            if validation_errors:
                row.append({
                    "x_value": x_val,
                    "y_value": y_val,
                    "output": None,
                    "is_feasible": False,
                    "diagnostics": validation_errors,
                })
                continue

            try:
                pipeline_result = execute_scenario(
                    acquirer_id=acquirer_id,
                    target_id=target_id,
                    metrics_df=metrics_df,
                    financials_df=financials_df,
                    assumptions=resolved,
                )
                is_feasible = pipeline_result["accretion_dilution"].get("is_feasible", True)
                if not is_feasible and output_metric != "is_feasible":
                    metric_value = None
                else:
                    metric_value = _extract_output_metric(pipeline_result, output_metric)

                cell_diags = []
                if not is_feasible:
                    cell_diags = pipeline_result["accretion_dilution"].get("diagnostics", [])

                row.append({
                    "x_value": x_val,
                    "y_value": y_val,
                    "output": metric_value,
                    "is_feasible": is_feasible,
                    "diagnostics": cell_diags,
                })
            except Exception as exc:
                row.append({
                    "x_value": x_val,
                    "y_value": y_val,
                    "output": None,
                    "is_feasible": False,
                    "diagnostics": [str(exc)],
                })

        matrix.append(row)

    return {
        "acquirer_id": acquirer_id,
        "target_id": target_id,
        "x_variable": x_variable,
        "x_values": x_values,
        "y_variable": y_variable,
        "y_values": y_values,
        "output_metric": output_metric,
        "matrix": matrix,
        "dimensions": {
            "rows": len(y_values),
            "columns": len(x_values),
            "total_cells": total_cells,
        },
    }
