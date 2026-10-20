"""
backend/app/services/precedents_service.py

Service layer for Precedent Transactions Analysis calling analytics/precedents.py.
Preserves existing transaction scaling and implied valuation logic.
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from analytics.precedents import (
    filter_transactions,
    implied_valuation_from_precedents,
    transaction_statistics,
)
from analytics.valuation import _build_precedents_section
from backend.app.core.errors import EntityNotFoundError, InvalidInputError
from backend.app.schemas.comps import ImpliedValuationEntry, ValuationRangePoint
from backend.app.schemas.precedents import (
    PrecedentMultipleStats,
    PrecedentsResponse,
    TransactionRecord,
)
from backend.app.services.company_service import CompanyService
from backend.app.services.dataset_service import DatasetService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.precedents")


class PrecedentsService:
    """Service orchestrating M&A Precedent Transactions analysis and implied valuation."""

    def __init__(self, dataset_service: DatasetService, company_service: CompanyService) -> None:
        self.dataset_service = dataset_service
        self.company_service = company_service

    def get_precedents(
        self,
        company_identifier: str,
        sector: Optional[str] = None,
        industry: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        min_deal_value_cr: Optional[float] = None,
        max_deal_value_cr: Optional[float] = None,
        percentile: str = "median",
    ) -> PrecedentsResponse:
        """
        Execute Precedent Transactions analysis for target company.
        """
        if percentile not in ("p25", "median", "p75"):
            raise InvalidInputError(f"Invalid percentile '{percentile}'. Must be one of 'p25', 'median', 'p75'.")

        canonical_id = self.company_service.resolve_company_id(company_identifier)
        metrics = self.dataset_service.get_metrics()
        target_rows = metrics[metrics["company_id"] == canonical_id]
        if target_rows.empty:
            raise EntityNotFoundError(f"Company '{company_identifier}' not found")
        target_row = target_rows.iloc[0]

        transactions_df = self.dataset_service.get_loaded_transactions()

        # Apply filtering
        filtered_txns = filter_transactions(
            transactions_df=transactions_df,
            sector=sector,
            industry=industry,
            start_date=start_date,
            end_date=end_date,
            min_deal_value_cr=min_deal_value_cr,
            max_deal_value_cr=max_deal_value_cr,
        )

        # Statistics across filtered transactions
        stats = transaction_statistics(filtered_txns)

        target_revenue = target_row.get("revenue_latest")
        target_ebitda = target_row.get("ebitda_latest")
        target_net_debt = target_row.get("net_debt_latest", 0.0) or 0.0

        # Implied valuation at requested percentile
        implied_raw = implied_valuation_from_precedents(
            target_revenue_cr=target_revenue,
            target_ebitda_cr=target_ebitda,
            target_net_debt_cr=target_net_debt,
            stats=stats,
            percentile=percentile,
        )

        # Build full ranges and warnings via valuation section builder
        section_data, warnings = _build_precedents_section(
            transactions_df=filtered_txns,
            target_row=target_row,
            sector=sector,
        )

        cleaned_stats = clean_nan(stats)
        cleaned_implied = clean_nan(implied_raw)
        cleaned_ranges = clean_nan(section_data.get("valuation", {}))

        # Build individual transaction records
        tx_list: List[TransactionRecord] = []
        for _, r in filtered_txns.iterrows():
            d = clean_nan(r.to_dict())
            ann_date = None
            if pd.notna(r.get("announcement_date")):
                try:
                    ann_date = pd.to_datetime(r["announcement_date"]).strftime("%Y-%m-%d")
                except Exception:
                    ann_date = str(r["announcement_date"])

            tx_list.append(
                TransactionRecord(
                    transaction_id=str(d.get("transaction_id", "")),
                    announcement_date=ann_date,
                    acquirer=str(d.get("acquirer", "")),
                    target=str(d.get("target", "")),
                    sector=d.get("sector"),
                    industry=d.get("industry"),
                    geography=d.get("geography"),
                    transaction_type=d.get("transaction_type"),
                    stake_acquired_pct=d.get("stake_acquired_pct"),
                    deal_value_cr=d.get("deal_value_cr"),
                    target_revenue_cr=d.get("target_revenue_cr"),
                    target_ebitda_cr=d.get("target_ebitda_cr"),
                    implied_ev_cr=d.get("implied_ev_cr"),
                    ev_revenue=d.get("ev_revenue"),
                    ev_ebitda=d.get("ev_ebitda"),
                    status=d.get("status"),
                    source_note=d.get("source_note"),
                )
            )

        # Typed multiple stats
        stats_dict = {}
        for m_key in ("ev_revenue", "ev_ebitda"):
            m_data = cleaned_stats.get(m_key, {})
            stats_dict[m_key] = PrecedentMultipleStats(
                p25=m_data.get("p25"),
                median=m_data.get("median"),
                p75=m_data.get("p75"),
                n=m_data.get("n", 0),
            )

        # Typed implied valuation
        implied_typed: Dict[str, Optional[ImpliedValuationEntry]] = {}
        for m_key in ("ev_revenue", "ev_ebitda"):
            if m_key in cleaned_implied:
                val = cleaned_implied[m_key]
                implied_typed[m_key] = ImpliedValuationEntry(
                    multiple_used=val.get("multiple_used"),
                    implied_ev=val.get("implied_ev"),
                    implied_equity_value=val.get("implied_equity_value"),
                )
            else:
                implied_typed[m_key] = None

        # Typed valuation ranges
        ranges_typed: Dict[str, Optional[Dict[str, ValuationRangePoint]]] = {}
        for m_key in ("ev_revenue", "ev_ebitda"):
            r_points = cleaned_ranges.get(m_key)
            if r_points:
                ranges_typed[m_key] = {
                    pt_label: ValuationRangePoint(
                        multiple=pt_data.get("multiple"),
                        implied_equity_value=pt_data.get("implied_equity_value"),
                    )
                    for pt_label, pt_data in r_points.items()
                }
            else:
                ranges_typed[m_key] = None

        diagnostics = {
            "total_transactions_available": len(transactions_df),
            "matching_transactions_count": len(filtered_txns),
            "ev_revenue_available": stats_dict["ev_revenue"].n > 0,
            "ev_ebitda_available": stats_dict["ev_ebitda"].n > 0,
            "target_has_ebitda": pd.notna(target_ebitda),
        }

        return PrecedentsResponse(
            target_id=canonical_id,
            target_sector=target_row.get("sector"),
            target_industry=target_row.get("industry"),
            target_revenue_cr=target_revenue,
            target_ebitda_cr=target_ebitda,
            target_net_debt_cr=target_net_debt,
            transaction_count=stats["transaction_count"],
            small_sample_warning=stats["small_sample_warning"],
            transactions=tx_list,
            statistics=stats_dict,
            implied_valuation=implied_typed,
            valuation_ranges=ranges_typed,
            warnings=warnings,
            diagnostics=diagnostics,
        )
