"""
backend/app/services/valuation_service.py

Service layer orchestrating the multi-methodology Valuation Summary and Football Field chart.
Directly calls analytics/valuation.py without duplicating or blending calculations.
"""

import logging
from typing import Any, Dict, List, Optional
import pandas as pd

from analytics.valuation import valuation_summary
from backend.app.core.errors import EntityNotFoundError, InvalidInputError
from backend.app.schemas.comps import MultipleStats, ValuationRangePoint
from backend.app.schemas.precedents import PrecedentMultipleStats
from backend.app.schemas.valuation import (
    DataQualitySummary,
    FootballFieldRow,
    ValuationCompsSection,
    ValuationDCFSection,
    ValuationPrecedentsSection,
    ValuationSummaryResponse,
    ValuationTargetSummary,
)
from backend.app.services.company_service import CompanyService
from backend.app.services.dataset_service import DatasetService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.valuation")


class ValuationService:
    """Service providing unified multi-methodology valuation summaries."""

    def __init__(self, dataset_service: DatasetService, company_service: CompanyService) -> None:
        self.dataset_service = dataset_service
        self.company_service = company_service

    def get_valuation_summary(
        self,
        company_identifier: str,
        sector: Optional[str] = None,
        peer_ids: Optional[List[str]] = None,
        comps_percentile: str = "median",
        precedents_percentile: str = "median",
        dcf_params: Optional[Dict[str, Any]] = None,
    ) -> ValuationSummaryResponse:
        """
        Execute unified valuation summary across Comps, Precedents, and DCF.
        """
        if comps_percentile not in ("p25", "median", "p75"):
            raise InvalidInputError(f"Invalid comps_percentile '{comps_percentile}'. Must be one of 'p25', 'median', 'p75'.")
        if precedents_percentile not in ("p25", "median", "p75"):
            raise InvalidInputError(f"Invalid precedents_percentile '{precedents_percentile}'. Must be one of 'p25', 'median', 'p75'.")

        canonical_id = self.company_service.resolve_company_id(company_identifier)
        metrics = self.dataset_service.get_metrics()
        transactions = self.dataset_service.get_loaded_transactions()
        financials = self.dataset_service.get_financials()

        try:
            summary = valuation_summary(
                target_id=canonical_id,
                metrics_df=metrics,
                transactions_df=transactions,
                financials_df=financials,
                peer_ids=peer_ids,
                comps_percentile=comps_percentile,
                sector=sector,
                precedents_percentile=precedents_percentile,
                dcf_params=dcf_params,
            )
        except ValueError as exc:
            raise EntityNotFoundError(str(exc))
        except Exception as exc:
            logger.error("Valuation summary failed for %s: %s", canonical_id, exc)
            raise

        cleaned = clean_nan(summary)

        # 1. Target section
        target_dict = cleaned["target"]
        target_obj = ValuationTargetSummary(
            company_id=str(target_dict["company_id"]),
            sector=target_dict.get("sector"),
            industry=target_dict.get("industry"),
            sector_type=target_dict.get("sector_type"),
            market_cap_latest=target_dict.get("market_cap_latest"),
            current_price=target_dict.get("current_price"),
            ev=target_dict.get("ev"),
            net_debt_latest=target_dict.get("net_debt_latest"),
            revenue_latest=target_dict.get("revenue_latest"),
            ebitda_latest=target_dict.get("ebitda_latest"),
            ebitda_margin=target_dict.get("ebitda_margin"),
            revenue_cagr=target_dict.get("revenue_cagr"),
        )

        # 2. Comps section
        comps_raw = cleaned["comps"]
        comps_multiples = {}
        for m_key, m_stats in comps_raw.get("multiples", {}).items():
            comps_multiples[m_key] = MultipleStats(
                p25=m_stats.get("p25"),
                median=m_stats.get("median"),
                p75=m_stats.get("p75"),
                n=m_stats.get("n", 0),
            )

        comps_val_ranges = {}
        for m_key, r_points in comps_raw.get("valuation", {}).items():
            if r_points:
                comps_val_ranges[m_key] = {
                    pt_label: ValuationRangePoint(
                        multiple=pt_data.get("multiple"),
                        implied_equity_value=pt_data.get("implied_equity_value"),
                    )
                    for pt_label, pt_data in r_points.items()
                }

        comps_obj = ValuationCompsSection(
            peer_count=comps_raw["peer_count"],
            peer_group=comps_raw["peer_group"],
            small_sample_warning=comps_raw["small_sample_warning"],
            multiples=comps_multiples,
            valuation=comps_val_ranges,
        )

        # 3. Precedents section
        precedents_raw = cleaned["precedents"]
        precedents_multiples = {}
        for m_key, m_stats in precedents_raw.get("multiples", {}).items():
            precedents_multiples[m_key] = PrecedentMultipleStats(
                p25=m_stats.get("p25"),
                median=m_stats.get("median"),
                p75=m_stats.get("p75"),
                n=m_stats.get("n", 0),
            )

        precedents_val_ranges: Dict[str, Optional[Dict[str, ValuationRangePoint]]] = {}
        for m_key, r_points in precedents_raw.get("valuation", {}).items():
            if r_points:
                precedents_val_ranges[m_key] = {
                    pt_label: ValuationRangePoint(
                        multiple=pt_data.get("multiple"),
                        implied_equity_value=pt_data.get("implied_equity_value"),
                    )
                    for pt_label, pt_data in r_points.items()
                }
            else:
                precedents_val_ranges[m_key] = None

        precedents_obj = ValuationPrecedentsSection(
            transaction_count=precedents_raw["transaction_count"],
            small_sample_warning=precedents_raw["small_sample_warning"],
            multiples=precedents_multiples,
            valuation=precedents_val_ranges,
        )

        # 4. DCF section
        dcf_obj = None
        if cleaned.get("dcf"):
            dcf_raw = cleaned["dcf"]
            dcf_obj = ValuationDCFSection(
                implied_ev=dcf_raw["implied_ev"],
                implied_equity_value=dcf_raw["implied_equity_value"],
                implied_value_per_share=dcf_raw.get("implied_value_per_share"),
                wacc=dcf_raw["wacc"],
                terminal_growth=dcf_raw["terminal_growth"],
                assumptions=dcf_raw.get("assumptions", {}),
                wacc_detail=dcf_raw.get("wacc_detail", {}),
                pv_explicit_fcff=dcf_raw["pv_explicit_fcff"],
                pv_terminal_value=dcf_raw["pv_terminal_value"],
                warnings=dcf_raw.get("warnings", []),
            )

        # 5. Valuation table (Football field)
        table_rows = []
        for r in cleaned.get("valuation_table", []):
            table_rows.append(
                FootballFieldRow(
                    methodology=str(r["methodology"]),
                    low_multiple=r.get("low_multiple"),
                    mid_multiple=r.get("mid_multiple"),
                    high_multiple=r.get("high_multiple"),
                    low=r.get("low"),
                    mid=r.get("mid"),
                    high=r.get("high"),
                    available=bool(r.get("available")),
                )
            )

        # 6. Data quality audit
        dq_raw = cleaned.get("data_quality", {})
        data_quality_obj = DataQualitySummary(
            peer_count=dq_raw.get("peer_count", 0),
            comps_small_sample=bool(dq_raw.get("comps_small_sample")),
            comps_ev_ebitda_available=bool(dq_raw.get("comps_ev_ebitda_available")),
            comps_pe_available=bool(dq_raw.get("comps_pe_available")),
            precedent_count=dq_raw.get("precedent_count", 0),
            precedents_small_sample=bool(dq_raw.get("precedents_small_sample")),
            precedent_ev_revenue_count=dq_raw.get("precedent_ev_revenue_count", 0),
            precedent_ev_ebitda_count=dq_raw.get("precedent_ev_ebitda_count", 0),
            precedent_ev_revenue_available=bool(dq_raw.get("precedent_ev_revenue_available")),
            precedent_ev_ebitda_available=bool(dq_raw.get("precedent_ev_ebitda_available")),
            shares_outstanding_is_stale=bool(dq_raw.get("shares_outstanding_is_stale")),
            dcf_available=bool(dq_raw.get("dcf_available")),
            dcf_has_warnings=bool(dq_raw.get("dcf_has_warnings")),
            target_ebitda_available=bool(dq_raw.get("target_ebitda_available")),
            target_net_debt_available=bool(dq_raw.get("target_net_debt_available")),
        )

        return ValuationSummaryResponse(
            target=target_obj,
            comps=comps_obj,
            precedents=precedents_obj,
            dcf=dcf_obj,
            valuation_table=table_rows,
            warnings=cleaned.get("warnings", []),
            data_quality=data_quality_obj,
        )
