import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MetricStrip, MetricItemDef } from '@/components/workstation/MetricStrip';
import { DataQualityBadge } from '@/components/workstation/DataQualityBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/services/api/client';
import type { CompsResponse, CompanySummary, CompanyDetail } from '@/types/api';
import {
  formatCurrencyCr,
  formatMultiple,
  formatPercent,
} from '@/utils/formatters';
import {
  ChartContainer,
  ScatterPlot,
  ScatterPoint,
  PeerComparisonBar,
  MultipleComparisonItem,
  DistributionBarChart,
} from '@/components/charts';
import {
  Scale,
  Building2,
  TrendingUp,
  AlertTriangle,
  Info,
} from 'lucide-react';

export const ComparableCompaniesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedTargetId = searchParams.get('company') || 'TCS';

  const [companyList, setCompanyList] = useState<CompanySummary[]>([]);
  const [targetDetail, setTargetDetail] = useState<CompanyDetail | null>(null);
  const [compsData, setCompsData] = useState<CompsResponse | null>(null);
  const [peerDetails, setPeerDetails] = useState<CompanySummary[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load company list for target selector
  useEffect(() => {
    let mounted = true;
    apiClient.companies.list({ limit: 120 }).then((res) => {
      if (mounted) setCompanyList(res.items || []);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Load target details, comps response, and peer company summaries
  useEffect(() => {
    let mounted = true;

    async function loadComps() {
      setIsLoading(true);
      setError(null);
      try {
        const [targetRes, compsRes, universeRes] = await Promise.all([
          apiClient.companies.getById(selectedTargetId),
          apiClient.companies.getComps(selectedTargetId),
          apiClient.companies.list({ limit: 120 }),
        ]);

        if (mounted) {
          setTargetDetail(targetRes);
          setCompsData(compsRes);

          // Find peer summaries
          const peerSet = new Set(compsRes.peer_group || []);
          const peers = (universeRes.items || []).filter((c) => peerSet.has(c.company_id));
          setPeerDetails(peers);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : `Failed to compute trading comps for target '${selectedTargetId}'`,
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadComps();
    return () => {
      mounted = false;
    };
  }, [selectedTargetId]);

  const handleSelectTarget = (id: string) => {
    setSearchParams({ company: id });
  };

  // Headline Metric Strip
  const headlineMetrics: MetricItemDef[] = useMemo(() => {
    if (!compsData || !targetDetail) return [];

    const evEbitdaStats = compsData.peer_statistics?.multiples?.ev_ebitda;
    const peStats = compsData.peer_statistics?.multiples?.pe_ratio;

    return [
      {
        label: 'SELECTED TARGET',
        value: targetDetail.company_name,
        helper: `${targetDetail.sector} · ${targetDetail.industry || 'General'}`,
        tone: 'accent',
      },
      {
        label: 'PEER GROUP COUNT',
        value: `${compsData.peer_count} Peers`,
        helper: compsData.small_sample_warning
          ? 'Small Sample Alert (n < 5)'
          : 'Sufficient Sample Size (n ≥ 5)',
        tone: compsData.small_sample_warning ? 'warning' : 'positive',
      },
      {
        label: 'PEER MEDIAN EV/EBITDA',
        value: formatMultiple(evEbitdaStats?.median),
        helper: `P25: ${formatMultiple(evEbitdaStats?.p25)} · P75: ${formatMultiple(evEbitdaStats?.p75)}`,
      },
      {
        label: 'PEER MEDIAN P/E',
        value: formatMultiple(peStats?.median),
        helper: `P25: ${formatMultiple(peStats?.p25)} · P75: ${formatMultiple(peStats?.p75)}`,
      },
      {
        label: 'TARGET LATEST EV',
        value: formatCurrencyCr(targetDetail.ev),
        helper: `Current EV/EBITDA: ${formatMultiple(targetDetail.ev_ebitda)}`,
      },
    ];
  }, [compsData, targetDetail]);

  // 1. Peer Comparison Items (Target vs Peer Median)
  const comparisonItems: MultipleComparisonItem[] = useMemo(() => {
    if (!compsData?.peer_statistics?.multiples || !targetDetail) return [];
    const items: MultipleComparisonItem[] = [];
    const stats = compsData.peer_statistics.multiples;

    if (stats.ev_ebitda?.median != null && targetDetail.ev_ebitda != null) {
      items.push({
        metricName: 'EV / EBITDA',
        targetMultiple: targetDetail.ev_ebitda,
        peerMedian: stats.ev_ebitda.median,
        p25: stats.ev_ebitda.p25 || undefined,
        p75: stats.ev_ebitda.p75 || undefined,
      });
    }

    if (stats.ev_revenue?.median != null && targetDetail.ev_revenue != null) {
      items.push({
        metricName: 'EV / Revenue',
        targetMultiple: targetDetail.ev_revenue,
        peerMedian: stats.ev_revenue.median,
        p25: stats.ev_revenue.p25 || undefined,
        p75: stats.ev_revenue.p75 || undefined,
      });
    }

    if (stats.pe_ratio?.median != null && targetDetail.pe_ratio != null) {
      items.push({
        metricName: 'P / E Ratio',
        targetMultiple: targetDetail.pe_ratio,
        peerMedian: stats.pe_ratio.median,
        p25: stats.pe_ratio.p25 || undefined,
        p75: stats.pe_ratio.p75 || undefined,
      });
    }

    return items;
  }, [compsData, targetDetail]);

  // 2. Peer Positioning Scatter Points (EV/EBITDA vs Margin)
  const peerScatterPoints: ScatterPoint[] = useMemo(() => {
    const points: ScatterPoint[] = [];

    // Add target first
    if (targetDetail && targetDetail.ev_ebitda != null && targetDetail.ebitda_margin != null) {
      points.push({
        id: targetDetail.company_id,
        name: `${targetDetail.company_name} (Target)`,
        ticker: targetDetail.ticker || undefined,
        x: targetDetail.ev_ebitda,
        y: targetDetail.ebitda_margin,
        category: 'Target',
        metadata: {
          'Position': 'VALUATION TARGET',
          'EV / EBITDA': formatMultiple(targetDetail.ev_ebitda),
          'EBITDA Margin': formatPercent(targetDetail.ebitda_margin),
          'Revenue': formatCurrencyCr(targetDetail.revenue_latest, 1),
        },
      });
    }

    // Add peers
    peerDetails.forEach((p) => {
      if (p.ev_ebitda != null && p.ebitda_margin != null) {
        points.push({
          id: p.company_id,
          name: p.company_name,
          ticker: p.ticker || undefined,
          x: p.ev_ebitda,
          y: p.ebitda_margin,
          category: 'Peer',
          metadata: {
            'Position': 'Comparable Peer',
            'EV / EBITDA': formatMultiple(p.ev_ebitda),
            'EBITDA Margin': formatPercent(p.ebitda_margin),
            'Enterprise Value': formatCurrencyCr(p.ev, 1),
          },
        });
      }
    });

    return points;
  }, [targetDetail, peerDetails]);

  // 3. EV/EBITDA Distribution
  const compsEvEbitdaDistribution = useMemo(() => {
    const evEbitdaStats = compsData?.peer_statistics?.multiples?.ev_ebitda;
    const multiples = peerDetails
      .map((p) => p.ev_ebitda)
      .filter((m): m is number => m != null && m > 0 && m < 150);
    if (targetDetail?.ev_ebitda) multiples.push(targetDetail.ev_ebitda);

    const bins = [
      { label: '< 15x', min: 0, max: 15, count: 0 },
      { label: '15–20x', min: 15, max: 20, count: 0 },
      { label: '20–25x', min: 20, max: 25, count: 0 },
      { label: '25–30x', min: 25, max: 30, count: 0 },
      { label: '> 30x', min: 30, max: 150, count: 0 },
    ];
    multiples.forEach((m) => {
      const b = bins.find((r) => m >= r.min && m < r.max) || bins[bins.length - 1];
      b.count++;
    });

    return {
      bins: bins.map((b) => ({ label: b.label, count: b.count })),
      p25: evEbitdaStats?.p25 != null ? `${evEbitdaStats.p25.toFixed(1)}x` : '—',
      median: evEbitdaStats?.median != null ? `${evEbitdaStats.median.toFixed(1)}x` : '—',
      p75: evEbitdaStats?.p75 != null ? `${evEbitdaStats.p75.toFixed(1)}x` : '—',
    };
  }, [compsData, peerDetails, targetDetail]);

  // Peer Table Columns
  const peerColumns: Column<CompanySummary>[] = [
    {
      key: 'company_name',
      header: 'PEER COMPANY',
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
      key: 'industry',
      header: 'INDUSTRY',
      width: '14%',
      render: (row) => row.industry || row.sector || '—',
    },
    {
      key: 'market_cap_latest',
      header: 'MARKET CAP',
      align: 'right',
      width: '13%',
      render: (row) => formatCurrencyCr(row.market_cap_latest, 1),
    },
    {
      key: 'ev',
      header: 'ENTERPRISE VALUE',
      align: 'right',
      width: '14%',
      render: (row) => formatCurrencyCr(row.ev, 1),
    },
    {
      key: 'revenue_latest',
      header: 'REVENUE',
      align: 'right',
      width: '11%',
      render: (row) => formatCurrencyCr(row.revenue_latest, 1),
    },
    {
      key: 'ebitda_latest',
      header: 'EBITDA',
      align: 'right',
      width: '10%',
      render: (row) => formatCurrencyCr(row.ebitda_latest, 1),
    },
    {
      key: 'ev_revenue',
      header: 'EV/REV',
      align: 'right',
      width: '8%',
      render: (row) => formatMultiple(row.ev_revenue),
    },
    {
      key: 'ev_ebitda',
      header: 'EV/EBITDA',
      align: 'right',
      width: '8%',
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
      {/* 1. Header */}
      <PageHeader
        title="Comparable Companies"
        description="Peer valuation benchmarks, multiple distributions, and derived implied target valuation."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(`/research/companies?company=${encodeURIComponent(selectedTargetId)}`)
              }
            >
              <Building2 size={13} style={{ marginRight: '6px' }} />
              Target Details
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                navigate(`/research/valuation?company=${encodeURIComponent(selectedTargetId)}`)
              }
            >
              <TrendingUp size={13} style={{ marginRight: '6px' }} />
              Valuation Summary
            </Button>
          </div>
        }
      />

      {/* 2. Top Target Selector Bar */}
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
          <Scale size={16} style={{ color: 'var(--accent-line)' }} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
            VALUATION TARGET:
          </span>
          <div style={{ width: '280px' }}>
            <Select
              options={companyList.map((c) => ({
                value: c.company_id,
                label: `${c.company_name} (${c.company_id})`,
              }))}
              value={selectedTargetId}
              onChange={(e) => handleSelectTarget(e.target.value)}
            />
          </div>
        </div>

        {compsData && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <DataQualityBadge
              label={`${compsData.peer_count} Peer Companies Matched`}
              tone={compsData.small_sample_warning ? 'warning' : 'positive'}
            />
            {compsData.small_sample_warning && (
              <DataQualityBadge label="Small Sample (n < 5)" tone="warning" />
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingState message={`Benchmarking peer trading multiples for ${selectedTargetId}...`} />
      ) : error ? (
        <ErrorState
          title="COMPS ANALYSIS UNAVAILABLE"
          error={error}
          onRetry={() => window.location.reload()}
        />
      ) : compsData && targetDetail ? (
        <>
          {/* 3. Headline Metric Strip */}
          <div style={{ marginBottom: '20px' }}>
            <MetricStrip items={headlineMetrics} />
          </div>

          {/* 4. Diagnostics & Warnings (if any) */}
          {compsData.warnings && compsData.warnings.length > 0 && (
            <div
              style={{
                background: 'var(--warning-bg)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '12px',
                color: 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <div>{compsData.warnings.join(' · ')}</div>
            </div>
          )}

          {/* 5. Visual Analytics Grid: Peer Positioning Scatter (60%) + Target vs Median & Multiple Distribution (40%) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.75fr)',
              gap: '20px',
              marginBottom: '24px',
              alignItems: 'start',
            }}
          >
            {/* Left Primary Chart: Peer Positioning Scatter */}
            <ChartContainer
              title="Peer Positioning — Valuation Multiple vs Margin"
              subtitle="Target company vs sector peers plotted on EV/EBITDA multiple vs EBITDA Margin"
              badge={<DataQualityBadge label={`${peerScatterPoints.length} Mapped Entities`} tone="info" />}
              minHeight="380px"
              legend={[
                { label: 'Comparable Peer', color: 'var(--accent)', type: 'square' },
                { label: `${targetDetail.company_name} (Target)`, color: 'var(--warning)', type: 'circle' },
                { label: 'Median Baseline', color: 'var(--line-strong)', type: 'dashed' },
              ]}
            >
              <ScatterPlot
                points={peerScatterPoints}
                xLabel="EV / EBITDA Multiple"
                yLabel="EBITDA Margin (%)"
                xFormatter={(v: number) => `${v.toFixed(1)}x`}
                yFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                highlightId={targetDetail.company_id}
                selectedId={selectedPeerId || undefined}
                onSelectPoint={(p) => {
                  setSelectedPeerId(p.id);
                }}
                showQuadrantLines={true}
                height={310}
              />
            </ChartContainer>

            {/* Right Column: Target vs Median comparison and multiple distribution */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ChartContainer
                title="Target Multiple vs Peer Median"
                subtitle="Valuation premium / discount compared to peer median"
                minHeight="180px"
              >
                <PeerComparisonBar items={comparisonItems} />
              </ChartContainer>

              <ChartContainer
                title="Peer Group EV / EBITDA Distribution"
                subtitle="Distribution across qualified industry peers"
                minHeight="170px"
              >
                <DistributionBarChart
                  bins={compsEvEbitdaDistribution.bins}
                  p25={compsEvEbitdaDistribution.p25}
                  median={compsEvEbitdaDistribution.median}
                  p75={compsEvEbitdaDistribution.p75}
                  height={120}
                />
              </ChartContainer>
            </div>
          </div>

          {/* 6. Main Peer Universe Data Table */}
          <div style={{ marginBottom: '24px' }}>
            <SectionHeader
              title="Peer Group Trading Multiples"
              description={`Trading valuation benchmarks for ${compsData.peer_count} companies in ${targetDetail.sector} (${targetDetail.industry || 'All Industries'}). Click row to highlight on scatter.`}
            />

            <DataTable
              columns={peerColumns}
              data={peerDetails}
              keyExtractor={(row) => row.company_id}
              selectedRowKey={selectedPeerId || undefined}
              onRowClick={(row) => setSelectedPeerId(row.company_id)}
              maxHeight="420px"
              emptyMessage="No matching peers found for this target's sector."
            />
          </div>

          {/* 6. Multiples Distribution & Implied Valuation Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
              marginBottom: '24px',
            }}
          >
            {/* Multiple Distribution Table */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                Peer Multiple Percentile Distributions
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-muted)', height: '28px' }}>
                    <th style={{ textAlign: 'left', fontWeight: 500 }}>MULTIPLE</th>
                    <th style={{ textAlign: 'right', fontWeight: 500 }}>25TH %ILE</th>
                    <th style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>MEDIAN</th>
                    <th style={{ textAlign: 'right', fontWeight: 500 }}>75TH %ILE</th>
                    <th style={{ textAlign: 'right', fontWeight: 500 }}>SAMPLE (N)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(compsData.peer_statistics?.multiples || {}).map(([key, stat]) => (
                    <tr
                      key={key}
                      style={{
                        height: '34px',
                        borderBottom: '1px solid var(--line)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {key === 'ev_revenue'
                          ? 'EV / Revenue'
                          : key === 'ev_ebitda'
                          ? 'EV / EBITDA'
                          : key === 'pe_ratio'
                          ? 'P / E Ratio'
                          : key}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {formatMultiple(stat.p25)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--focus)' }}>
                        {formatMultiple(stat.median)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {formatMultiple(stat.p75)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-label)' }}>
                        {stat.n}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Implied Valuation Table */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                Derived Implied Target Valuation (Median Multiple)
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-muted)', height: '28px' }}>
                    <th style={{ textAlign: 'left', fontWeight: 500 }}>METHODOLOGY</th>
                    <th style={{ textAlign: 'right', fontWeight: 500 }}>APPLIED MULTIPLE</th>
                    <th style={{ textAlign: 'right', fontWeight: 500 }}>IMPLIED EV</th>
                    <th style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                      IMPLIED EQUITY
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(compsData.implied_valuation || {}).map(([key, item]) => (
                    <tr
                      key={key}
                      style={{
                        height: '34px',
                        borderBottom: '1px solid var(--line)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {key === 'ev_revenue'
                          ? 'Comps — EV / Revenue'
                          : key === 'ev_ebitda'
                          ? 'Comps — EV / EBITDA'
                          : key === 'pe_ratio'
                          ? 'Comps — P / E'
                          : key}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {formatMultiple(item.multiple_used)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-strong)' }}>
                        {formatCurrencyCr(item.implied_ev, 1)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--positive)' }}>
                        {formatCurrencyCr(item.implied_equity_value, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Implied Equity Value = Implied EV − Target Net Debt (Borrowings − Cash).
              </div>
            </div>
          </div>

          {/* 7. Peer Selection Methodology Panel */}
          <div
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Info size={14} style={{ color: 'var(--focus)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Peer Selection Methodology & Governance Notes
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.5, margin: 0 }}>
              Peers are dynamically derived from the audited 113-company universe matching target sector (
              <strong>{targetDetail.sector}</strong>) and industry (
              <strong>{targetDetail.industry || 'All'}</strong>). The target itself is excluded from peer
              summary statistics. Valuation ranges reflect standard investment banking 25th percentile,
              median (50th percentile), and 75th percentile cuts. Where sample size is below 5, small-sample
              disclosures are automatically surfaced for institutional compliance.
            </p>
          </div>
        </>
      ) : null}
    </PageContainer>
  );
};
