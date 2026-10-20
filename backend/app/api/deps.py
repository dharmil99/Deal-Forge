"""
backend/app/api/deps.py

Dependency injection providers for FastAPI route handlers.
"""

from functools import lru_cache
from fastapi import Depends

from backend.app.core.config import Settings, get_settings
from backend.app.services.accretion_dilution_service import AccretionDilutionService
from backend.app.services.company_service import CompanyService
from backend.app.services.comps_service import CompsService
from backend.app.services.dataset_service import DatasetService
from backend.app.services.dcf_service import DCFService
from backend.app.services.deal_service import DealService
from backend.app.services.precedents_service import PrecedentsService
from backend.app.services.scenario_service import ScenarioService
from backend.app.services.screening_service import ScreeningService
from backend.app.services.sources_uses_service import SourcesUsesService
from backend.app.services.valuation_service import ValuationService


@lru_cache()
def get_dataset_service() -> DatasetService:
    """Return cached singleton instance of DatasetService."""
    settings = get_settings()
    return DatasetService(data_dir=settings.data_dir)


def get_company_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> CompanyService:
    """Return an instance of CompanyService."""
    return CompanyService(dataset_service=dataset_service)


def get_screening_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
) -> ScreeningService:
    """Return an instance of ScreeningService."""
    return ScreeningService(dataset_service=dataset_service)


def get_comps_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
    company_service: CompanyService = Depends(get_company_service),
) -> CompsService:
    """Return an instance of CompsService."""
    return CompsService(dataset_service=dataset_service, company_service=company_service)


def get_precedents_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
    company_service: CompanyService = Depends(get_company_service),
) -> PrecedentsService:
    """Return an instance of PrecedentsService."""
    return PrecedentsService(dataset_service=dataset_service, company_service=company_service)


def get_dcf_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
    company_service: CompanyService = Depends(get_company_service),
) -> DCFService:
    """Return an instance of DCFService."""
    return DCFService(dataset_service=dataset_service, company_service=company_service)


def get_valuation_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
    company_service: CompanyService = Depends(get_company_service),
) -> ValuationService:
    """Return an instance of ValuationService."""
    return ValuationService(dataset_service=dataset_service, company_service=company_service)


def get_deal_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
    company_service: CompanyService = Depends(get_company_service),
) -> DealService:
    """Return an instance of DealService."""
    return DealService(dataset_service=dataset_service, company_service=company_service)


def get_sources_uses_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
    company_service: CompanyService = Depends(get_company_service),
    deal_service: DealService = Depends(get_deal_service),
) -> SourcesUsesService:
    """Return an instance of SourcesUsesService."""
    return SourcesUsesService(
        dataset_service=dataset_service,
        company_service=company_service,
        deal_service=deal_service,
    )


def get_accretion_dilution_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
    company_service: CompanyService = Depends(get_company_service),
    deal_service: DealService = Depends(get_deal_service),
    sources_uses_service: SourcesUsesService = Depends(get_sources_uses_service),
) -> AccretionDilutionService:
    """Return an instance of AccretionDilutionService."""
    return AccretionDilutionService(
        dataset_service=dataset_service,
        company_service=company_service,
        deal_service=deal_service,
        sources_uses_service=sources_uses_service,
    )


def get_scenario_service(
    dataset_service: DatasetService = Depends(get_dataset_service),
    company_service: CompanyService = Depends(get_company_service),
) -> ScenarioService:
    """Return an instance of ScenarioService."""
    return ScenarioService(
        dataset_service=dataset_service,
        company_service=company_service,
    )

