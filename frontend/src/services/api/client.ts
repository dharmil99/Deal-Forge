/**
 * DealForge Institutional API Client
 * Connects to the deterministic FastAPI backend.
 * Base URL is dynamically driven by VITE_API_BASE_URL.
 */

import type {
  CompanyDetail,
  CompanyFinancialsResponse,
  CompanyListResponse,
  CompsResponse,
  DCFResponse,
  DealCreateRequest,
  DealResponse,
  HealthResponse,
  PrecedentsResponse,
  ScenarioResult,
  ScreeningRequest,
  ScreeningResponse,
  SingleScenarioRequest,
  SourcesUsesRequest,
  SourcesUsesResponse,
  AccretionDilutionRequest,
  AccretionDilutionResponse,
  ValuationSummaryResponse,
} from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown,
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...options?.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  return response.json();
}

export const api = {
  // System Health
  system: {
    checkHealth: () => request<HealthResponse>('/api/v1/health'),
    checkRootHealth: () => request<HealthResponse>('/health'),
  },

  // Companies & Research
  companies: {
    list: (params?: {
      sector?: string;
      industry?: string;
      sector_type?: string;
      search?: string;
      skip?: number;
      limit?: number;
    }) => {
      const query = new URLSearchParams();
      if (params?.sector) query.set('sector', params.sector);
      if (params?.industry) query.set('industry', params.industry);
      if (params?.sector_type) query.set('sector_type', params.sector_type);
      if (params?.search) query.set('search', params.search);
      if (params?.skip !== undefined) query.set('skip', String(params.skip));
      if (params?.limit !== undefined) query.set('limit', String(params.limit));
      const qs = query.toString();
      return request<CompanyListResponse>(`/api/v1/companies${qs ? `?${qs}` : ''}`);
    },

    getById: (companyId: string) =>
      request<CompanyDetail>(`/api/v1/companies/${encodeURIComponent(companyId)}`),

    getFinancials: (companyId: string) =>
      request<CompanyFinancialsResponse>(`/api/v1/companies/${encodeURIComponent(companyId)}/financials`),

    getComps: (
      companyId: string,
      params?: {
        sector?: string;
        industry?: string;
        peer_ids?: string[];
        percentile?: string;
      },
    ) => {
      const query = new URLSearchParams();
      if (params?.sector) query.set('sector', params.sector);
      if (params?.industry) query.set('industry', params.industry);
      if (params?.percentile) query.set('percentile', params.percentile);
      if (params?.peer_ids) {
        params.peer_ids.forEach((p) => query.append('peer_ids', p));
      }
      const qs = query.toString();
      return request<CompsResponse>(`/api/v1/companies/${encodeURIComponent(companyId)}/comps${qs ? `?${qs}` : ''}`);
    },

    getPrecedents: (
      companyId: string,
      params?: {
        sector?: string;
        industry?: string;
        start_date?: string;
        end_date?: string;
        min_deal_value_cr?: number;
        max_deal_value_cr?: number;
        percentile?: string;
      },
    ) => {
      const query = new URLSearchParams();
      if (params?.sector) query.set('sector', params.sector);
      if (params?.industry) query.set('industry', params.industry);
      if (params?.start_date) query.set('start_date', params.start_date);
      if (params?.end_date) query.set('end_date', params.end_date);
      if (params?.min_deal_value_cr !== undefined) query.set('min_deal_value_cr', String(params.min_deal_value_cr));
      if (params?.max_deal_value_cr !== undefined) query.set('max_deal_value_cr', String(params.max_deal_value_cr));
      if (params?.percentile) query.set('percentile', params.percentile);
      const qs = query.toString();
      return request<PrecedentsResponse>(`/api/v1/companies/${encodeURIComponent(companyId)}/precedents${qs ? `?${qs}` : ''}`);
    },

    getDCF: (companyId: string, params?: Record<string, string | number | undefined>) => {
      const query = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined) query.set(k, String(v));
        });
      }
      const qs = query.toString();
      return request<DCFResponse>(`/api/v1/companies/${encodeURIComponent(companyId)}/dcf${qs ? `?${qs}` : ''}`);
    },

    getValuation: (
      companyId: string,
      params?: {
        sector?: string;
        peer_ids?: string[];
        comps_percentile?: string;
        precedents_percentile?: string;
      },
    ) => {
      const query = new URLSearchParams();
      if (params?.sector) query.set('sector', params.sector);
      if (params?.comps_percentile) query.set('comps_percentile', params.comps_percentile);
      if (params?.precedents_percentile) query.set('precedents_percentile', params.precedents_percentile);
      if (params?.peer_ids) {
        params.peer_ids.forEach((p) => query.append('peer_ids', p));
      }
      const qs = query.toString();
      return request<ValuationSummaryResponse>(
        `/api/v1/companies/${encodeURIComponent(companyId)}/valuation${qs ? `?${qs}` : ''}`,
      );
    },
  },

  // Target Screening
  screening: {
    run: (payload: ScreeningRequest) =>
      request<ScreeningResponse>('/api/v1/screening', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // Deal Workspace
  deals: {
    buildDeal: (payload: DealCreateRequest) =>
      request<DealResponse>('/api/v1/deals', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    sourcesAndUses: (payload: SourcesUsesRequest) =>
      request<SourcesUsesResponse>('/api/v1/deals/sources-uses', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    accretionDilution: (payload: AccretionDilutionRequest) =>
      request<AccretionDilutionResponse>('/api/v1/deals/accretion-dilution', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    executeScenario: (payload: SingleScenarioRequest) =>
      request<ScenarioResult>('/api/v1/deals/scenario', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    compareScenarios: (payload: unknown) =>
      request<unknown>('/api/v1/deals/scenarios', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    sensitivity1D: (payload: unknown) =>
      request<unknown>('/api/v1/deals/sensitivity/1d', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    sensitivity2D: (payload: unknown) =>
      request<unknown>('/api/v1/deals/sensitivity/2d', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
};

export const apiClient = {
  ...api,
  healthCheck: api.system.checkHealth,
};
