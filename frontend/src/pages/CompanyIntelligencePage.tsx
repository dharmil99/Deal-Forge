import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MetricStrip, MetricItemDef } from '@/components/workstation/MetricStrip';
import { DataQualityBadge } from '@/components/workstation/DataQualityBadge';
import {
  ChartContainer,
  DualAxisTrendChart,
  CapitalStructureChart,
} from '@/components/charts';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/services/api/client';
import type { CompanyDetail, CompanyFinancialRow, CompanySummary } from '@/types/api';
import {
  formatCurrencyCr,
  formatPercent,
  formatMultiple,
  formatPriceINR,
  formatScore,
} from '@/utils/formatters';
import {
  Building2,
  TrendingUp,
  Scale,
  History,
} from 'lucide-react';

const QUICK_COMPANIES = [
  'TCS',
  'Reliance Industries',
  'UltraTech Cement',
  'Infosys',
  'HCLTech',
  'NMDC',
  'Wipro',
  'Coforge',
];

export const CompanyIntelligencePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedCompanyParam = searchParams.get('company') || 'TCS';

  const [companyList, setCompanyList] = useState<CompanySummary[]>([]);
  const [companyDetail, setCompanyDetail] = useState<CompanyDetail | null>(null);
  const [financials, setFinancials] = useState<CompanyFinancialRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('financials');

  // Load all companies for quick switcher
  useEffect(() => {
    let mounted = true;
    apiClient.companies.list({ limit: 120 }).then((res) => {
      if (mounted) setCompanyList(res.items || []);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Load selected company details & financials
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [detailRes, finRes] = await Promise.all([
          apiClient.companies.getById(selectedCompanyParam),
          apiClient.companies.getFinancials(selectedCompanyParam),
        ]);

        if (mounted) {
          setCompanyDetail(detailRes);
          setFinancials(finRes.financials || []);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : `Failed to load intelligence data for company '${selectedCompanyParam}'`,
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [selectedCompanyParam]);

  const handleSelectCompany = (companyId: string) => {
    setSearchParams({ company: companyId });
  };

  // Headline Metric Strip
  const headlineMetrics: MetricItemDef[] = useMemo(() => {
    if (!companyDetail) return [];

    return [
      {
        label: 'LATEST REVENUE',
        value: formatCurrencyCr(companyDetail.revenue_latest),
        helper: companyDetail.revenue_cagr
          ? `CAGR: ${formatPercent(companyDetail.revenue_cagr)}`
          : undefined,
        tone: 'accent',
      },
      {
        label: 'LATEST EBITDA',
        value: formatCurrencyCr(companyDetail.ebitda_latest),
        helper: `Margin: ${formatPercent(companyDetail.ebitda_margin)}`,
        tone: companyDetail.ebitda_margin && companyDetail.ebitda_margin >= 0.15 ? 'positive' : 'default',
      },
      {
        label: 'NET INCOME',
        value: formatCurrencyCr(companyDetail.net_income_latest),
        helper: companyDetail.eps ? `EPS: ₹${companyDetail.eps.toFixed(2)}` : undefined,
      },
      {
        label: 'NET DEBT',
        value: formatCurrencyCr(companyDetail.net_debt_latest),
        helper: companyDetail.net_debt_ebitda
          ? `ND/EBITDA: ${formatMultiple(companyDetail.net_debt_ebitda)}`
          : 'Net Cash Position',
        tone: companyDetail.net_debt_latest != null && companyDetail.net_debt_latest > 0 ? 'warning' : 'positive',
      },
      {
        label: 'MARKET CAP',
        value: formatCurrencyCr(companyDetail.market_cap_latest),
        helper: companyDetail.current_price
          ? `Price: ${formatPriceINR(companyDetail.current_price)}`
          : undefined,
      },
      {
        label: 'ENTERPRISE VALUE',
        value: formatCurrencyCr(companyDetail.ev),
        helper: `EV/EBITDA: ${formatMultiple(companyDetail.ev_ebitda)}`,
      },
    ];
  }, [companyDetail]);

  // Historical Financials Table Columns
  const financialColumns: Column<CompanyFinancialRow>[] = [
    {
      key: 'fiscal_year',
      header: 'FISCAL YEAR',
      width: '110px',
      render: (row) => <strong>FY{row.fiscal_year}</strong>,
    },
    {
      key: 'revenue',
      header: 'REVENUE',
      align: 'right',
      width: '12%',
      render: (row) => formatCurrencyCr(row.revenue, 1),
    },
    {
      key: 'ebitda_derived',
      header: 'EBITDA',
      align: 'right',
      width: '12%',
      render: (row) => formatCurrencyCr(row.ebitda_derived, 1),
    },
    {
      key: 'ebitda_margin_derived',
      header: 'MARGIN',
      align: 'right',
      width: '10%',
      render: (row) => (
        <span
          style={{
            color:
              row.ebitda_margin_derived != null && row.ebitda_margin_derived >= 0.15
                ? 'var(--positive)'
                : 'inherit',
          }}
        >
          {formatPercent(row.ebitda_margin_derived)}
        </span>
      ),
    },
    {
      key: 'pbt',
      header: 'PBT',
      align: 'right',
      width: '11%',
      render: (row) => formatCurrencyCr(row.pbt, 1),
    },
    {
      key: 'tax',
      header: 'TAX',
      align: 'right',
      width: '10%',
      render: (row) => formatCurrencyCr(row.tax, 1),
    },
    {
      key: 'net_income',
      header: 'NET PROFIT',
      align: 'right',
      width: '12%',
      render: (row) => formatCurrencyCr(row.net_income, 1),
    },
    {
      key: 'total_debt',
      header: 'BORROWINGS',
      align: 'right',
      width: '11%',
      render: (row) => formatCurrencyCr(row.total_debt, 1),
    },
    {
      key: 'cash',
      header: 'CASH',
      align: 'right',
      width: '11%',
      render: (row) => formatCurrencyCr(row.cash, 1),
    },
    {
      key: 'net_debt_derived',
      header: 'NET DEBT',
      align: 'right',
      width: '11%',
      render: (row) => {
        const val = row.net_debt_derived;
        return (
          <span style={{ color: val != null && val < 0 ? 'var(--positive)' : 'inherit' }}>
            {formatCurrencyCr(val, 1)}
          </span>
        );
      },
    },
  ];

  const tabs: TabItem[] = [
    { id: 'financials', label: 'Historical Financial Statements' },
    { id: 'trends', label: 'Operating & Growth Trajectory' },
    { id: 'valuation', label: 'Valuation & Multiples Profile' },
    { id: 'quality', label: 'Data Quality & Governance Audit' },
  ];

  return (
    <PageContainer>
      {/* 1. Page Header */}
      <PageHeader
        title="Company Intelligence"
        description="Audited financial history, operating margins, capital structure, and valuation snapshot."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(`/research/comps?company=${encodeURIComponent(selectedCompanyParam)}`)
              }
            >
              <Scale size={13} style={{ marginRight: '6px' }} />
              Trading Comps
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(`/research/precedents?company=${encodeURIComponent(selectedCompanyParam)}`)
              }
            >
              <History size={13} style={{ marginRight: '6px' }} />
              Precedents
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                navigate(`/research/valuation?company=${encodeURIComponent(selectedCompanyParam)}`)
              }
            >
              <TrendingUp size={13} style={{ marginRight: '6px' }} />
              Valuation Football Field
            </Button>
          </div>
        }
      />

      {/* 2. Top Company Selector & Quick Switcher */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 size={16} style={{ color: 'var(--accent-line)' }} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
            TARGET SELECTOR:
          </span>
          <div style={{ width: '260px' }}>
            <Select
              options={companyList.map((c) => ({
                value: c.company_id,
                label: `${c.company_name} (${c.company_id})`,
              }))}
              value={selectedCompanyParam}
              onChange={(e) => handleSelectCompany(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>
            Benchmarks:
          </span>
          {QUICK_COMPANIES.map((id) => (
            <button
              key={id}
              onClick={() => handleSelectCompany(id)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-xs)',
                background: selectedCompanyParam === id ? 'var(--accent)' : 'var(--bg-surface-2)',
                color: selectedCompanyParam === id ? '#FFFFFF' : 'var(--text-strong)',
                border: selectedCompanyParam === id ? '1px solid var(--accent-line)' : '1px solid var(--line)',
                cursor: 'pointer',
              }}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingState message={`Retrieving audited financials for ${selectedCompanyParam}...`} />
      ) : error ? (
        <ErrorState
          title="COMPANY RECORD NOT FOUND"
          error={error}
          onRetry={() => window.location.reload()}
        />
      ) : companyDetail ? (
        <>
          {/* 3. Company Metadata Header Bar */}
          <div
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px 20px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {companyDetail.company_name}
                </h2>
                {companyDetail.ticker && (
                  <span
                    style={{
                      fontSize: '12px',
                      background: 'rgba(37, 99, 235, 0.15)',
                      color: 'var(--focus)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs)',
                      fontWeight: 600,
                    }}
                  >
                    NSE: {companyDetail.ticker}
                  </span>
                )}
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-label)',
                    border: '1px solid var(--line)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                  }}
                >
                  {companyDetail.sector_type || 'Industrial'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>
                  Sector: <strong style={{ color: 'var(--text-strong)' }}>{companyDetail.sector || '—'}</strong>
                </span>
                <span>·</span>
                <span>
                  Industry: <strong style={{ color: 'var(--text-strong)' }}>{companyDetail.industry || '—'}</strong>
                </span>
                <span>·</span>
                <span>
                  ID: <strong style={{ color: 'var(--text-strong)' }}>{companyDetail.company_id}</strong>
                </span>
                {companyDetail.latest_fiscal_year && (
                  <>
                    <span>·</span>
                    <span>
                      Latest Reporting:{' '}
                      <strong style={{ color: 'var(--positive)' }}>
                        FY{companyDetail.latest_fiscal_year}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quality Flags */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <DataQualityBadge
                label={`${companyDetail.years_of_history || 10}Y Financial History`}
                tone="positive"
              />
              {companyDetail.shares_outstanding_is_stale && (
                <DataQualityBadge
                  label={`Shares Stale (FY${companyDetail.shares_outstanding_fallback_year})`}
                  tone="warning"
                />
              )}
              {companyDetail.source_file && (
                <DataQualityBadge
                  label={`Source: ${companyDetail.source_file}`}
                  tone="neutral"
                />
              )}
            </div>
          </div>

          {/* 4. Headline Metrics Strip */}
          <div style={{ marginBottom: '20px' }}>
            <MetricStrip items={headlineMetrics} />
          </div>

          {/* 5. Navigation Tabs */}
          <div style={{ marginBottom: '16px' }}>
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>

          {/* 6. Tab Content */}
          {activeTab === 'financials' && (
            <div>
              <SectionHeader
                title="Audited Historical Financial Statements"
                description="10-year historical annual income statement, balance sheet, and derived metrics in ₹ Cr."
              />
              <DataTable
                columns={financialColumns}
                data={financials}
                keyExtractor={(row) => row.fiscal_year}
                maxHeight="480px"
                emptyMessage="No historical statements found for this company."
              />
            </div>
          )}

          {activeTab === 'trends' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SectionHeader
                title="Operating Trajectory & Financial Performance"
                description="Audited 10-year historical revenue, EBITDA, and EBITDA margin evolution with explicit dual axes."
              />
              <ChartContainer
                title={`${companyDetail.company_name} — Operating Revenue & EBITDA Performance`}
                subtitle="Dual-axis financial trajectory: Left scale in ₹ Cr (Revenue & EBITDA), Right scale in % (EBITDA Margin)"
                badge={<DataQualityBadge label={`${financials.length}Y Audited History`} tone="positive" />}
                minHeight="350px"
                legend={[
                  { label: 'Revenue (₹ Cr)', color: '#3B82F6', type: 'square' },
                  { label: 'EBITDA (₹ Cr)', color: '#2563EB', type: 'square' },
                  { label: 'EBITDA Margin (%)', color: 'var(--positive)', type: 'line' },
                ]}
              >
                <DualAxisTrendChart financials={financials} height={310} />
              </ChartContainer>

              {/* Statistical Growth Summary */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '12px',
                }}
              >
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>REVENUE CAGR</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {formatPercent(companyDetail.revenue_cagr)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-label)', marginTop: '2px' }}>
                    Historical Compounded Growth
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GROWTH SCORE</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-line)', marginTop: '4px' }}>
                    {formatScore(companyDetail.growth_score)} / 100
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-label)', marginTop: '2px' }}>
                    Percentile across universe
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MARGIN SCORE</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--positive)', marginTop: '4px' }}>
                    {formatScore(companyDetail.margin_score)} / 100
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-label)', marginTop: '2px' }}>
                    Profitability percentile
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>COMPOSITE SCREENING SCORE</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--focus)', marginTop: '4px' }}>
                    {formatScore(companyDetail.illustrative_screening_score)} / 100
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-label)', marginTop: '2px' }}>
                    Multi-factor target ranking
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'valuation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SectionHeader
                title="Current Valuation Snapshot"
                description="Key trading multiples and capital structure metrics derived from latest audited filings."
              />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '16px',
                }}
              >
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '6px' }}>
                    TRADING MULTIPLES
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>EV / Revenue:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMultiple(companyDetail.ev_revenue)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>EV / EBITDA:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMultiple(companyDetail.ev_ebitda)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>P / E Ratio:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMultiple(companyDetail.pe_ratio)}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '6px' }}>
                    CAPITAL STRUCTURE
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Market Cap:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(companyDetail.market_cap_latest)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Net Debt:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(companyDetail.net_debt_latest)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Enterprise Value:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(companyDetail.ev)}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '6px' }}>
                    PER-SHARE METRICS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Current Price:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPriceINR(companyDetail.current_price)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>EPS:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>₹{companyDetail.eps?.toFixed(2) || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Face Value:</span>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>₹{companyDetail.face_value || '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capital Structure History Chart */}
              <ChartContainer
                title={`${companyDetail.company_name} — Capital Structure History`}
                subtitle="Historical debt, liquid cash reserves, and derived net debt position across fiscal years"
                badge={
                  <DataQualityBadge
                    label={companyDetail.net_debt_latest != null && companyDetail.net_debt_latest <= 0 ? 'Net Cash Position' : 'Leveraged'}
                    tone={companyDetail.net_debt_latest != null && companyDetail.net_debt_latest <= 0 ? 'positive' : 'warning'}
                  />
                }
                minHeight="280px"
                legend={[
                  { label: 'Total Borrowings (₹ Cr)', color: '#EF4444', type: 'square' },
                  { label: 'Cash & Equivalents (₹ Cr)', color: '#10B981', type: 'square' },
                  { label: 'Net Debt / (Cash) (₹ Cr)', color: 'var(--focus)', type: 'square' },
                ]}
              >
                <CapitalStructureChart financials={financials} height={230} />
              </ChartContainer>
            </div>
          )}

          {activeTab === 'quality' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SectionHeader
                title="Data Quality & Integrity Audit"
                description="Transparency disclosures regarding historical filing completeness, share count freshness, and formula derivation."
              />

              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>SOURCE FILE</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {companyDetail.source_file || 'Standard Screener Feed'}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>STATEMENT DEPTH</div>
                    <div style={{ fontWeight: 600, color: 'var(--positive)' }}>
                      {financials.length} Annual Filings Loaded (FY{financials[0]?.fiscal_year} — FY{financials[financials.length - 1]?.fiscal_year})
                    </div>
                  </div>

                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>SHARES OUTSTANDING FRESHNESS</div>
                    <div style={{ fontWeight: 600, color: companyDetail.shares_outstanding_is_stale ? 'var(--warning)' : 'var(--positive)' }}>
                      {companyDetail.shares_outstanding_is_stale
                        ? `Fallback Applied: Sourced from FY${companyDetail.shares_outstanding_fallback_year}`
                        : 'Current Fiscal Year'}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>CAPITAL STRUCTURE FORMULA</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      Enterprise Value = Market Cap + Net Debt (Borrowings - Cash)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </PageContainer>
  );
};
