import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { MetricStrip, MetricItemDef } from '@/components/workstation/MetricStrip';
import { DataQualityBadge } from '@/components/workstation/DataQualityBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/services/api/client';
import {
  ChartContainer,
  DonutChart,
  DonutSegment,
  ScatterPlot,
  ScatterPoint,
  TimelineChart,
  TimelineDealItem,
} from '@/components/charts';
import type { CompanySummary, ScreenedCompany } from '@/types/api';
import {
  formatCurrencyCr,
  formatPercent,
  formatMultiple,
} from '@/utils/formatters';
import {
  Building2,
  Filter,
  Search,
} from 'lucide-react';

const PINNED_TARGETS = [
  { id: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', cap: 786463.7, margin: 0.271, pe: 28.4 },
  { id: 'Reliance Industries', name: 'Reliance Industries Ltd', sector: 'Energy', cap: 994500.0, margin: 0.178, pe: 24.1 },
  { id: 'UltraTech Cement', name: 'UltraTech Cement Ltd', sector: 'Materials', cap: 331489.2, margin: 0.194, pe: 36.2 },
  { id: 'Infosys', name: 'Infosys Ltd', sector: 'IT', cap: 765400.0, margin: 0.242, pe: 26.8 },
];

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [screenedCompanies, setScreenedCompanies] = useState<ScreenedCompany[]>([]);
  const [precedents, setPrecedents] = useState<TimelineDealItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUniverse() {
      try {
        setIsLoading(true);
        setError(null);
        const [universeRes, screeningRes, precedentsRes] = await Promise.all([
          apiClient.companies.list({ limit: 120 }),
          apiClient.screening.run({}),
          apiClient.companies.getPrecedents('TCS').catch(() => null),
        ]);

        if (isMounted) {
          setCompanies(universeRes.items || []);
          setScreenedCompanies(screeningRes.items || []);

          if (precedentsRes?.transactions) {
            setPrecedents(
              precedentsRes.transactions.map((t: any) => ({
                id: t.transaction_id,
                date: t.announcement_date || '',
                target: t.target,
                acquirer: t.acquirer,
                dealValueCr: t.deal_value_cr,
                evRevenue: t.ev_revenue,
                sector: t.sector,
              }))
            );
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load company universe');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadUniverse();
    return () => {
      isMounted = false;
    };
  }, []);

  // Unique sector options
  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    companies.forEach((c) => {
      if (c.sector) set.add(c.sector);
    });
    return [
      { value: 'ALL', label: 'All Sectors' },
      ...Array.from(set)
        .sort()
        .map((s) => ({ value: s, label: s })),
    ];
  }, [companies]);

  // Sector breakdown stats
  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    companies.forEach((c) => {
      const s = c.sector || 'Unclassified';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [companies]);

  // Filtered universe table
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchesSearch =
        searchQuery === '' ||
        c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.ticker && c.ticker.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSector = selectedSector === 'ALL' || c.sector === selectedSector;

      return matchesSearch && matchesSector;
    });
  }, [companies, searchQuery, selectedSector]);

  // Donut chart data for sectors
  const donutData: DonutSegment[] = useMemo(() => {
    return sectorCounts.map(([sec, count]) => ({
      id: sec,
      label: sec,
      value: count,
    }));
  }, [sectorCounts]);

  // Scatter plot points for Target Landscape: X = Revenue CAGR, Y = EBITDA Margin
  const scatterPoints: ScatterPoint[] = useMemo(() => {
    return screenedCompanies
      .filter((c) => {
        const matchesSector = selectedSector === 'ALL' || c.sector === selectedSector;
        return matchesSector && c.revenue_cagr != null && c.ebitda_margin != null;
      })
      .map((c) => ({
        id: c.company_id,
        name: c.company_name,
        ticker: c.ticker || undefined,
        x: c.revenue_cagr!,
        y: c.ebitda_margin!,
        category: c.sector,
        metadata: {
          'Revenue': formatCurrencyCr(c.revenue_latest, 1),
          'EBITDA': formatCurrencyCr(c.ebitda_latest, 1),
          'EV / EBITDA': c.ev_ebitda != null ? formatMultiple(c.ev_ebitda) : '—',
        },
      }));
  }, [screenedCompanies, selectedSector]);

  // Headline Metric Strip
  const headlineMetrics: MetricItemDef[] = [
    {
      label: 'COMPANIES COVERED',
      value: companies.length > 0 ? companies.length : '113',
      helper: '100% Audited Sourced Data',
      tone: 'accent',
    },
    {
      label: 'SECTORS REPRESENTED',
      value: sectorCounts.length > 0 ? sectorCounts.length : '16',
      helper: 'Industrial & Financial Coverage',
    },
    {
      label: 'SCREENABLE UNIVERSE',
      value: companies.filter((c) => c.sector_type !== 'Financial').length || '102',
      helper: 'Industrial Corporates',
      tone: 'positive',
    },
    {
      label: 'PRECEDENT TRANSACTIONS',
      value: '4',
      helper: 'Sample Limitation Active (n < 5)',
      tone: 'warning',
    },
    {
      label: 'FINANCIAL DEPTH',
      value: '10 Years',
      helper: 'Audited Statement History',
    },
  ];

  // Table columns
  const columns: Column<CompanySummary>[] = [
    {
      key: 'company_name',
      header: 'COMPANY',
      width: '24%',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.company_name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {row.company_id} {row.ticker ? `· ${row.ticker}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'sector',
      header: 'SECTOR',
      width: '14%',
      render: (row) => (
        <span style={{ fontSize: '12px', color: 'var(--text-strong)' }}>
          {row.sector || '—'}
        </span>
      ),
    },
    {
      key: 'revenue_latest',
      header: 'REVENUE',
      align: 'right',
      width: '13%',
      render: (row) => formatCurrencyCr(row.revenue_latest, 1),
    },
    {
      key: 'ebitda_latest',
      header: 'EBITDA',
      align: 'right',
      width: '12%',
      render: (row) => formatCurrencyCr(row.ebitda_latest, 1),
    },
    {
      key: 'ebitda_margin',
      header: 'MARGIN',
      align: 'right',
      width: '9%',
      render: (row) => (
        <span
          style={{
            color: row.ebitda_margin != null && row.ebitda_margin >= 0.15 ? 'var(--positive)' : 'inherit',
          }}
        >
          {formatPercent(row.ebitda_margin)}
        </span>
      ),
    },
    {
      key: 'ev',
      header: 'EV',
      align: 'right',
      width: '14%',
      render: (row) => formatCurrencyCr(row.ev, 1),
    },
    {
      key: 'ev_ebitda',
      header: 'EV/EBITDA',
      align: 'right',
      width: '9%',
      render: (row) => formatMultiple(row.ev_ebitda),
    },
    {
      key: 'pe_ratio',
      header: 'P/E',
      align: 'right',
      width: '8%',
      render: (row) => formatMultiple(row.pe_ratio),
    },
  ];

  return (
    <PageContainer>
      {/* 1. Page Header */}
      <PageHeader
        title="Overview"
        description="Global DealForge research command center across 113 sourced Indian companies."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/research/screening')}
            >
              <Filter size={14} style={{ marginRight: '6px' }} />
              Open Screener
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/research/companies?company=TCS')}
            >
              <Building2 size={14} style={{ marginRight: '6px' }} />
              Inspect Company
            </Button>
          </div>
        }
      />

      {/* 2. Headline Metric Strip */}
      <div style={{ marginBottom: '20px' }}>
        <MetricStrip items={headlineMetrics} />
      </div>

      {isLoading ? (
        <LoadingState message="Loading DealForge company universe..." />
      ) : error ? (
        <ErrorState
          title="DATA SERVICE UNAVAILABLE"
          error={error}
          onRetry={() => window.location.reload()}
        />
      ) : (
        <>
          {/* 3. Visual Analytics Section: Target Landscape Scatter (70%) + Sector Donut & Timeline (30%) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 360px',
              gap: '20px',
              marginBottom: '24px',
              alignItems: 'start',
            }}
          >
            {/* Left Primary Chart: Target Landscape Scatter */}
            <ChartContainer
              title="Target Landscape — Growth vs Profitability"
              subtitle="Revenue CAGR vs EBITDA Margin across screened universe. Click point to inspect."
              badge={<DataQualityBadge label={`${scatterPoints.length} Qualified Corporates`} tone="info" />}
              minHeight="380px"
              legend={[
                { label: 'Screened Company', color: 'var(--accent)', type: 'square' },
                { label: 'Selected Target', color: 'var(--warning)', type: 'circle' },
                { label: 'Median Baseline', color: 'var(--line-strong)', type: 'dashed' },
              ]}
            >
              <ScatterPlot
                points={scatterPoints}
                xLabel="Historical Revenue CAGR (%)"
                yLabel="EBITDA Margin (%)"
                xFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                yFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                selectedId={selectedPointId || undefined}
                onSelectPoint={(p) => {
                  setSelectedPointId(p.id);
                }}
                showQuadrantLines={true}
                height={320}
              />
            </ChartContainer>

            {/* Right Column: Sector Distribution Donut & Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ChartContainer
                title="Sector Distribution"
                subtitle="Proportion of universe by operating sector"
                badge={<DataQualityBadge label={`${sectorCounts.length} Sectors`} tone="neutral" />}
                minHeight="220px"
              >
                <DonutChart
                  data={donutData}
                  centerLabel="UNIVERSE"
                  height={180}
                  innerRadiusRatio={0.65}
                />
              </ChartContainer>

              <ChartContainer
                title="Recent M&A Transaction Timeline"
                subtitle="Historical transaction considerations (Sourced Filings)"
                badge={<DataQualityBadge label="n = 4 (Small Sample)" tone="warning" />}
                minHeight="180px"
              >
                <TimelineChart
                  deals={precedents}
                  height={130}
                  onSelectDeal={() => {
                    navigate('/research/precedents');
                  }}
                />
              </ChartContainer>
            </div>
          </div>

          {/* 4. Target Universe Data Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <SectionHeader
                title="Target Universe"
                actions={
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Showing <strong>{filteredCompanies.length}</strong> of{' '}
                    <strong>{companies.length}</strong> companies
                    {selectedPointId && (
                      <span style={{ marginLeft: '12px', color: 'var(--accent)' }}>
                        Selected: <strong>{selectedPointId}</strong>
                        <button
                          onClick={() => setSelectedPointId(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            marginLeft: '6px',
                            fontSize: '11px',
                          }}
                        >
                          (Clear)
                        </button>
                      </span>
                    )}
                  </span>
                }
              />

              {/* Search & Sector Filters */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ width: '220px' }}>
                  <Input
                    placeholder="Search company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    prefixElement={<Search size={14} />}
                  />
                </div>
                <div style={{ width: '160px' }}>
                  <Select
                    options={sectorOptions}
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <DataTable
              columns={columns}
              data={filteredCompanies}
              keyExtractor={(row) => row.company_id}
              maxHeight="460px"
              onRowClick={(row) => {
                setSelectedPointId(row.company_id);
              }}
            />
          </div>

          {/* 4. Bottom Section: Quick-Access Research Targets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SectionHeader
              title="Quick-Access Benchmark Targets"
              description="High-cap benchmark companies across key Indian industrial and technology sectors."
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '12px',
              }}
            >
              {PINNED_TARGETS.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
                  }}
                  onClick={() =>
                    navigate(`/research/companies?company=${encodeURIComponent(t.id)}`)
                  }
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--line-strong)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--line)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {t.id}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        background: 'var(--bg-surface-2)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-xs)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t.sector}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: '10px',
                    }}
                  >
                    {t.name}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      fontSize: '11px',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>CAP</div>
                      <div style={{ fontWeight: 500, color: 'var(--text-strong)' }}>
                        {formatCurrencyCr(t.cap, 0)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>MARGIN</div>
                      <div style={{ fontWeight: 500, color: 'var(--positive)' }}>
                        {formatPercent(t.margin)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
};
