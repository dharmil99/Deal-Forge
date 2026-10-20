import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/services/api/client';
import type { ScreenedCompany, ScreeningRequest, ScreeningResponse } from '@/types/api';
import {
  formatCurrencyCr,
  formatPercent,
  formatMultiple,
  formatScore,
} from '@/utils/formatters';
import {
  ChartContainer,
  ScatterPlot,
  ScatterPoint,
  DistributionBarChart,
} from '@/components/charts';
import { DataQualityBadge } from '@/components/workstation/DataQualityBadge';
import {
  Search,
  RotateCcw,
  ArrowUpDown,
} from 'lucide-react';

export const ScreeningPage: React.FC = () => {
  const navigate = useNavigate();

  // Filter States
  const [sector, setSector] = useState<string>('ALL');
  const [minEbitdaMargin, setMinEbitdaMargin] = useState<string>('ALL');
  const [minRevenueCagr, setMinRevenueCagr] = useState<string>('ALL');
  const [maxEvEbitda, setMaxEvEbitda] = useState<string>('ALL');
  const [maxNetDebtEbitda, setMaxNetDebtEbitda] = useState<string>('ALL');
  const [industrialOnly, setIndustrialOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('illustrative_screening_score');
  const [sortAscending, setSortAscending] = useState<boolean>(false);

  // Response & Status States
  const [data, setData] = useState<ScreeningResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const fetchScreening = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const payload: ScreeningRequest = {
      sector: sector !== 'ALL' ? sector : undefined,
      min_ebitda_margin: minEbitdaMargin !== 'ALL' ? parseFloat(minEbitdaMargin) : undefined,
      min_revenue_cagr: minRevenueCagr !== 'ALL' ? parseFloat(minRevenueCagr) : undefined,
      max_ev_ebitda: maxEvEbitda !== 'ALL' ? parseFloat(maxEvEbitda) : undefined,
      max_net_debt_ebitda: maxNetDebtEbitda !== 'ALL' ? parseFloat(maxNetDebtEbitda) : undefined,
      industrial_only: industrialOnly,
      sort_by: sortBy,
      ascending: sortAscending,
    };

    try {
      const res = await apiClient.screening.run(payload);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screening execution failed');
    } finally {
      setIsLoading(false);
    }
  }, [sector, minEbitdaMargin, minRevenueCagr, maxEvEbitda, maxNetDebtEbitda, industrialOnly, sortBy, sortAscending]);

  useEffect(() => {
    fetchScreening();
  }, [fetchScreening]);

  const handleResetFilters = () => {
    setSector('ALL');
    setMinEbitdaMargin('ALL');
    setMinRevenueCagr('ALL');
    setMaxEvEbitda('ALL');
    setMaxNetDebtEbitda('ALL');
    setIndustrialOnly(true);
    setSearchQuery('');
    setSortBy('illustrative_screening_score');
    setSortAscending(false);
  };

  // Client-side search filtering on returned items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchQuery.trim()) return data.items;

    const q = searchQuery.toLowerCase();
    return data.items.filter(
      (item) =>
        item.company_name.toLowerCase().includes(q) ||
        item.company_id.toLowerCase().includes(q) ||
        (item.ticker && item.ticker.toLowerCase().includes(q)) ||
        (item.industry && item.industry.toLowerCase().includes(q)),
    );
  }, [data, searchQuery]);

  // 1. Scatter Points: Growth vs Margin
  const scatterPoints: ScatterPoint[] = useMemo(() => {
    return filteredItems
      .filter((i) => i.revenue_cagr != null && i.ebitda_margin != null)
      .map((i) => ({
        id: i.company_id,
        name: i.company_name,
        ticker: i.ticker || undefined,
        x: i.revenue_cagr!,
        y: i.ebitda_margin!,
        category: i.sector,
        metadata: {
          'Revenue': formatCurrencyCr(i.revenue_latest, 1),
          'EBITDA': formatCurrencyCr(i.ebitda_latest, 1),
          'EV / EBITDA': i.ev_ebitda != null ? formatMultiple(i.ev_ebitda) : '—',
          'Score': formatScore(i.illustrative_screening_score),
        },
      }));
  }, [filteredItems]);

  // 2. Score Distribution
  const scoreDistribution = useMemo(() => {
    const scores = filteredItems
      .map((i) => i.illustrative_screening_score)
      .filter((s): s is number => s != null);
    if (scores.length === 0) return { bins: [], p25: '—', median: '—', p75: '—' };
    const sorted = [...scores].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];

    const bins = [
      { label: '< 40', min: 0, max: 40, count: 0 },
      { label: '40–55', min: 40, max: 55, count: 0 },
      { label: '55–70', min: 55, max: 70, count: 0 },
      { label: '70–85', min: 70, max: 85, count: 0 },
      { label: '> 85', min: 85, max: 100, count: 0 },
    ];
    scores.forEach((s) => {
      const b = bins.find((r) => s >= r.min && s < r.max) || bins[bins.length - 1];
      b.count++;
    });
    return {
      bins: bins.map((b) => ({ label: b.label, count: b.count })),
      p25: p25.toFixed(1),
      median: median.toFixed(1),
      p75: p75.toFixed(1),
    };
  }, [filteredItems]);

  // 3. EV / EBITDA Multiple Distribution
  const multipleDistribution = useMemo(() => {
    const multiples = filteredItems
      .map((i) => i.ev_ebitda)
      .filter((m): m is number => m != null && m > 0 && m < 150);
    if (multiples.length === 0) return { bins: [], p25: '—', median: '—', p75: '—' };
    const sorted = [...multiples].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];

    const bins = [
      { label: '< 10x', min: 0, max: 10, count: 0 },
      { label: '10–15x', min: 10, max: 15, count: 0 },
      { label: '15–20x', min: 15, max: 20, count: 0 },
      { label: '20–30x', min: 20, max: 30, count: 0 },
      { label: '> 30x', min: 30, max: 150, count: 0 },
    ];
    multiples.forEach((m) => {
      const b = bins.find((r) => m >= r.min && m < r.max) || bins[bins.length - 1];
      b.count++;
    });
    return {
      bins: bins.map((b) => ({ label: b.label, count: b.count })),
      p25: `${p25.toFixed(1)}x`,
      median: `${median.toFixed(1)}x`,
      p75: `${p75.toFixed(1)}x`,
    };
  }, [filteredItems]);

  // Table Columns
  const columns: Column<ScreenedCompany>[] = [
    {
      key: 'rank',
      header: '#',
      width: '44px',
      align: 'center',
      render: (_, idx) => (
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
          {idx + 1}
        </span>
      ),
    },
    {
      key: 'company_name',
      header: 'TARGET COMPANY',
      width: '20%',
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
      width: '12%',
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
      width: '11%',
      render: (row) => formatCurrencyCr(row.revenue_latest, 1),
    },
    {
      key: 'revenue_cagr',
      header: 'CAGR',
      align: 'right',
      width: '8%',
      render: (row) => (
        <span style={{ color: row.revenue_cagr != null && row.revenue_cagr >= 0.1 ? 'var(--positive)' : 'inherit' }}>
          {formatPercent(row.revenue_cagr)}
        </span>
      ),
    },
    {
      key: 'ebitda_latest',
      header: 'EBITDA',
      align: 'right',
      width: '10%',
      render: (row) => formatCurrencyCr(row.ebitda_latest, 1),
    },
    {
      key: 'ebitda_margin',
      header: 'MARGIN',
      align: 'right',
      width: '8%',
      render: (row) => (
        <span style={{ color: row.ebitda_margin != null && row.ebitda_margin >= 0.15 ? 'var(--positive)' : 'inherit' }}>
          {formatPercent(row.ebitda_margin)}
        </span>
      ),
    },
    {
      key: 'ev',
      header: 'EV',
      align: 'right',
      width: '11%',
      render: (row) => formatCurrencyCr(row.ev, 1),
    },
    {
      key: 'ev_ebitda',
      header: 'EV/EBITDA',
      align: 'right',
      width: '8%',
      render: (row) => formatMultiple(row.ev_ebitda),
    },
    {
      key: 'net_debt_ebitda',
      header: 'ND/EBITDA',
      align: 'right',
      width: '9%',
      render: (row) => (
        <span style={{ color: row.net_debt_ebitda != null && row.net_debt_ebitda > 3.0 ? 'var(--warning)' : 'inherit' }}>
          {formatMultiple(row.net_debt_ebitda)}
        </span>
      ),
    },
    {
      key: 'pe_ratio',
      header: 'P/E',
      align: 'right',
      width: '7%',
      render: (row) => formatMultiple(row.pe_ratio),
    },
    {
      key: 'illustrative_screening_score',
      header: 'SCORE',
      align: 'right',
      width: '7%',
      render: (row) => {
        const score = row.illustrative_screening_score;
        let tone = 'var(--text-strong)';
        if (score != null) {
          if (score >= 70) tone = 'var(--positive)';
          else if (score >= 45) tone = 'var(--focus)';
          else tone = 'var(--text-muted)';
        }
        return (
          <span style={{ fontWeight: 600, color: tone, fontVariantNumeric: 'tabular-nums' }}>
            {formatScore(score)}
          </span>
        );
      },
    },
  ];

  return (
    <PageContainer>
      {/* 1. Header */}
      <PageHeader
        title="Target Screening"
        description="Identify and rank acquisition candidates across 113 Indian corporate financials."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              <RotateCcw size={13} style={{ marginRight: '6px' }} />
              Reset Filters
            </Button>
          </div>
        }
      />

      {/* 2. Top Institutional Filter Bar */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Row 1: Primary Controls */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          {/* Search */}
          <Input
            placeholder="Search company/ticker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefixElement={<Search size={14} />}
          />

          {/* Sector */}
          <Select
            label="Sector"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Sectors' },
              { value: 'IT', label: 'IT' },
              { value: 'Materials', label: 'Materials' },
              { value: 'Industrials', label: 'Industrials' },
              { value: 'Consumer Discretionary', label: 'Consumer Discretionary' },
              { value: 'Consumer Staples', label: 'Consumer Staples' },
              { value: 'Energy', label: 'Energy' },
              { value: 'Health Care', label: 'Health Care' },
              { value: 'Communication Services', label: 'Communication' },
              { value: 'Utilities', label: 'Utilities' },
            ]}
          />

          {/* Min EBITDA Margin */}
          <Select
            label="Min EBITDA Margin"
            value={minEbitdaMargin}
            onChange={(e) => setMinEbitdaMargin(e.target.value)}
            options={[
              { value: 'ALL', label: 'Any Margin' },
              { value: '0.10', label: '≥ 10.0%' },
              { value: '0.15', label: '≥ 15.0%' },
              { value: '0.20', label: '≥ 20.0%' },
              { value: '0.25', label: '≥ 25.0%' },
            ]}
          />

          {/* Min Revenue CAGR */}
          <Select
            label="Min Revenue CAGR"
            value={minRevenueCagr}
            onChange={(e) => setMinRevenueCagr(e.target.value)}
            options={[
              { value: 'ALL', label: 'Any CAGR' },
              { value: '0.05', label: '≥ 5.0%' },
              { value: '0.10', label: '≥ 10.0%' },
              { value: '0.15', label: '≥ 15.0%' },
            ]}
          />

          {/* Max EV / EBITDA */}
          <Select
            label="Max EV / EBITDA"
            value={maxEvEbitda}
            onChange={(e) => setMaxEvEbitda(e.target.value)}
            options={[
              { value: 'ALL', label: 'Any Valuation' },
              { value: '15.0', label: '≤ 15.0x' },
              { value: '20.0', label: '≤ 20.0x' },
              { value: '25.0', label: '≤ 25.0x' },
            ]}
          />

          {/* Max Net Debt / EBITDA */}
          <Select
            label="Max ND / EBITDA"
            value={maxNetDebtEbitda}
            onChange={(e) => setMaxNetDebtEbitda(e.target.value)}
            options={[
              { value: 'ALL', label: 'Any Leverage' },
              { value: '1.0', label: '≤ 1.0x (Low)' },
              { value: '2.0', label: '≤ 2.0x (Moderate)' },
              { value: '3.0', label: '≤ 3.0x (Standard)' },
            ]}
          />

          {/* Sort Field */}
          <Select
            label="Sort Field"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: 'illustrative_screening_score', label: 'Composite Score' },
              { value: 'revenue_latest', label: 'Latest Revenue' },
              { value: 'ebitda_latest', label: 'Latest EBITDA' },
              { value: 'ebitda_margin', label: 'EBITDA Margin' },
              { value: 'revenue_cagr', label: 'Revenue CAGR' },
              { value: 'ev_ebitda', label: 'EV / EBITDA' },
            ]}
          />
        </div>

        {/* Row 2: Secondary Options & Toggles */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '8px',
            borderTop: '1px solid var(--line)',
            fontSize: '12px',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-strong)' }}>
            <input
              type="checkbox"
              checked={industrialOnly}
              onChange={(e) => setIndustrialOnly(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Exclude Financial Sector (Industrial / Commercial Corporates Only)</span>
          </label>

          <button
            onClick={() => setSortAscending((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            <ArrowUpDown size={13} />
            <span>Order: {sortAscending ? 'Ascending (Lowest First)' : 'Descending (Highest First)'}</span>
          </button>
        </div>
      </div>

      {/* 3. Status & Diagnostics Strip */}
      {data && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            padding: '8px 12px',
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-xs)',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>
              Total Universe: <strong style={{ color: 'var(--text-primary)' }}>{data.total_universe_count}</strong>
            </span>
            <span>·</span>
            <span>
              Qualified Candidates:{' '}
              <strong style={{ color: 'var(--positive)' }}>{data.passed_count}</strong>
            </span>
            {searchQuery && (
              <>
                <span>·</span>
                <span>
                  Search Matches:{' '}
                  <strong style={{ color: 'var(--focus)' }}>{filteredItems.length}</strong>
                </span>
              </>
            )}
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-label)' }}>
            Click any row to open Company Intelligence
          </div>
        </div>
      )}

      {/* 4. Visual Analytics Section */}
      {!isLoading && !error && filteredItems.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
            gap: '16px',
            marginBottom: '20px',
            alignItems: 'start',
          }}
        >
          {/* Primary Scatter: Growth vs Margin */}
          <ChartContainer
            title="Screened Landscape — Growth vs Profitability"
            subtitle="Filtered universe candidates plotted by Revenue CAGR and EBITDA Margin"
            badge={<DataQualityBadge label={`${scatterPoints.length} Candidates`} tone="info" />}
            minHeight="340px"
            legend={[
              { label: 'Screened Candidate', color: 'var(--accent)', type: 'square' },
              { label: 'Selected Target', color: 'var(--warning)', type: 'circle' },
              { label: 'Median Baseline', color: 'var(--line-strong)', type: 'dashed' },
            ]}
          >
            <ScatterPlot
              points={scatterPoints}
              xLabel="Revenue CAGR (%)"
              yLabel="EBITDA Margin (%)"
              xFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              yFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              selectedId={selectedCompanyId || undefined}
              onSelectPoint={(p) => {
                setSelectedCompanyId(p.id);
              }}
              showQuadrantLines={true}
              height={270}
            />
          </ChartContainer>

          {/* Right Column: Score & Multiple Distributions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ChartContainer
              title="Screening Score Distribution"
              subtitle="Composite score frequency across filtered candidates"
              minHeight="160px"
            >
              <DistributionBarChart
                bins={scoreDistribution.bins}
                p25={scoreDistribution.p25}
                median={scoreDistribution.median}
                p75={scoreDistribution.p75}
                height={120}
              />
            </ChartContainer>

            <ChartContainer
              title="Valuation Multiple Distribution (EV/EBITDA)"
              subtitle="Reported multiple density across filtered universe"
              minHeight="160px"
            >
              <DistributionBarChart
                bins={multipleDistribution.bins}
                p25={multipleDistribution.p25}
                median={multipleDistribution.median}
                p75={multipleDistribution.p75}
                height={120}
              />
            </ChartContainer>
          </div>
        </div>
      )}

      {/* 5. Main Data Table */}
      {isLoading ? (
        <LoadingState message="Executing multi-factor acquisition screener..." />
      ) : error ? (
        <ErrorState
          title="SCREENING ERROR"
          error={error}
          onRetry={fetchScreening}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredItems}
          keyExtractor={(row) => row.company_id}
          selectedRowKey={selectedCompanyId || undefined}
          onRowClick={(row) => {
            setSelectedCompanyId(row.company_id);
            navigate(`/research/companies?company=${encodeURIComponent(row.company_id)}`);
          }}
          maxHeight="calc(100vh - 360px)"
          emptyMessage="No acquisition targets match the specified screening filters."
        />
      )}
    </PageContainer>
  );
};
