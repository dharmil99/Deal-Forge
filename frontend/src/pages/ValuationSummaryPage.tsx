import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { MetricStrip, MetricItemDef } from '@/components/workstation/MetricStrip';
import { DataQualityBadge } from '@/components/workstation/DataQualityBadge';
import { FootballFieldChart } from '@/components/workstation/FootballFieldChart';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/services/api/client';
import type { ValuationSummaryResponse, CompanySummary } from '@/types/api';
import {
  formatCurrencyCr,
  formatPercent,
  formatMultiple,
  formatPriceINR,
} from '@/utils/formatters';
import {
  ChartContainer,
  MethodologyComparisonBar,
  SensitivityHeatmap,
} from '@/components/charts';
import {
  TrendingUp,
  Building2,
  Scale,
  History,
  AlertTriangle,
  Info,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { useDealContext } from '@/context/DealContext';

export const ValuationSummaryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeDeal } = useDealContext();

  const selectedTargetId = searchParams.get('company') || activeDeal?.targetId || 'Infosys';

  const [companyList, setCompanyList] = useState<CompanySummary[]>([]);
  const [valuationData, setValuationData] = useState<ValuationSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

    async function loadValuation() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient.companies.getValuation(selectedTargetId);
        if (mounted) {
          setValuationData(res);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : `Failed to load valuation summary for '${selectedTargetId}'`,
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadValuation();
    return () => {
      mounted = false;
    };
  }, [selectedTargetId]);

  const handleSelectTarget = (id: string) => {
    setSearchParams({ company: id });
  };

  // Headline Metric Strip
  const headlineMetrics: MetricItemDef[] = useMemo(() => {
    if (!valuationData) return [];

    const target = valuationData.target;
    const dcf = valuationData.dcf;
    const compsTable = valuationData.valuation_table.find((r) => r.methodology.includes('EV/EBITDA'));

    return [
      {
        label: 'TARGET COMPANY',
        value: target.company_id,
        helper: `${target.sector} · ${target.industry || 'General'}`,
        tone: 'accent',
      },
      {
        label: 'CURRENT MARKET CAP',
        value: formatCurrencyCr(target.market_cap_latest),
        helper: target.current_price ? `Price: ${formatPriceINR(target.current_price)}` : undefined,
        tone: 'warning',
      },
      {
        label: 'COMPS IMPLIED (EV/EBITDA)',
        value: formatCurrencyCr(compsTable?.mid),
        helper: compsTable?.mid_multiple ? `Median Multiple: ${formatMultiple(compsTable.mid_multiple)}` : undefined,
        tone: 'positive',
      },
      {
        label: 'DCF INTRINSIC VALUE',
        value: formatCurrencyCr(dcf?.implied_equity_value),
        helper: dcf ? `WACC: ${formatPercent(dcf.wacc)} · g: ${formatPercent(dcf.terminal_growth)}` : 'DCF Unavailable',
        tone: 'positive',
      },
      {
        label: 'DATA QUALITY STATUS',
        value: valuationData.warnings.length > 0 ? `${valuationData.warnings.length} Diagnostics` : 'Clean Audit',
        helper: 'Unblended Multi-Methodology',
        tone: valuationData.warnings.length > 0 ? 'warning' : 'positive',
      },
    ];
  }, [valuationData]);

  // DCF Sensitivity Matrix (WACC vs Terminal Growth Rate)
  const dcfSensitivityMatrix = useMemo(() => {
    if (!valuationData?.dcf || !valuationData.target) return null;
    const dcf = valuationData.dcf;
    const netDebt = valuationData.target.net_debt_latest || 0;
    const baseWacc = dcf.wacc;
    const baseG = dcf.terminal_growth;

    const waccSteps = [baseWacc - 0.02, baseWacc - 0.01, baseWacc, baseWacc + 0.01, baseWacc + 0.02];
    const gSteps = [baseG - 0.01, baseG - 0.005, baseG, baseG + 0.005, baseG + 0.01];

    const baseFinalFcff =
      (dcf.pv_terminal_value * Math.pow(1 + baseWacc, 5) * (baseWacc - baseG)) / (1 + baseG);

    const matrix: (number | null)[][] = [];

    waccSteps.forEach((w) => {
      const row: (number | null)[] = [];
      gSteps.forEach((g) => {
        if (w <= g) {
          row.push(null);
        } else {
          const tv = (baseFinalFcff * (1 + g)) / (w - g);
          const pvTv = tv / Math.pow(1 + w, 5);
          const ev = dcf.pv_explicit_fcff + pvTv;
          const eqVal = ev - netDebt;
          row.push(eqVal);
        }
      });
      matrix.push(row);
    });

    return {
      rowValues: waccSteps,
      colValues: gSteps,
      rowLabels: waccSteps.map((w) => formatPercent(w, 1)),
      colLabels: gSteps.map((g) => formatPercent(g, 1)),
      matrix,
      baseRowIdx: 2,
      baseColIdx: 2,
    };
  }, [valuationData]);

  return (
    <PageContainer>
      {/* 1. Page Header */}
      <PageHeader
        title="Valuation Summary"
        description="Consolidated multi-methodology valuation synthesizing Trading Comps, Precedent Transactions, and DCF."
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
              Inspect Comps
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(`/research/precedents?company=${encodeURIComponent(selectedTargetId)}`)
              }
            >
              <History size={13} style={{ marginRight: '6px' }} />
              Inspect Precedents
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                navigate(`/research/companies?company=${encodeURIComponent(selectedTargetId)}`)
              }
            >
              <Building2 size={13} style={{ marginRight: '6px' }} />
              Company Intelligence
            </Button>
          </div>
        }
      />

      {/* 2. Target Selector Bar */}
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
          <TrendingUp size={16} style={{ color: 'var(--accent-line)' }} />
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

        {valuationData && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <DataQualityBadge
              label={`${valuationData.comps?.peer_count || 0} Comps Peers`}
              tone={valuationData.data_quality?.comps_small_sample ? 'warning' : 'positive'}
            />
            <DataQualityBadge
              label={`${valuationData.precedents?.transaction_count || 0} Precedent Deals`}
              tone="warning"
            />
            <DataQualityBadge
              label={valuationData.dcf ? 'DCF Model Active' : 'DCF Unavailable'}
              tone={valuationData.dcf ? 'positive' : 'warning'}
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingState message={`Synthesizing multi-methodology valuation for ${selectedTargetId}...`} />
      ) : error ? (
        <ErrorState
          title="VALUATION SUMMARY ERROR"
          error={error}
          onRetry={() => window.location.reload()}
        />
      ) : valuationData ? (
        <>
          {/* 3. Headline Metrics Strip */}
          <div style={{ marginBottom: '20px' }}>
            <MetricStrip items={headlineMetrics} />
          </div>

          {/* 4. Valuation Football Field Chart */}
          <div style={{ marginBottom: '24px' }}>
            <SectionHeader
              title="Valuation Football Field (Implied Equity Value Ranges)"
              description="Comparative implied equity value across unblended Trading Comps, Precedents, and DCF."
            />
            <FootballFieldChart
              rows={valuationData.valuation_table}
              currentMarketCap={valuationData.target.market_cap_latest}
              targetName={valuationData.target.company_id}
            />
          </div>

          {/* 5. Supporting Visual Analytics Grid: Methodology Benchmark vs Market Cap & DCF Sensitivity Heatmap */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: '20px',
              marginBottom: '24px',
              alignItems: 'start',
            }}
          >
            {/* Methodology Implied Valuation Comparison */}
            <ChartContainer
              title="Methodology Midpoint vs Current Market Cap"
              subtitle="Implied equity value derived across each analytical methodology compared to target trading market cap"
              badge={<DataQualityBadge label="Unblended Outputs" tone="info" />}
              minHeight="280px"
            >
              <MethodologyComparisonBar
                rows={valuationData.valuation_table}
                currentMarketCap={valuationData.target.market_cap_latest}
              />
            </ChartContainer>

            {/* DCF Sensitivity Heatmap */}
            <ChartContainer
              title="DCF Sensitivity Matrix — WACC vs Terminal Growth"
              subtitle="Implied equity value (₹ Cr) matrix across discount rates and perpetual Gordon growth rates"
              badge={<DataQualityBadge label="Base Case Highlighted" tone="positive" />}
              minHeight="280px"
              isUnavailable={!dcfSensitivityMatrix}
              unavailableReason="DCF sensitivity matrix unavailable — DCF model produced warnings or is unavailable."
            >
              {dcfSensitivityMatrix && (
                <SensitivityHeatmap
                  rowValues={dcfSensitivityMatrix.rowValues}
                  colValues={dcfSensitivityMatrix.colValues}
                  rowLabels={dcfSensitivityMatrix.rowLabels}
                  colLabels={dcfSensitivityMatrix.colLabels}
                  matrix={dcfSensitivityMatrix.matrix}
                  rowAxisTitle="WACC DISCOUNT RATE"
                  colAxisTitle="TERMINAL GROWTH (g)"
                  baseRowIdx={dcfSensitivityMatrix.baseRowIdx}
                  baseColIdx={dcfSensitivityMatrix.baseColIdx}
                />
              )}
            </ChartContainer>
          </div>

          {/* 6. Methodology Comparison Table */}
          <div style={{ marginBottom: '24px' }}>
            <SectionHeader
              title="Methodology Summary & Implied Valuation Range"
              description="Detailed Low (P25), Mid (Median/Base), and High (P75) valuation outputs with status audit."
            />

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr
                    style={{
                      background: 'var(--bg-surface-2)',
                      borderBottom: '1px solid var(--line)',
                      color: 'var(--text-muted)',
                      height: '32px',
                    }}
                  >
                    <th style={{ textAlign: 'left', padding: '6px 14px', fontWeight: 500 }}>METHODOLOGY</th>
                    <th style={{ textAlign: 'right', padding: '6px 14px', fontWeight: 500 }}>LOW MULTIPLE</th>
                    <th style={{ textAlign: 'right', padding: '6px 14px', fontWeight: 500 }}>MID MULTIPLE</th>
                    <th style={{ textAlign: 'right', padding: '6px 14px', fontWeight: 500 }}>HIGH MULTIPLE</th>
                    <th style={{ textAlign: 'right', padding: '6px 14px', fontWeight: 500 }}>LOW (₹ CR)</th>
                    <th style={{ textAlign: 'right', padding: '6px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      MID / BASE (₹ CR)
                    </th>
                    <th style={{ textAlign: 'right', padding: '6px 14px', fontWeight: 500 }}>HIGH (₹ CR)</th>
                    <th style={{ textAlign: 'center', padding: '6px 14px', fontWeight: 500 }}>DATA STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {valuationData.valuation_table.map((row, idx) => {
                    const isAvailable = row.available;
                    return (
                      <tr
                        key={idx}
                        style={{
                          height: '38px',
                          borderBottom: '1px solid var(--line)',
                          fontVariantNumeric: 'tabular-nums',
                          background: !isAvailable ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '6px 14px', fontWeight: 600, color: isAvailable ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {row.methodology}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 14px', color: 'var(--text-muted)' }}>
                          {row.low_multiple != null ? formatMultiple(row.low_multiple) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 14px', color: 'var(--text-strong)' }}>
                          {row.mid_multiple != null ? formatMultiple(row.mid_multiple) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 14px', color: 'var(--text-muted)' }}>
                          {row.high_multiple != null ? formatMultiple(row.high_multiple) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 14px', color: 'var(--text-muted)' }}>
                          {isAvailable ? formatCurrencyCr(row.low, 1, false) : 'N/A'}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            padding: '6px 14px',
                            fontWeight: 600,
                            color: isAvailable ? 'var(--positive)' : 'var(--text-muted)',
                          }}
                        >
                          {isAvailable ? formatCurrencyCr(row.mid, 1, false) : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '6px 14px', color: 'var(--text-muted)' }}>
                          {isAvailable ? formatCurrencyCr(row.high, 1, false) : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 14px' }}>
                          {isAvailable ? (
                            <span
                              style={{
                                fontSize: '11px',
                                background: 'rgba(34, 197, 94, 0.12)',
                                color: 'var(--positive)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-xs)',
                                fontWeight: 500,
                              }}
                            >
                              Available
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '11px',
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: 'var(--negative)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-xs)',
                                fontWeight: 500,
                              }}
                              title="Target EBITDA undisclosed in precedent transaction database"
                            >
                              Undisclosed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Valuation Diagnostics & Data Quality Audit */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
            }}
          >
            {/* Engine Warnings */}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ShieldAlert size={14} style={{ color: 'var(--warning)' }} />
                <span>Valuation Diagnostics & Methodology Flags</span>
              </div>

              {valuationData.warnings && valuationData.warnings.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {valuationData.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--text-body)',
                        lineHeight: 1.4,
                        padding: '6px 8px',
                        background: 'var(--bg-surface-2)',
                        borderRadius: 'var(--radius-xs)',
                        borderLeft: '2px solid var(--warning)',
                      }}
                    >
                      <AlertTriangle size={13} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--positive)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} />
                  <span>All valuation methods passed data sanity checks without warnings.</span>
                </div>
              )}
            </div>

            {/* Quality Summary Flags */}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Info size={14} style={{ color: 'var(--focus)' }} />
                <span>Data Completeness Audit</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Comps Peer Universe:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {valuationData.data_quality.peer_count} Companies
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Comps Sample Reliability:</span>
                  <strong style={{ color: valuationData.data_quality.comps_small_sample ? 'var(--warning)' : 'var(--positive)' }}>
                    {valuationData.data_quality.comps_small_sample ? 'Small Sample (n < 5)' : 'Sufficient (n ≥ 5)'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Precedent Sample Size:</span>
                  <strong style={{ color: 'var(--warning)' }}>
                    {valuationData.data_quality.precedent_count} Transactions (Small Sample)
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Precedent EV/EBITDA Status:</span>
                  <strong style={{ color: valuationData.data_quality.precedent_ev_ebitda_available ? 'var(--positive)' : 'var(--negative)' }}>
                    {valuationData.data_quality.precedent_ev_ebitda_available ? 'Available' : 'Undisclosed (N/A)'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>DCF Model Viability:</span>
                  <strong style={{ color: valuationData.data_quality.dcf_available ? 'var(--positive)' : 'var(--negative)' }}>
                    {valuationData.data_quality.dcf_available ? 'Viable (FCFF Projected)' : 'Unavailable'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Share Count Freshness:</span>
                  <strong style={{ color: valuationData.data_quality.shares_outstanding_is_stale ? 'var(--warning)' : 'var(--positive)' }}>
                    {valuationData.data_quality.shares_outstanding_is_stale ? 'Stale (Fallback FY)' : 'Current Fiscal Year'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </PageContainer>
  );
};
