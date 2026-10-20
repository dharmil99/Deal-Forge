"""
backend/app/services/company_service.py

Service layer for company discovery, detail inspection, and historical financial reporting.
"""

import logging
from typing import List, Optional
import pandas as pd

from backend.app.core.errors import EntityNotFoundError
from backend.app.schemas.company import (
    CompanyDetail,
    CompanyFinancialRow,
    CompanyFinancialsResponse,
    CompanyListResponse,
    CompanySummary,
)
from backend.app.services.dataset_service import DatasetService
from backend.app.services.utils import clean_nan

logger = logging.getLogger("dealforge.services.company")


class CompanyService:
    """Service providing query and lookup operations over DealForge companies and financials."""

    def __init__(self, dataset_service: DatasetService) -> None:
        self.dataset_service = dataset_service

    def resolve_company_id(self, identifier: str) -> str:
        """
        Resolve a company identifier (ID or ticker, case-insensitive) to its canonical company_id.
        Raises EntityNotFoundError if not found.
        """
        metrics = self.dataset_service.get_metrics()
        # 1. Exact match on company_id
        exact = metrics[metrics["company_id"] == identifier]
        if not exact.empty:
            return str(exact.iloc[0]["company_id"])

        # 2. Case-insensitive match on company_id
        lower_id = metrics[metrics["company_id"].astype(str).str.lower() == identifier.lower()]
        if not lower_id.empty:
            return str(lower_id.iloc[0]["company_id"])

        # 3. Case-insensitive match on ticker
        if "ticker" in metrics.columns:
            match_ticker = metrics[
                metrics["ticker"].dropna().astype(str).str.lower() == identifier.lower()
            ]
            if not match_ticker.empty:
                return str(match_ticker.iloc[0]["company_id"])

        raise EntityNotFoundError(f"Company '{identifier}' not found")

    def list_companies(
        self,
        sector: Optional[str] = None,
        industry: Optional[str] = None,
        sector_type: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> CompanyListResponse:
        """List companies in the universe with optional filtering and pagination."""
        df = self.dataset_service.get_metrics()

        # Join screening results if available for illustrative scores
        try:
            screening_df = self.dataset_service.get_screening_results()
            if "illustrative_screening_score" in screening_df.columns:
                score_map = dict(
                    zip(screening_df["company_id"], screening_df["illustrative_screening_score"])
                )
                df["illustrative_screening_score"] = df["company_id"].map(score_map)
        except Exception:
            pass

        # Apply filters
        if sector:
            df = df[df["sector"].astype(str).str.lower() == sector.lower()]
        if industry:
            df = df[df["industry"].astype(str).str.lower() == industry.lower()]
        if sector_type:
            df = df[df["sector_type"].astype(str).str.lower() == sector_type.lower()]
        if search:
            s = search.lower()
            cond = (
                df["company_id"].astype(str).str.lower().str.contains(s, regex=False)
                | df["company_name"].astype(str).str.lower().str.contains(s, regex=False)
            )
            if "ticker" in df.columns:
                cond = cond | df["ticker"].fillna("").astype(str).str.lower().str.contains(s, regex=False)
            df = df[cond]

        total = len(df)
        paged = df.iloc[skip : skip + limit]

        items: List[CompanySummary] = []
        for _, row in paged.iterrows():
            row_dict = clean_nan(row.to_dict())
            items.append(
                CompanySummary(
                    company_id=str(row_dict["company_id"]),
                    company_name=str(row_dict["company_name"]),
                    ticker=row_dict.get("ticker"),
                    sector=row_dict.get("sector"),
                    industry=row_dict.get("industry"),
                    sector_type=row_dict.get("sector_type"),
                    current_price=row_dict.get("current_price"),
                    market_cap_latest=row_dict.get("market_cap_latest"),
                    revenue_latest=row_dict.get("revenue_latest"),
                    ebitda_latest=row_dict.get("ebitda_latest"),
                    ebitda_margin=row_dict.get("ebitda_margin"),
                    net_debt_latest=row_dict.get("net_debt_latest"),
                    ev=row_dict.get("ev"),
                    pe_ratio=row_dict.get("pe_ratio"),
                    ev_ebitda=row_dict.get("ev_ebitda"),
                    ev_revenue=row_dict.get("ev_revenue"),
                    illustrative_screening_score=row_dict.get("illustrative_screening_score"),
                )
            )

        return CompanyListResponse(total=total, skip=skip, limit=limit, items=items)

    def get_company(self, company_identifier: str) -> CompanyDetail:
        """Get complete company details for a single target company."""
        canonical_id = self.resolve_company_id(company_identifier)
        metrics = self.dataset_service.get_metrics()
        target_rows = metrics[metrics["company_id"] == canonical_id]
        if target_rows.empty:
            raise EntityNotFoundError(f"Company '{company_identifier}' not found")
        row = target_rows.iloc[0].to_dict()

        # Add fields from companies.csv (e.g. source_file, face_value)
        companies_df = self.dataset_service.get_companies()
        comp_matches = companies_df[companies_df["company_id"] == canonical_id]
        if not comp_matches.empty:
            c_row = comp_matches.iloc[0]
            row["source_file"] = c_row.get("source_file")
            row["face_value"] = c_row.get("face_value")

        # Add scores from screening_results if present
        try:
            screening_df = self.dataset_service.get_screening_results()
            screen_matches = screening_df[screening_df["company_id"] == canonical_id]
            if not screen_matches.empty:
                s_row = screen_matches.iloc[0]
                for score_field in (
                    "growth_score",
                    "margin_score",
                    "valuation_score",
                    "leverage_score",
                    "illustrative_screening_score",
                ):
                    if score_field in s_row:
                        row[score_field] = s_row[score_field]
        except Exception:
            pass

        cleaned = clean_nan(row)
        return CompanyDetail(
            company_id=str(cleaned["company_id"]),
            company_name=str(cleaned.get("company_name", cleaned["company_id"])),
            ticker=cleaned.get("ticker"),
            source_file=cleaned.get("source_file"),
            face_value=cleaned.get("face_value"),
            current_price=cleaned.get("current_price"),
            market_cap_latest=cleaned.get("market_cap_latest"),
            sector=cleaned.get("sector"),
            industry=cleaned.get("industry"),
            sector_type=cleaned.get("sector_type"),
            latest_fiscal_year=cleaned.get("latest_fiscal_year"),
            years_of_history=cleaned.get("years_of_history"),
            revenue_latest=cleaned.get("revenue_latest"),
            revenue_cagr=cleaned.get("revenue_cagr"),
            ebitda_latest=cleaned.get("ebitda_latest"),
            ebitda_margin=cleaned.get("ebitda_margin"),
            net_debt_latest=cleaned.get("net_debt_latest"),
            net_income_latest=cleaned.get("net_income_latest"),
            shares_outstanding_latest=cleaned.get("shares_outstanding_latest"),
            shares_outstanding_fallback_year=cleaned.get("shares_outstanding_fallback_year"),
            shares_outstanding_is_stale=cleaned.get("shares_outstanding_is_stale"),
            ev=cleaned.get("ev"),
            ev_ebitda=cleaned.get("ev_ebitda"),
            net_debt_ebitda=cleaned.get("net_debt_ebitda"),
            ev_revenue=cleaned.get("ev_revenue"),
            eps=cleaned.get("eps"),
            pe_ratio=cleaned.get("pe_ratio"),
            growth_score=cleaned.get("growth_score"),
            margin_score=cleaned.get("margin_score"),
            valuation_score=cleaned.get("valuation_score"),
            leverage_score=cleaned.get("leverage_score"),
            illustrative_screening_score=cleaned.get("illustrative_screening_score"),
        )

    def get_company_financials(self, company_identifier: str) -> CompanyFinancialsResponse:
        """Return historical annual financial records for a given company."""
        canonical_id = self.resolve_company_id(company_identifier)
        fin_df = self.dataset_service.get_financials()
        company_fin = fin_df[fin_df["company_id"] == canonical_id].copy()
        if company_fin.empty:
            return CompanyFinancialsResponse(company_id=canonical_id, count=0, financials=[])

        company_fin = company_fin.dropna(subset=["fiscal_year"]).sort_values("fiscal_year")
        rows: List[CompanyFinancialRow] = []
        for _, r in company_fin.iterrows():
            d = clean_nan(r.to_dict())
            rows.append(
                CompanyFinancialRow(
                    company_id=str(d["company_id"]),
                    fiscal_year=float(d["fiscal_year"]),
                    revenue=d.get("revenue"),
                    other_income=d.get("other_income"),
                    depreciation=d.get("depreciation"),
                    interest=d.get("interest"),
                    pbt=d.get("pbt"),
                    tax=d.get("tax"),
                    net_income=d.get("net_income"),
                    ebitda_derived=d.get("ebitda_derived"),
                    ebitda_margin_derived=d.get("ebitda_margin_derived"),
                    total_debt=d.get("total_debt"),
                    cash=d.get("cash"),
                    net_debt_derived=d.get("net_debt_derived"),
                    shares_outstanding=d.get("shares_outstanding"),
                    cfo=d.get("cfo"),
                    cfi=d.get("cfi"),
                    cff=d.get("cff"),
                )
            )

        return CompanyFinancialsResponse(
            company_id=canonical_id, count=len(rows), financials=rows
        )
