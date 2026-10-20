"""
backend/app/services/sources_uses_service.py

Service layer orchestrating Phase 7: Sources & Uses.
Delegates to analytics/sources_uses.py without duplicating financial calculations.
"""

import logging
from typing import Any, Dict
import pandas as pd

from analytics.sources_uses import build_sources_and_uses_from_universe
from backend.app.core.errors import EntityNotFoundError, InvalidInputError
from backend.app.schemas.sources_uses import (
    CashReconciliationDetail,
    ExecutableFinancingSources,
    FundingBaseDetail,
    RequestedFinancingSources,
    SourcesUsesDetail,
    SourcesUsesReconciliation,
    SourcesUsesRequest,
    SourcesUsesResponse,
)
from backend.app.services.company_service import CompanyService
from backend.app.services.dataset_service import DatasetService
from backend.app.services.deal_service import DealService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.sources_uses")


class SourcesUsesService:
    """Service providing institutional Sources & Uses schedule construction."""

    def __init__(
        self,
        dataset_service: DatasetService,
        company_service: CompanyService,
        deal_service: DealService,
    ) -> None:
        self.dataset_service = dataset_service
        self.company_service = company_service
        self.deal_service = deal_service

    def build_sources_and_uses(self, request: SourcesUsesRequest) -> SourcesUsesResponse:
        """
        Build an institutional Sources & Uses schedule for a transaction.
        """
        buyer_id = self.company_service.resolve_company_id(request.buyer_id)
        target_id = self.company_service.resolve_company_id(request.target_id)

        metrics = self.dataset_service.get_metrics()
        financials = self.dataset_service.get_financials()

        try:
            raw_su = build_sources_and_uses_from_universe(
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
                refinance_target_debt=request.refinance_target_debt,
                use_target_cash=request.use_target_cash,
                debt_issuance_fee_pct=request.debt_issuance_fee_pct,
                minimum_cash_balance=request.minimum_cash_balance,
                other_uses=request.other_uses,
                other_sources=request.other_sources,
                acquirer_cash=request.acquirer_cash,
                new_debt=request.new_debt,
                stock_issuance=request.stock_issuance,
                target_cash_sweep=request.target_cash_sweep,
            )
        except ValueError as exc:
            raise InvalidInputError(str(exc))
        except Exception as exc:
            logger.error("Sources & Uses build failed for %s -> %s: %s", buyer_id, target_id, exc)
            raise

        cleaned = clean_nan(raw_su)

        return SourcesUsesResponse(
            uses=SourcesUsesDetail(**cleaned["uses"]),
            funding_base=FundingBaseDetail(**cleaned["funding_base"]),
            requested_financing=RequestedFinancingSources(**cleaned["requested_financing"]),
            sources=ExecutableFinancingSources(**cleaned["sources"]),
            reconciliation=SourcesUsesReconciliation(**cleaned["reconciliation"]),
            cash_reconciliation=CashReconciliationDetail(**cleaned["cash_reconciliation"]),
            warnings=cleaned.get("warnings", []),
        )
