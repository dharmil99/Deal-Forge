"""
backend/app/services/screening_service.py

Service layer orchestrating target screening using analytics/screening.py.
Preserves existing screening heuristics without duplicating or modifying formulas.
"""

import logging
from typing import Any, Dict, List
import pandas as pd

from analytics.screening import add_screening_score, screen
from backend.app.schemas.screening import (
    ScreenedCompany,
    ScreeningRequest,
    ScreeningResponse,
)
from backend.app.services.dataset_service import DatasetService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.screening")


class ScreeningService:
    """Service executing acquisition target screening against the DealForge company universe."""

    def __init__(self, dataset_service: DatasetService) -> None:
        self.dataset_service = dataset_service

    def run_screening(self, request: ScreeningRequest) -> ScreeningResponse:
        """
        Execute screening query using analytics.screening functions.
        """
        metrics = self.dataset_service.get_metrics()
        total_universe_count = len(metrics)

        # Baseline universe for score ranking (Industrial vs full)
        if request.industrial_only:
            base_universe = metrics[metrics["sector_type"] == "Industrial"].copy()
        else:
            base_universe = metrics.copy()

        scored = add_screening_score(base_universe)

        # Apply screening filters via existing analytics function
        filtered = screen(
            metrics_df=scored,
            sector=request.sector,
            min_revenue_cagr=request.min_revenue_cagr,
            min_ebitda_margin=request.min_ebitda_margin,
            max_ev_ebitda=request.max_ev_ebitda,
            max_net_debt_ebitda=request.max_net_debt_ebitda,
            industrial_only=request.industrial_only,
        )

        # Warnings and diagnostics
        warnings: List[str] = []
        if not request.industrial_only:
            warnings.append(
                "screening: industrial_only is False. Financial-sector companies (banks/NBFCs) are "
                "included; EV/EBITDA and Net Debt/EBITDA are not meaningful for them."
            )

        passed_count = len(filtered)
        if passed_count == 0:
            warnings.append("screening: 0 companies met the specified criteria.")

        # Sorting
        sort_by = request.sort_by or "illustrative_screening_score"
        if sort_by in filtered.columns:
            filtered = filtered.sort_values(by=sort_by, ascending=request.ascending, na_position="last")

        if request.limit is not None and request.limit > 0:
            filtered = filtered.head(request.limit)

        items: List[ScreenedCompany] = []
        for _, row in filtered.iterrows():
            d = clean_nan(row.to_dict())
            items.append(
                ScreenedCompany(
                    company_id=str(d["company_id"]),
                    company_name=str(d.get("company_name", d["company_id"])),
                    ticker=d.get("ticker"),
                    sector=d.get("sector"),
                    industry=d.get("industry"),
                    sector_type=d.get("sector_type"),
                    revenue_latest=d.get("revenue_latest"),
                    revenue_cagr=d.get("revenue_cagr"),
                    ebitda_latest=d.get("ebitda_latest"),
                    ebitda_margin=d.get("ebitda_margin"),
                    net_debt_latest=d.get("net_debt_latest"),
                    ev=d.get("ev"),
                    ev_ebitda=d.get("ev_ebitda"),
                    net_debt_ebitda=d.get("net_debt_ebitda"),
                    ev_revenue=d.get("ev_revenue"),
                    pe_ratio=d.get("pe_ratio"),
                    growth_score=d.get("growth_score"),
                    margin_score=d.get("margin_score"),
                    valuation_score=d.get("valuation_score"),
                    leverage_score=d.get("leverage_score"),
                    illustrative_screening_score=d.get("illustrative_screening_score"),
                )
            )

        filters_applied = {
            "sector": request.sector,
            "min_revenue_cagr": request.min_revenue_cagr,
            "min_ebitda_margin": request.min_ebitda_margin,
            "max_ev_ebitda": request.max_ev_ebitda,
            "max_net_debt_ebitda": request.max_net_debt_ebitda,
            "industrial_only": request.industrial_only,
            "sort_by": sort_by,
            "ascending": request.ascending,
            "limit": request.limit,
        }

        diagnostics = {
            "total_universe": total_universe_count,
            "base_universe_scored": len(base_universe),
            "passed_screen": passed_count,
            "returned_count": len(items),
        }

        return ScreeningResponse(
            total_universe_count=total_universe_count,
            passed_count=passed_count,
            filters_applied=filters_applied,
            warnings=warnings,
            diagnostics=diagnostics,
            items=items,
        )
