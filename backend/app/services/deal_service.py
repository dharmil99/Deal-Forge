"""
backend/app/services/deal_service.py

Service layer orchestrating Phase 6: Deal Builder.
Delegates to analytics/deal_model.py without duplicating financial calculations.
"""

import logging
from typing import Any, Dict
import pandas as pd

from analytics.deal_model import build_deal_from_universe
from backend.app.core.errors import EntityNotFoundError, InvalidInputError
from backend.app.schemas.deal import (
    DealCompanyProfile,
    DealCreateRequest,
    DealFinancingStructure,
    DealResponse,
    DealSynergiesSchedule,
    DealTransactionTerms,
)
from backend.app.services.company_service import CompanyService
from backend.app.services.dataset_service import DatasetService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.deal")


class DealService:
    """Service providing M&A deal structure creation and pricing."""

    def __init__(self, dataset_service: DatasetService, company_service: CompanyService) -> None:
        self.dataset_service = dataset_service
        self.company_service = company_service

    def build_deal(self, request: DealCreateRequest) -> DealResponse:
        """
        Build an acquisition deal model from universe companies and transaction assumptions.
        """
        buyer_id = self.company_service.resolve_company_id(request.buyer_id)
        target_id = self.company_service.resolve_company_id(request.target_id)

        metrics = self.dataset_service.get_metrics()
        financials = self.dataset_service.get_financials()

        try:
            raw_deal = build_deal_from_universe(
                acquirer_id=buyer_id,
                target_id=target_id,
                metrics_df=metrics,
                financials_df=financials,
                purchase_equity_value=request.purchase_equity_value,
                acquisition_premium=request.acquisition_premium,
                cash_pct=request.cash_pct,
                debt_pct=request.debt_pct,
                stock_pct=request.stock_pct,
                transaction_fees=request.transaction_fees,
                expected_annual_synergies=request.expected_annual_synergies,
                synergy_ramp_year_1=request.synergy_ramp_year_1,
                synergy_ramp_year_2=request.synergy_ramp_year_2,
                synergy_ramp_year_3=request.synergy_ramp_year_3,
            )
        except ValueError as exc:
            raise InvalidInputError(str(exc))
        except Exception as exc:
            logger.error("Deal builder failed for %s -> %s: %s", buyer_id, target_id, exc)
            raise

        cleaned = clean_nan(raw_deal)

        return DealResponse(
            acquirer=DealCompanyProfile(**cleaned["acquirer"]),
            target=DealCompanyProfile(**cleaned["target"]),
            transaction=DealTransactionTerms(**cleaned["transaction"]),
            financing=DealFinancingStructure(**cleaned["financing"]),
            synergies=DealSynergiesSchedule(**cleaned["synergies"]),
            warnings=cleaned.get("warnings", []),
        )
