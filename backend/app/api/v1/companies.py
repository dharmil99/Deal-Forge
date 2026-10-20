"""
backend/app/api/v1/companies.py

API router for company research, financial history, comps, precedents, DCF, and valuation summary.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Path, Query

from backend.app.api.deps import (
    get_company_service,
    get_comps_service,
    get_dcf_service,
    get_precedents_service,
    get_valuation_service,
)
from backend.app.schemas.company import (
    CompanyDetail,
    CompanyFinancialsResponse,
    CompanyListResponse,
)
from backend.app.schemas.comps import CompsResponse
from backend.app.schemas.dcf import DCFResponse
from backend.app.schemas.precedents import PrecedentsResponse
from backend.app.schemas.valuation import ValuationSummaryResponse
from backend.app.services.company_service import CompanyService
from backend.app.services.comps_service import CompsService
from backend.app.services.dcf_service import DCFService
from backend.app.services.precedents_service import PrecedentsService
from backend.app.services.valuation_service import ValuationService

router = APIRouter()


@router.get(
    "",
    response_model=CompanyListResponse,
    summary="List Universe Companies",
    description="List companies in the DealForge universe with optional filtering and pagination.",
)
async def list_companies(
    sector: Optional[str] = Query(None, description="Filter by sector (e.g. 'IT', 'Materials')"),
    industry: Optional[str] = Query(None, description="Filter by industry (e.g. 'Cement', 'IT Services')"),
    sector_type: Optional[str] = Query(None, description="Filter by sector type ('Industrial' or 'Financial')"),
    search: Optional[str] = Query(None, description="Search query matching company ID, name, or ticker"),
    skip: int = Query(0, ge=0, description="Offset index for pagination"),
    limit: int = Query(50, ge=1, le=500, description="Page size limit"),
    company_service: CompanyService = Depends(get_company_service),
) -> CompanyListResponse:
    return company_service.list_companies(
        sector=sector,
        industry=industry,
        sector_type=sector_type,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{company_identifier}",
    response_model=CompanyDetail,
    summary="Get Company Detail",
    description="Retrieve comprehensive company profile, market valuation data, and screening metrics.",
)
async def get_company_detail(
    company_identifier: str = Path(..., description="Company identifier (e.g. 'TCS') or ticker"),
    company_service: CompanyService = Depends(get_company_service),
) -> CompanyDetail:
    return company_service.get_company(company_identifier)


@router.get(
    "/{company_identifier}/financials",
    response_model=CompanyFinancialsResponse,
    summary="Get Company Historical Financials",
    description="Retrieve historical annual financial statements (income statement, balance sheet, cash flow items).",
)
async def get_company_financials(
    company_identifier: str = Path(..., description="Company identifier or ticker"),
    company_service: CompanyService = Depends(get_company_service),
) -> CompanyFinancialsResponse:
    return company_service.get_company_financials(company_identifier)


@router.get(
    "/{company_identifier}/comps",
    response_model=CompsResponse,
    summary="Comparable Companies Analysis",
    description="Derive trading multiples and implied valuation range based on industry peers using analytics/comps.py.",
)
async def get_company_comps(
    company_identifier: str = Path(..., description="Target company identifier"),
    sector: Optional[str] = Query(None, description="Optional sector override (broadens peer group)"),
    industry: Optional[str] = Query(None, description="Optional industry override"),
    peer_ids: Optional[List[str]] = Query(None, description="Hand-picked explicit peer company IDs"),
    percentile: str = Query("median", description="Multiple percentile to apply ('p25', 'median', 'p75')"),
    comps_service: CompsService = Depends(get_comps_service),
) -> CompsResponse:
    return comps_service.get_comps(
        company_identifier=company_identifier,
        sector=sector,
        industry=industry,
        peer_ids=peer_ids,
        percentile=percentile,
    )


@router.get(
    "/{company_identifier}/precedents",
    response_model=PrecedentsResponse,
    summary="Precedent Transactions Analysis",
    description="Derive deal multiples and implied valuation range based on historical M&A transactions using analytics/precedents.py.",
)
async def get_company_precedents(
    company_identifier: str = Path(..., description="Target company identifier"),
    sector: Optional[str] = Query(None, description="Filter transactions by target sector"),
    industry: Optional[str] = Query(None, description="Filter transactions by target industry"),
    start_date: Optional[str] = Query(None, description="Earliest deal announcement date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Latest deal announcement date (YYYY-MM-DD)"),
    min_deal_value_cr: Optional[float] = Query(None, description="Minimum deal consideration in Rs Cr"),
    max_deal_value_cr: Optional[float] = Query(None, description="Maximum deal consideration in Rs Cr"),
    percentile: str = Query("median", description="Transaction multiple percentile ('p25', 'median', 'p75')"),
    precedents_service: PrecedentsService = Depends(get_precedents_service),
) -> PrecedentsResponse:
    return precedents_service.get_precedents(
        company_identifier=company_identifier,
        sector=sector,
        industry=industry,
        start_date=start_date,
        end_date=end_date,
        min_deal_value_cr=min_deal_value_cr,
        max_deal_value_cr=max_deal_value_cr,
        percentile=percentile,
    )


@router.get(
    "/{company_identifier}/dcf",
    response_model=DCFResponse,
    summary="Discounted Cash Flow Valuation",
    description="Calculate DCF valuation, Gordon Growth terminal value, and explicit FCFF projections using analytics/dcf.py.",
)
async def get_company_dcf(
    company_identifier: str = Path(..., description="Target company identifier"),
    wacc: Optional[float] = Query(None, description="Explicit WACC discount rate override (e.g. 0.12 for 12%)"),
    terminal_growth: float = Query(0.05, description="Perpetual terminal growth rate (must be < WACC)"),
    forecast_years: int = Query(5, ge=1, le=20, description="Number of explicit forecast years"),
    revenue_growth: Optional[float] = Query(None, description="Annual revenue growth rate override"),
    ebitda_margin: Optional[float] = Query(None, description="EBITDA margin override"),
    da_pct_revenue: Optional[float] = Query(None, description="D&A % of revenue override"),
    capex_pct_revenue: Optional[float] = Query(None, description="CapEx % of revenue override"),
    tax_rate: Optional[float] = Query(None, description="Tax rate override"),
    risk_free_rate: float = Query(0.07, description="Risk-free rate for CAPM WACC"),
    equity_risk_premium: float = Query(0.06, description="Equity risk premium for CAPM WACC"),
    beta: float = Query(1.0, description="Equity beta for CAPM WACC"),
    dcf_service: DCFService = Depends(get_dcf_service),
) -> DCFResponse:
    return dcf_service.get_dcf(
        company_identifier=company_identifier,
        wacc=wacc,
        terminal_growth=terminal_growth,
        forecast_years=forecast_years,
        revenue_growth=revenue_growth,
        ebitda_margin=ebitda_margin,
        da_pct_revenue=da_pct_revenue,
        capex_pct_revenue=capex_pct_revenue,
        tax_rate=tax_rate,
        risk_free_rate=risk_free_rate,
        equity_risk_premium=equity_risk_premium,
        beta=beta,
    )


@router.get(
    "/{company_identifier}/valuation",
    response_model=ValuationSummaryResponse,
    summary="Valuation Summary & Football Field",
    description="Unified multi-methodology valuation comparing Comps, Precedents, and DCF without blending, using analytics/valuation.py.",
)
async def get_company_valuation(
    company_identifier: str = Path(..., description="Target company identifier"),
    sector: Optional[str] = Query(None, description="Optional sector filter for peers and transactions"),
    peer_ids: Optional[List[str]] = Query(None, description="Hand-picked explicit peer company IDs"),
    comps_percentile: str = Query("median", description="Comps percentile to highlight ('p25', 'median', 'p75')"),
    precedents_percentile: str = Query("median", description="Precedents percentile to highlight"),
    valuation_service: ValuationService = Depends(get_valuation_service),
) -> ValuationSummaryResponse:
    return valuation_service.get_valuation_summary(
        company_identifier=company_identifier,
        sector=sector,
        peer_ids=peer_ids,
        comps_percentile=comps_percentile,
        precedents_percentile=precedents_percentile,
    )
