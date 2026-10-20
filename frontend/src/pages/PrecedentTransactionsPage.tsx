import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MetricStrip, MetricItemDef } from '@/components/workstation/MetricStrip';
import { DataTable, Column } from '@/components/ui/DataTable';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/services/api/client';
import type { PrecedentsResponse, TransactionRecord, CompanySummary } from '@/types/api';
import {
  formatCurrencyCr,
  formatMultiple,
} from '@/utils/formatters';
import {
  ChartContainer,
  TimelineChart,
  TimelineDealItem,
  DistributionBarChart,
} from '@/components/charts';
import { DataQualityBadge } from '@/components/workstation/DataQualityBadge';
import {
  History,
  TrendingUp,
  AlertTriangle,
  Scale,
} from 'lucide-react';

export const PrecedentTransactionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedTargetId = searchParams.get('company') || 'TCS';

  const [companyList, setCompanyList] = useState<CompanySummary[]>([]);
  const [precedentsData, setPrecedentsData] = useState<PrecedentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');

  useEffect(() => {
    let mounted = true;
    apiClient.companies.list({ limit: 120 }).then((res) => {
      if (mounted) setCompanyList(res.items || []);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadPrecedents() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient.companies.getPrecedents(selectedTargetId);
        if (mounted) {
          setPrecedentsData(res);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : `Failed to load precedent transactions for '${selectedTargetId}'`,
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadPrecedents();
    return () => {
      mounted = false;
    };
  }, [selectedTargetId]);

  const handleSelectTarget = (id: string) => {
    setSearchParams({ company: id });
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!precedentsData?.transactions) return [];
    if (sectorFilter === 'ALL') return precedentsData.transactions;

    return precedentsData.transactions.filter((t) => t.sector === sectorFilter);
  }, [precedentsData, sectorFilter]);

  // Unique sector options
  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    precedentsData?.transactions.forEach((t) => {
      if (t.sector) set.add(t.sector);
    });
    return [
      { value: 'ALL', label: 'All Transaction Sectors' },
      ...Array.from(set).map((s) => ({ value: s, label: s })),
    ];
  }, [precedentsData]);

  // 1. Timeline Deal Items
  const timelineDeals: TimelineDealItem[] = useMemo(() => {
    return filteredTransactions.map((t) => ({
      id: t.transaction_id,
      date: t.announcement_date || '',
      target: t.target,
      acquirer: t.acquirer,
      dealValueCr: t.deal_value_cr,
      evRevenue: t.ev_revenue,
      sector: t.sector,
    }));
  }, [filteredTransactions]);

  // 2. Deal Consideration Size Distribution
  const dealSizeDistribution = useMemo(() => {
    const values = filteredTransactions
      .map((t) => t.deal_value_cr)
      .filter((v): v is number => v != null);
    if (values.length === 0) return { bins: [], p25: '—', median: '—', p75: '—' };
    const sorted = [...values].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];

    const bins = [
      { label: '< ₹5k Cr', min: 0, max: 5000, count: 0 },
      { label: '₹5k–10k Cr', min: 5000, max: 10000, count: 0 },
      { label: '₹10k–20k Cr', min: 10000, max: 20000, count: 0 },
      { label: '> ₹20k Cr', min: 20000, max: 200000, count: 0 },
    ];
    values.forEach((v) => {
      const b = bins.find((r) => v >= r.min && v < r.max) || bins[bins.length - 1];
      b.count++;
    });
    return {
      bins: bins.map((b) => ({ label: b.label, count: b.count })),
      p25: formatCurrencyCr(p25, 0),
      median: formatCurrencyCr(median, 0),
      p75: formatCurrencyCr(p75, 0),
    };
  }, [filteredTransactions]);

  // 3. EV / Revenue Distribution
  const evRevenueDistribution = useMemo(() => {
    const values = filteredTransactions
      .map((t) => t.ev_revenue)
      .filter((v): v is number => v != null);
    const stats = precedentsData?.statistics?.ev_revenue;
    const bins = [
      { label: '< 1.5x', min: 0, max: 1.5, count: 0 },
      { label: '1.5–2.0x', min: 1.5, max: 2.0, count: 0 },
      { label: '2.0–2.5x', min: 2.0, max: 2.5, count: 0 },
      { label: '> 2.5x', min: 2.5, max: 10.0, count: 0 },
    ];
    values.forEach((v) => {
      const b = bins.find((r) => v >= r.min && v < r.max) || bins[bins.length - 1];
      b.count++;
    });
    return {
      bins: bins.map((b) => ({ label: b.label, count: b.count })),
      p25: stats?.p25 != null ? `${stats.p25.toFixed(2)}x` : '—',
      median: stats?.median != null ? `${stats.median.toFixed(2)}x` : '—',
      p75: stats?.p75 != null ? `${stats.p75.toFixed(2)}x` : '—',
    };
  }, [filteredTransactions, precedentsData]);

  // Headline Metric Strip
  const headlineMetrics: MetricItemDef[] = useMemo(() => {
    if (!precedentsData) return [];

    const evRevStats = precedentsData.statistics?.ev_revenue;

    return [
      {
        label: 'PRECEDENT SAMPLE SIZE',
        value: `${precedentsData.transaction_count} Transactions`,
        helper: 'Small Sample Restriction Active (n < 5)',
        tone: 'warning',
      },
      {
        label: 'TARGET BENCHMARKED',
        value: precedentsData.target_id,
        helper: `Sector: ${precedentsData.target_sector || 'General'}`,
        tone: 'accent',
      },
      {
        label: 'MEDIAN EV / REVENUE',
        value: formatMultiple(evRevStats?.median),
        helper: `P25: ${formatMultiple(evRevStats?.p25)} · P75: ${formatMultiple(evRevStats?.p75)}`,
      },
      {
        label: 'EV / EBITDA MULTIPLE',
        value: 'N/A',
        helper: 'Target EBITDA Undisclosed in Filings',
        tone: 'negative',
      },
      {
        label: 'IMPLIED EQUITY (MEDIAN EV/REV)',
        value: formatCurrencyCr(
          precedentsData.implied_valuation?.ev_revenue?.implied_equity_value,
        ),
        helper: 'Derived at 100% Equity Basis',
        tone: 'positive',
      },
    ];
  }, [precedentsData]);

  // Precedents Table Columns
  const columns: Column<TransactionRecord>[] = [
    {
      key: 'transaction_id',
      header: 'ID',
      width: '64px',
      render: (row) => (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {row.transaction_id}
        </span>
      ),
    },
    {
      key: 'announcement_date',
      header: 'DATE',
      width: '95px',
      render: (row) => (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {row.announcement_date || '—'}
        </span>
      ),
    },
    {
      key: 'target',
      header: 'TARGET BUSINESS',
      width: '18%',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.target}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {row.sector} {row.industry ? `· ${row.industry}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'acquirer',
      header: 'ACQUIRING ENTITY',
      width: '18%',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-strong)' }}>{row.acquirer}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-label)' }}>
            {row.transaction_type || 'Acquisition'}
          </div>
        </div>
      ),
    },
    {
      key: 'deal_value_cr',
      header: 'CONSIDERATION',
      align: 'right',
      width: '12%',
      render: (row) => formatCurrencyCr(row.deal_value_cr, 1),
    },
    {
      key: 'stake_acquired_pct',
      header: 'STAKE',
      align: 'right',
      width: '8%',
      render: (row) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {row.stake_acquired_pct != null ? `${row.stake_acquired_pct}%` : '100%'}
        </span>
      ),
    },
    {
      key: 'target_revenue_cr',
      header: 'TARGET REV',
      align: 'right',
      width: '11%',
      render: (row) => formatCurrencyCr(row.target_revenue_cr, 1),
    },
    {
      key: 'target_ebitda_cr',
      header: 'TARGET EBITDA',
      align: 'right',
      width: '11%',
      render: () => (
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>
          Undisclosed
        </span>
      ),
    },
    {
      key: 'ev_revenue',
      header: 'EV/REV',
      align: 'right',
      width: '8%',
      render: (row) => (
        <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {formatMultiple(row.ev_revenue)}
        </strong>
      ),
    },
    {
      key: 'ev_ebitda',
      header: 'EV/EBITDA',
      align: 'right',
      width: '8%',
      render: () => (
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          N/A
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      {/* 1. Page Header */}
      <PageHeader
        title="Precedent Transactions"
        description="Historical M&A transaction multiples and benchmark pricing across the DealForge transaction universe."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(`/research/comps?company=${encodeURIComponent(selectedTargetId)}`)
              }
            >
              <Scale size={13} style={{ marginRight: '6px' }} />
              Trading Comps
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

      {/* 2. Target Context & Filter Bar */}
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
          <History size={16} style={{ color: 'var(--accent-line)' }} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
            BENCHMARK TARGET:
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

        {/* Sector Filter */}
        <div style={{ width: '220px' }}>
          <Select
            options={sectorOptions}
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
          />
        </div>
      </div>

      {/* 3. Prominent Institutional Data Limitation Banner */}
      <div
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 18px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warning)' }}>
              DATA LIMITATION & SMALL-SAMPLE DISCLOSURE
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-strong)', lineHeight: 1.5 }}>
              • Exactly <strong>4 historical seed transactions</strong> currently exist in the DealForge M&A database (sample threshold is n ≥ 5). Precedent statistics should be interpreted with institutional caution.
              <br />
              • <strong>Target EBITDA is undisclosed</strong> for all 4 seed transactions in public filings. Consequently, the <strong>EV / EBITDA precedent transaction band is unavailable</strong> (N/A) and is intentionally not displayed to avoid manufacturing false precision.
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Querying precedent transaction database..." />
      ) : error ? (
        <ErrorState
          title="PRECEDENTS DATABASE ERROR"
          error={error}
          onRetry={() => window.location.reload()}
        />
      ) : precedentsData ? (
        <>
          {/* 4. Headline Metrics Strip */}
          <div style={{ marginBottom: '20px' }}>
            <MetricStrip items={headlineMetrics} />
          </div>

          {/* 5. Visual Analytics Grid: Timeline & Deal Consideration Distribution */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 0.7fr)',
              gap: '20px',
              marginBottom: '20px',
              alignItems: 'start',
            }}
          >
            {/* Timeline */}
            <ChartContainer
              title="Precedent M&A Transaction Timeline"
              subtitle="Chronological transaction considerations across sourced filings"
              badge={<DataQualityBadge label="n = 4 (Small Sample)" tone="warning" />}
              minHeight="240px"
            >
              <TimelineChart deals={timelineDeals} height={180} />
            </ChartContainer>

            {/* Consideration Distribution */}
            <ChartContainer
              title="Transaction Size Distribution"
              subtitle="Consideration frequency across precedent transactions"
              minHeight="240px"
            >
              <DistributionBarChart
                bins={dealSizeDistribution.bins}
                p25={dealSizeDistribution.p25}
                median={dealSizeDistribution.median}
                p75={dealSizeDistribution.p75}
                height={160}
              />
            </ChartContainer>
          </div>

          {/* 6. Multiples Analytical Grid: EV/Revenue vs EV/EBITDA (Honest Unavailable State) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
              marginBottom: '24px',
              alignItems: 'start',
            }}
          >
            {/* EV / Revenue Distribution */}
            <ChartContainer
              title="Precedent EV / Revenue Multiple Distribution"
              subtitle="Transaction enterprise value to revenue multiples (Sourced Filings)"
              badge={<DataQualityBadge label="4 Reported" tone="positive" />}
              minHeight="200px"
            >
              <DistributionBarChart
                bins={evRevenueDistribution.bins}
                p25={evRevenueDistribution.p25}
                median={evRevenueDistribution.median}
                p75={evRevenueDistribution.p75}
                height={140}
              />
            </ChartContainer>

            {/* EV / EBITDA Precedent Band — INTENTIONALLY UNAVAILABLE */}
            <ChartContainer
              title="Precedent EV / EBITDA Multiple Band"
              subtitle="Transaction enterprise value to EBITDA multiples"
              isUnavailable={true}
              unavailableReason="EV / EBITDA unavailable — target EBITDA undisclosed in sourced filings."
              minHeight="200px"
            >
              <div />
            </ChartContainer>
          </div>

          {/* 7. Precedent Transactions Table */}
          <div style={{ marginBottom: '24px' }}>
            <SectionHeader
              title="Historical Precedent Transactions Database"
              description={`Displaying ${filteredTransactions.length} sourced Indian M&A transactions.`}
            />

            <DataTable
              columns={columns}
              data={filteredTransactions}
              keyExtractor={(row) => row.transaction_id}
              maxHeight="380px"
              emptyMessage="No precedent transactions found."
            />
          </div>

          {/* 6. Transaction Statistics & Implied Valuation Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
            }}
          >
            {/* Multiple Distributions */}
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
                Precedent Multiple Distributions
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-muted)', height: '28px' }}>
                    <th style={{ textAlign: 'left', fontWeight: 500 }}>DEAL MULTIPLE</th>
                    <th style={{ textAlign: 'right', fontWeight: 500 }}>25TH %ILE</th>
                    <th style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>MEDIAN</th>
                    <th style={{ textAlign: 'right', fontWeight: 500 }}>75TH %ILE</th>
                    <th style={{ textAlign: 'right', fontWeight: 500 }}>DEALS (N)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ height: '36px', borderBottom: '1px solid var(--line)', fontVariantNumeric: 'tabular-nums' }}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>EV / Revenue</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatMultiple(precedentsData.statistics?.ev_revenue?.p25)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--focus)' }}>
                      {formatMultiple(precedentsData.statistics?.ev_revenue?.median)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatMultiple(precedentsData.statistics?.ev_revenue?.p75)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-label)' }}>
                      {precedentsData.statistics?.ev_revenue?.n || 4}
                    </td>
                  </tr>

                  {/* EV/EBITDA Intentional Unavailable Row */}
                  <tr style={{ height: '36px', borderBottom: '1px solid var(--line)', fontVariantNumeric: 'tabular-nums' }}>
                    <td style={{ fontWeight: 500, color: 'var(--text-muted)' }}>EV / EBITDA</td>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>
                      DATA UNAVAILABLE — TARGET EBITDA UNDISCLOSED
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Implied Valuation from Precedents */}
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
                Implied Valuation from Precedents
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
                  <tr style={{ height: '36px', borderBottom: '1px solid var(--line)', fontVariantNumeric: 'tabular-nums' }}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      Precedents — EV / Revenue
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatMultiple(precedentsData.implied_valuation?.ev_revenue?.multiple_used)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-strong)' }}>
                      {formatCurrencyCr(precedentsData.implied_valuation?.ev_revenue?.implied_ev, 1)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--positive)' }}>
                      {formatCurrencyCr(
                        precedentsData.implied_valuation?.ev_revenue?.implied_equity_value,
                        1,
                      )}
                    </td>
                  </tr>

                  <tr style={{ height: '36px', borderBottom: '1px solid var(--line)', fontVariantNumeric: 'tabular-nums' }}>
                    <td style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                      Precedents — EV / EBITDA
                    </td>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>
                      N/A (DISCLOSED DATA LIMITATION)
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Applied to target latest revenue ({formatCurrencyCr(precedentsData.target_revenue_cr, 1)}).
              </div>
            </div>
          </div>
        </>
      ) : null}
    </PageContainer>
  );
};
