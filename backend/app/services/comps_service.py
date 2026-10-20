"""
backend/app/services/comps_service.py

Service layer for Comparable Companies Analysis calling analytics/comps.py.
Preserves existing peer selection and implied valuation formulas.
"""

import logging
from typing import List, Optional
import pandas as pd

from analytics.comps import comps_summary
from analytics.valuation import _build_comps_section
from backend.app.core.errors import EntityNotFoundError, InvalidInputError
from backend.app.schemas.comps import (
    CompsPeerStatistics,
    CompsResponse,
    ImpliedValuationEntry,
    MultipleStats,
    ValuationRangePoint,
)
from backend.app.services.company_service import CompanyService
from backend.app.services.dataset_service import DatasetService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.comps")


class CompsService:
    """Service orchestrating Comparable Companies trading multiples and implied valuation."""

    def __init__(self, dataset_service: DatasetService, company_service: CompanyService) -> None:
        self.dataset_service = dataset_service
        self.company_service = company_service

    def get_comps(
        self,
        company_identifier: str,
        sector: Optional[str] = None,
        industry: Optional[str] = None,
        peer_ids: Optional[List[str]] = None,
        percentile: str = "median",
    ) -> CompsResponse:
        """
        Execute Comparable Companies analysis for target company.
        """
        if percentile not in ("p25", "median", "p75"):
            raise InvalidInputError(f"Invalid percentile '{percentile}'. Must be one of 'p25', 'median', 'p75'.")

        canonical_id = self.company_service.resolve_company_id(company_identifier)
        metrics = self.dataset_service.get_metrics()
        target_rows = metrics[metrics["company_id"] == canonical_id]
        if target_rows.empty:
            raise EntityNotFoundError(f"Company '{company_identifier}' not found")
        target_row = target_rows.iloc[0]

        # Call existing analytics module for summary at requested percentile
        try:
            summary = comps_summary(
                metrics_df=metrics,
                target_id=canonical_id,
                sector=sector,
                industry=industry,
                peer_ids=peer_ids,
                percentile=percentile,
            )
        except ValueError as exc:
            raise EntityNotFoundError(str(exc))

        # Also call valuation._build_comps_section to get complete low/mid/high ranges and warnings
        section_data, warnings = _build_comps_section(
            metrics_df=metrics,
            target_id=canonical_id,
            target_row=target_row,
            peer_ids=peer_ids,
            sector=sector,
        )

        cleaned_stats = clean_nan(summary["peer_statistics"])
        cleaned_valuation = clean_nan(summary["implied_valuation"])
        cleaned_ranges = clean_nan(section_data.get("valuation", {}))

        # Build typed statistics
        multiples_dict = {}
        for m_key in ("ev_revenue", "ev_ebitda", "pe_ratio"):
            m_data = cleaned_stats.get(m_key, {})
            multiples_dict[m_key] = MultipleStats(
                p25=m_data.get("p25"),
                median=m_data.get("median"),
                p75=m_data.get("p75"),
                n=m_data.get("n", 0),
            )

        peer_stats = CompsPeerStatistics(
            peer_count=cleaned_stats["peer_count"],
            small_sample_warning=cleaned_stats["small_sample_warning"],
            multiples=multiples_dict,
        )

        # Build typed implied valuation
        implied_val = {}
        for k, v in cleaned_valuation.items():
            implied_val[k] = ImpliedValuationEntry(
                multiple_used=v.get("multiple_used"),
                implied_ev=v.get("implied_ev"),
                implied_equity_value=v.get("implied_equity_value"),
            )

        # Build typed valuation ranges
        ranges_dict = {}
        for m_key, r_points in cleaned_ranges.items():
            if r_points:
                ranges_dict[m_key] = {
                    pt_label: ValuationRangePoint(
                        multiple=pt_data.get("multiple"),
                        implied_equity_value=pt_data.get("implied_equity_value"),
                    )
                    for pt_label, pt_data in r_points.items()
                }

        return CompsResponse(
            target_id=canonical_id,
            target_sector=summary.get("target_sector"),
            target_industry=summary.get("target_industry"),
            peer_count=summary["peer_count"],
            small_sample_warning=summary["small_sample_warning"],
            peer_group=summary["peer_group"],
            peer_statistics=peer_stats,
            implied_valuation=implied_val,
            valuation_ranges=ranges_dict,
            warnings=warnings,
        )
