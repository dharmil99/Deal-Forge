"""
backend/app/services/accretion_dilution_service.py

Service layer orchestrating Phase 8: Accretion / Dilution analysis.
Chains Deal Builder -> Sources & Uses -> Accretion / Dilution using existing analytics modules.
"""

import logging
from typing import Any, Dict
import pandas as pd

from analytics.accretion_dilution import calculate_accretion_dilution
from analytics.deal_model import build_deal_from_universe
from analytics.sources_uses import build_sources_and_uses
from backend.app.core.errors import EntityNotFoundError, InvalidInputError
from backend.app.schemas.accretion_dilution import (
    AccretionDilutionRequest,
    AccretionDilutionResponse,
    ADFinancingDetail,
    ADProFormaProjections,
    ADStandaloneEPS,
    ADSynergiesDetail,
    ADYearProjection,
    BreakEvenSynergyDetail,
    BuyerADProfile,
    TargetADProfile,
)
from backend.app.services.company_service import CompanyService
from backend.app.services.dataset_service import DatasetService
from backend.app.services.deal_service import DealService
from backend.app.services.sources_uses_service import SourcesUsesService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.accretion_dilution")


class AccretionDilutionService:
    """Service providing M&A earnings impact, pro-forma EPS, and break-even synergy analysis."""

    def __init__(
        self,
        dataset_service: DatasetService,
        company_service: CompanyService,
        deal_service: DealService,
        sources_uses_service: SourcesUsesService,
    ) -> None:
        self.dataset_service = dataset_service
        self.company_service = company_service
        self.deal_service = deal_service
        self.sources_uses_service = sources_uses_service

    def calculate_accretion_dilution(
        self, request: AccretionDilutionRequest
    ) -> AccretionDilutionResponse:
        """
        Execute full deal modeling, Sources & Uses balancing, and Accretion / Dilution projections.
        """
        buyer_id = self.company_service.resolve_company_id(request.buyer_id)
        target_id = self.company_service.resolve_company_id(request.target_id)

        metrics = self.dataset_service.get_metrics()
        financials = self.dataset_service.get_financials()

        try:
            # Step 1: Construct Phase 6 Deal Model
            deal = build_deal_from_universe(
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

            # Step 2: Construct Phase 7 Sources & Uses Schedule
            su = build_sources_and_uses(
                deal=deal,
                refinance_target_debt=request.refinance_target_debt,
                use_target_cash=request.use_target_cash,
                debt_issuance_fee_pct=request.debt_issuance_fee_pct,
                minimum_cash_balance=request.minimum_cash_balance,
                other_sources=request.other_sources,
            )

            # Step 3: Execute Phase 8 Accretion / Dilution using executable sources
            raw_ad = calculate_accretion_dilution(
                buyer=deal.get("acquirer", {}),
                target=deal.get("target", {}),
                deal=deal,
                sources_uses=su,
                debt_interest_rate=request.debt_interest_rate,
                foregone_cash_interest_rate=request.foregone_cash_interest_rate,
                tax_rate=request.tax_rate,
                synergy_year_1=request.synergy_year_1,
                synergy_year_2=request.synergy_year_2,
                synergy_year_3=request.synergy_year_3,
            )
        except ValueError as exc:
            raise InvalidInputError(str(exc))
        except Exception as exc:
            logger.error("Accretion / Dilution calculation failed for %s -> %s: %s", buyer_id, target_id, exc)
            raise

        cleaned = clean_nan(raw_ad)

        # Build typed year projections
        years_dict: Dict[str, ADYearProjection] = {}
        for y_key, y_data in cleaned["pro_forma"]["years"].items():
            years_dict[y_key] = ADYearProjection(**y_data)

        # Build typed break-even metrics
        be_dict: Dict[str, BreakEvenSynergyDetail] = {}
        for be_key, be_data in cleaned.get("break_even", {}).items():
            be_dict[be_key] = BreakEvenSynergyDetail(**be_data)

        pro_forma_obj = ADProFormaProjections(
            new_shares_issued=cleaned["pro_forma"].get("new_shares_issued"),
            pro_forma_shares=cleaned["pro_forma"].get("pro_forma_shares"),
            years=years_dict,
        )

        return AccretionDilutionResponse(
            buyer=BuyerADProfile(**cleaned["buyer"]),
            target=TargetADProfile(**cleaned["target"]),
            financing=ADFinancingDetail(**cleaned["financing"]),
            synergies=ADSynergiesDetail(**cleaned["synergies"]),
            standalone=ADStandaloneEPS(**cleaned["standalone"]),
            pro_forma=pro_forma_obj,
            break_even=be_dict,
            diagnostics=cleaned.get("diagnostics", []),
            is_available=bool(cleaned.get("is_available")),
            is_feasible=bool(cleaned.get("is_feasible")),
        )
