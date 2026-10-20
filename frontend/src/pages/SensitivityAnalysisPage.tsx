import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/services/api/client';
import { useDealContext } from '@/context/DealContext';
import { PageContainer } from '@/components/ui/PageContainer';
import { Drawer } from '@/components/ui/Drawer';
import {
  formatCurrencyCr,
  formatPriceINR,
  formatPercent,
  formatSignedPercent,
} from '@/utils/formatters';
import type {
  CompanyListItem,
  ScenarioAssumptions,
  Sensitivity1DResponse,
  Sensitivity2DResponse,
} from '@/types/api';
import {
  ChartContainer,
  ChartHeader,
  ChartLoadingState,
  ChartErrorState,
  ChartStatusBadge,
  ChartBaseCaseMarker,
  SensitivityHeatmap,
  SensitivityLineChart,
  type Sensitivity1DPoint,
} from '@/components/charts';
import { RefreshCw, Layers } from 'lucide-react';

const OUTPUT_METRICS = [
  { id: 'year_1_ad_pct', label: 'Year 1 Accretion / Dilution (%)', unit: '%' },
  { id: 'year_1_eps', label: 'Pro Forma EPS (₹/share)', unit: '₹' },
  { id: 'transaction_ev', label: 'Transaction Enterprise Value (₹ Cr)', unit: '₹ Cr' },
  { id: 'purchase_equity_value', label: 'Purchase Equity Value (₹ Cr)', unit: '₹ Cr' },
  { id: 'break_even_gross_synergy', label: 'Break-Even Gross Synergy (₹ Cr)', unit: '₹ Cr' },
  { id: 'is_feasible', label: 'Transaction Feasibility Status', unit: 'Status' },
];

const SENSITIVITY_VARIABLES = [
  { id: 'acquisition_premium', label: 'Acquisition Premium (%)', defaultVals: [0.10, 0.15, 0.20, 0.25, 0.30], isPct: true },
  { id: 'expected_annual_synergies', label: 'Annual Synergies (₹ Cr)', defaultVals: [0.0, 1000.0, 2000.0, 3000.0, 4000.0], isPct: false },
  { id: 'debt_interest_rate', label: 'Debt Interest Rate (%)', defaultVals: [0.06, 0.07, 0.08, 0.09, 0.10], isPct: true },
  { id: 'transaction_fees', label: 'Transaction Fees (₹ Cr)', defaultVals: [0.0, 250.0, 500.0, 750.0, 1000.0], isPct: false },
  { id: 'tax_rate', label: 'Corporate Tax Rate (%)', defaultVals: [0.20, 0.22, 0.25, 0.28, 0.30], isPct: true },
  { id: 'cash_pct', label: 'Cash Consideration Mix (%)', defaultVals: [0.02, 0.10, 0.20, 0.35, 0.50], isPct: true },
  { id: 'debt_pct', label: 'Debt Consideration Mix (%)', defaultVals: [0.40, 0.50, 0.60, 0.70, 0.80], isPct: true },
];

export const SensitivityAnalysisPage: React.FC = () => {
  const { activeDeal, setCounterparties } = useDealContext();

  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [buyerId, setBuyerId] = useState<string>(activeDeal?.buyerId || 'TCS');
  const [targetId, setTargetId] = useState<string>(activeDeal?.targetId || 'Infosys');

  // Mode: 1D vs 2D
  const [mode, setMode] = useState<'1D' | '2D'>('2D');

  // Selected variables & metrics
  const [selectedMetric, setSelectedMetric] = useState<string>('year_1_ad_pct');
  const [selectedXVar, setSelectedXVar] = useState<string>('acquisition_premium');
  const [selectedYVar, setSelectedYVar] = useState<string>('expected_annual_synergies');

  // Base assumptions
  const [baseAssumptions] = useState<ScenarioAssumptions>({
    acquisition_premium: 0.20,
    cash_pct: 0.02,
    debt_pct: 0.60,
    stock_pct: 0.38,
    transaction_fees: 500.0,
    debt_issuance_fee_pct: 0.02,
    minimum_cash_balance: 1000.0,
    refinance_target_debt: true,
    use_target_cash: true,
    debt_interest_rate: 0.08,
    foregone_cash_interest_rate: 0.05,
    tax_rate: 0.25,
    expected_annual_synergies: 2000.0,
  });

  // API Data
  const [data1D, setData1D] = useState<Sensitivity1DResponse | null>(null);
  const [data2D, setData2D] = useState<Sensitivity2DResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected cell detail state
  const [selectedDetail, setSelectedDetail] = useState<{
    xLabel: string;
    xVal: number;
    yLabel?: string;
    yVal?: number;
    output: number | boolean | null;
    isFeasible: boolean;
    diagnostics?: string[];
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Sync with DealContext
  useEffect(() => {
    if (activeDeal?.buyerId && activeDeal.buyerId !== buyerId) {
      setBuyerId(activeDeal.buyerId);
    }
    if (activeDeal?.targetId && activeDeal.targetId !== targetId) {
      setTargetId(activeDeal.targetId);
    }
  }, [activeDeal?.buyerId, activeDeal?.targetId]);

  // Load companies list
  useEffect(() => {
    let mounted = true;
    apiClient.companies.list({ limit: 200 })
      .then((res) => {
        if (mounted) setCompanies(res.items);
      })
      .catch((err) => console.error('Failed to load companies list', err));
    return () => {
      mounted = false;
    };
  }, []);

  const handleBuyerChange = (newBuyer: string) => {
    let nextTarget = targetId;
    if (newBuyer === targetId) {
      nextTarget = companies.find((c) => c.company_id !== newBuyer)?.company_id || (newBuyer === 'TCS' ? 'Infosys' : 'TCS');
      setTargetId(nextTarget);
    }
    setBuyerId(newBuyer);
    setCounterparties(newBuyer, nextTarget);
  };

  const handleTargetChange = (newTarget: string) => {
    let nextBuyer = buyerId;
    if (newTarget === buyerId) {
      nextBuyer = companies.find((c) => c.company_id !== newTarget)?.company_id || (newTarget === 'Infosys' ? 'TCS' : 'Infosys');
      setBuyerId(nextBuyer);
    }
    setTargetId(newTarget);
    setCounterparties(nextBuyer, newTarget);
  };

  // Fetch sensitivity analytics
  const fetchSensitivity = async () => {
    setLoading(true);
    setError(null);
    try {
      const xVarDef = SENSITIVITY_VARIABLES.find((v) => v.id === selectedXVar) || SENSITIVITY_VARIABLES[0];

      if (mode === '1D') {
        const res = await apiClient.deals.sensitivity1D({
          buyer_id: buyerId,
          target_id: targetId,
          base_assumptions: baseAssumptions,
          axis: {
            variable: selectedXVar,
            values: xVarDef.defaultVals,
          },
          output_metric: selectedMetric,
        });
        setData1D(res);
      } else {
        // Ensure X and Y are distinct
        let yVar = selectedYVar;
        if (yVar === selectedXVar) {
          yVar = selectedXVar === 'acquisition_premium' ? 'expected_annual_synergies' : 'acquisition_premium';
          setSelectedYVar(yVar);
        }
        const yVarDef = SENSITIVITY_VARIABLES.find((v) => v.id === yVar) || SENSITIVITY_VARIABLES[1];

        const res = await apiClient.deals.sensitivity2D({
          buyer_id: buyerId,
          target_id: targetId,
          base_assumptions: baseAssumptions,
          x_axis: {
            variable: selectedXVar,
            values: xVarDef.defaultVals,
          },
          y_axis: {
            variable: yVar,
            values: yVarDef.defaultVals,
          },
          output_metric: selectedMetric,
        });
        setData2D(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to calculate sensitivity matrix';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSensitivity();
  }, [buyerId, targetId, mode, selectedMetric, selectedXVar, selectedYVar, baseAssumptions]);

  const xVarConfig = SENSITIVITY_VARIABLES.find((v) => v.id === selectedXVar) || SENSITIVITY_VARIABLES[0];
  const yVarConfig = SENSITIVITY_VARIABLES.find((v) => v.id === selectedYVar) || SENSITIVITY_VARIABLES[1];
  const metricConfig = OUTPUT_METRICS.find((m) => m.id === selectedMetric) || OUTPUT_METRICS[0];

  const formatVariable = (val: number, isPct?: boolean) => {
    return isPct ? formatPercent(val, { decimals: 1 }) : formatCurrencyCr(val, 0);
  };

  const formatMetricOutput = (val: number | boolean | null) => {
    if (val === null || val === undefined) return '— (Infeasible)';
    if (typeof val === 'boolean') return val ? 'EXECUTABLE' : 'INFEASIBLE';
    if (selectedMetric.includes('ad_pct')) return formatSignedPercent(val, 2, false);
    if (selectedMetric.includes('eps')) return formatPriceINR(val);
    return formatCurrencyCr(val, 0);
  };

  // Convert 1D API response to chart points
  const points1D: Sensitivity1DPoint[] = useMemo(() => {
    if (!data1D) return [];
    return data1D.cells.map((c) => ({
      value: c.value ?? 0,
      output: typeof c.output === 'number' ? c.output : null,
      isFeasible: c.is_feasible,
      diagnostics: c.diagnostics,
    }));
  }, [data1D]);

  // Determine base values
  const baseXVal = (baseAssumptions as Record<string, unknown>)[selectedXVar] as number | undefined;
  const baseYVal = (baseAssumptions as Record<string, unknown>)[selectedYVar] as number | undefined;

  const baseColIdx = useMemo(() => {
    if (!data2D || baseXVal === undefined) return 2;
    const idx = data2D.x_values.findIndex((v) => Math.abs(v - baseXVal) < 1e-4);
    return idx >= 0 ? idx : 2;
  }, [data2D, baseXVal]);

  const baseRowIdx = useMemo(() => {
    if (!data2D || baseYVal === undefined) return 2;
    const idx = data2D.y_values.findIndex((v) => Math.abs(v - baseYVal) < 1e-4);
    return idx >= 0 ? idx : 2;
  }, [data2D, baseYVal]);

  return (
    <PageContainer maxWidth="1600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 1. Header & Counterparty Selection */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', fontWeight: 600 }}>
                Deal Workspace
              </span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sensitivity Engine</span>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Sensitivity Analysis & Multi-Variable Stress Matrix
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Evaluate how valuation, capital requirements, and pro-forma accretion/dilution respond to continuous movements in key transaction drivers.
            </p>
          </div>

          {/* Counterparty Selection Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-surface-2)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase' }}>Acquirer (Buyer)</label>
              <select
                value={buyerId}
                onChange={(e) => handleBuyerChange(e.target.value)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--line)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id}>
                    {c.company_id} — {c.company_name}
                  </option>
                ))}
              </select>
            </div>

            <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '12px' }}>➔</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase' }}>Target Company</label>
              <select
                value={targetId}
                onChange={(e) => handleTargetChange(e.target.value)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--line)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id} disabled={c.company_id === buyerId}>
                    {c.company_id} — {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Sensitivity Control Panel */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          {/* Mode Toggle (1D vs 2D) */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Sensitivity Mode
            </label>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface-2)', padding: '2px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--line)' }}>
              <button
                onClick={() => setMode('1D')}
                style={{
                  flex: 1,
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer',
                  background: mode === '1D' ? 'var(--accent)' : 'transparent',
                  color: mode === '1D' ? '#fff' : 'var(--text-muted)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                1D Curve
              </button>
              <button
                onClick={() => setMode('2D')}
                style={{
                  flex: 1,
                  padding: '5px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer',
                  background: mode === '2D' ? 'var(--accent)' : 'transparent',
                  color: mode === '2D' ? '#fff' : 'var(--text-muted)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                2D Matrix Heatmap
              </button>
            </div>
          </div>

          {/* Metric Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Target Output Metric
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                padding: '6px 8px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {OUTPUT_METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* X Axis Variable */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '6px' }}>
              {mode === '1D' ? 'Sensitivity Variable' : 'Column Variable (X-Axis)'}
            </label>
            <select
              value={selectedXVar}
              onChange={(e) => setSelectedXVar(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                padding: '6px 8px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {SENSITIVITY_VARIABLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Y Axis Variable (2D Only) */}
          {mode === '2D' && (
            <div>
              <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Row Variable (Y-Axis)
              </label>
              <select
                value={selectedYVar}
                onChange={(e) => setSelectedYVar(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--line)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {SENSITIVITY_VARIABLES.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.id === selectedXVar}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Re-calculate Button */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => fetchSensitivity()}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '7px 14px',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Compute Sensitivity
            </button>
          </div>
        </div>

        {loading && <ChartLoadingState message="Computing deterministic multi-variable sensitivity matrix..." />}
        {error && !loading && (
          <ChartErrorState
            title="Sensitivity Analysis Failed"
            message={error}
            onRetry={() => fetchSensitivity()}
          />
        )}

        {!loading && !error && (
          <>
            {/* 3. Primary Analytical Visualization */}
            {mode === '2D' && data2D && (
              <ChartContainer>
                <ChartHeader
                  title={`2D Sensitivity Heatmap: ${xVarConfig.label} vs. ${yVarConfig.label}`}
                  subtitle={`Evaluates ${metricConfig.label} across independent variable grids. Infeasible capital structures are outlined.`}
                  badge={<ChartBaseCaseMarker label="Base Case Identified" size="sm" />}
                />
                <SensitivityHeatmap
                  colVariable={xVarConfig.label}
                  rowVariable={yVarConfig.label}
                  colValues={data2D.x_values}
                  rowValues={data2D.y_values}
                  matrix={data2D.matrix}
                  baseRowIdx={baseRowIdx}
                  baseColIdx={baseColIdx}
                  formatCol={(v) => formatVariable(v, xVarConfig.isPct)}
                  formatRow={(v) => formatVariable(v, yVarConfig.isPct)}
                  formatCell={(v) => formatMetricOutput(v)}
                  unitLabel={metricConfig.unit}
                  colorMode={selectedMetric.includes('ad_pct') ? 'diverging' : 'sequential'}
                  onCellClick={(cell) => {
                    setSelectedDetail({
                      xLabel: xVarConfig.label,
                      xVal: cell.colVal ?? 0,
                      yLabel: yVarConfig.label,
                      yVal: cell.rowVal ?? 0,
                      output: cell.output,
                      isFeasible: cell.isFeasible,
                      diagnostics: cell.diagnostics,
                    });
                    setDrawerOpen(true);
                  }}
                />
              </ChartContainer>
            )}

            {mode === '1D' && data1D && (
              <ChartContainer>
                <ChartHeader
                  title={`1D Sensitivity Curve: ${metricConfig.label} vs. ${xVarConfig.label}`}
                  subtitle={`Monitors response curve and rate-of-change across range. Hover or click data point to inspect.`}
                  badge={<ChartBaseCaseMarker label="Base Case" size="sm" />}
                />
                <SensitivityLineChart
                  variableLabel={xVarConfig.label}
                  metricLabel={metricConfig.label}
                  points={points1D}
                  baseValue={baseXVal}
                  formatVariable={(v) => formatVariable(v, xVarConfig.isPct)}
                  formatOutput={(v) => formatMetricOutput(v)}
                  onPointSelect={(pt) => {
                    setSelectedDetail({
                      xLabel: xVarConfig.label,
                      xVal: pt.value,
                      output: pt.output,
                      isFeasible: pt.isFeasible,
                      diagnostics: pt.diagnostics,
                    });
                    setDrawerOpen(true);
                  }}
                />
              </ChartContainer>
            )}

            {/* 4. Tabular Schedule of Evaluated Sensitivity Grid */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-surface-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Authoritative Sensitivity Output Schedule
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Evaluated via Deterministic Pipeline · Click row to inspect
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-surface)' }}>
                      <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-label)', fontWeight: 600 }}>
                        {xVarConfig.label}
                      </th>
                      {mode === '2D' && (
                        <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-label)', fontWeight: 600 }}>
                          {yVarConfig.label}
                        </th>
                      )}
                      <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>
                        {metricConfig.label}
                      </th>
                      <th style={{ padding: '8px 14px', textAlign: 'center', color: 'var(--text-label)', fontWeight: 600 }}>
                        Feasibility
                      </th>
                      <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-label)', fontWeight: 600 }}>
                        Diagnostics & Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mode === '1D' &&
                      data1D?.cells.map((cell, idx) => {
                        const isBase = baseXVal !== undefined && Math.abs((cell.value ?? 0) - baseXVal) < 1e-4;
                        return (
                          <tr
                            key={idx}
                            onClick={() => {
                              setSelectedDetail({
                                xLabel: xVarConfig.label,
                                xVal: cell.value ?? 0,
                                output: cell.output,
                                isFeasible: cell.is_feasible,
                                diagnostics: cell.diagnostics,
                              });
                              setDrawerOpen(true);
                            }}
                            style={{
                              borderBottom: '1px solid var(--line-subtle)',
                              background: isBase ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                              cursor: 'pointer',
                            }}
                          >
                            <td style={{ padding: '8px 14px', fontWeight: isBase ? 700 : 500 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{formatVariable(cell.value ?? 0, xVarConfig.isPct)}</span>
                                {isBase && <ChartBaseCaseMarker size="sm" />}
                              </div>
                            </td>
                            <td
                              style={{
                                padding: '8px 14px',
                                textAlign: 'right',
                                fontWeight: 700,
                                color: !cell.is_feasible
                                  ? 'var(--negative)'
                                  : typeof cell.output === 'number' && cell.output >= 0
                                  ? 'var(--positive)'
                                  : 'var(--negative)',
                              }}
                            >
                              {formatMetricOutput(cell.output)}
                            </td>
                            <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                              <ChartStatusBadge status={cell.is_feasible ? 'EXECUTABLE' : 'INFEASIBLE'} size="sm" />
                            </td>
                            <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>
                              {cell.diagnostics && cell.diagnostics.length > 0
                                ? cell.diagnostics.join('; ')
                                : cell.is_feasible
                                ? 'Fully supported by balance sheet reserves.'
                                : 'Cash deficit flagged in reconciliation.'}
                            </td>
                          </tr>
                        );
                      })}

                    {mode === '2D' &&
                      data2D?.matrix.flatMap((row, rIdx) =>
                        row.map((cell, cIdx) => {
                          const yVal = data2D.y_values[rIdx];
                          const xVal = data2D.x_values[cIdx];
                          const isBase =
                            baseXVal !== undefined &&
                            baseYVal !== undefined &&
                            Math.abs(xVal - baseXVal) < 1e-4 &&
                            Math.abs(yVal - baseYVal) < 1e-4;

                          return (
                            <tr
                              key={`${rIdx}-${cIdx}`}
                              onClick={() => {
                                setSelectedDetail({
                                  xLabel: xVarConfig.label,
                                  xVal,
                                  yLabel: yVarConfig.label,
                                  yVal,
                                  output: cell.output,
                                  isFeasible: cell.is_feasible,
                                  diagnostics: cell.diagnostics,
                                });
                                setDrawerOpen(true);
                              }}
                              style={{
                                borderBottom: '1px solid var(--line-subtle)',
                                background: isBase ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                                cursor: 'pointer',
                              }}
                            >
                              <td style={{ padding: '8px 14px', fontWeight: isBase ? 700 : 500 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{formatVariable(xVal, xVarConfig.isPct)}</span>
                                  {isBase && <ChartBaseCaseMarker size="sm" />}
                                </div>
                              </td>
                              <td style={{ padding: '8px 14px' }}>
                                {formatVariable(yVal, yVarConfig.isPct)}
                              </td>
                              <td
                                style={{
                                  padding: '8px 14px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: !cell.is_feasible
                                    ? 'var(--negative)'
                                    : typeof cell.output === 'number' && cell.output >= 0
                                    ? 'var(--positive)'
                                    : 'var(--negative)',
                                }}
                              >
                                {formatMetricOutput(cell.output)}
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                <ChartStatusBadge status={cell.is_feasible ? 'EXECUTABLE' : 'INFEASIBLE'} size="sm" />
                              </td>
                              <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>
                                {cell.diagnostics && cell.diagnostics.length > 0
                                  ? cell.diagnostics.join('; ')
                                  : cell.is_feasible
                                  ? 'Fully supported by balance sheet reserves.'
                                  : 'Cash deficit flagged in reconciliation.'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 5. Selected Sensitivity Cell Detail Drawer */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Sensitivity Evaluation Cell Detail"
          width="460px"
        >
          {selectedDetail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '12px' }}>
              {/* Feasibility Alert */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${selectedDetail.isFeasible ? 'var(--line)' : 'var(--negative)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Cell Execution Feasibility
                  </span>
                  <ChartStatusBadge status={selectedDetail.isFeasible ? 'EXECUTABLE' : 'INFEASIBLE'} size="md" />
                </div>
                {!selectedDetail.isFeasible && (
                  <div style={{ color: 'var(--negative)', fontSize: '11px', marginTop: '4px' }}>
                    ⚠ Transaction is mathematically evaluated, but the financing structure requires more cash than available on acquirer balance sheet.
                  </div>
                )}
              </div>

              {/* Exact Inputs & Outputs Card */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>
                  Sensitized Inputs & Measured Output
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>{selectedDetail.xLabel}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatVariable(selectedDetail.xVal, xVarConfig.isPct)}
                      </td>
                    </tr>
                    {selectedDetail.yLabel && selectedDetail.yVal !== undefined && (
                      <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                        <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>{selectedDetail.yLabel}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600 }}>
                          {formatVariable(selectedDetail.yVal, yVarConfig.isPct)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>Target Output Metric</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                        {metricConfig.label}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>Output Metric Value</td>
                      <td
                        style={{
                          padding: '8px 14px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '13px',
                          color: !selectedDetail.isFeasible
                            ? 'var(--negative)'
                            : typeof selectedDetail.output === 'number' && selectedDetail.output >= 0
                            ? 'var(--positive)'
                            : 'var(--negative)',
                        }}
                      >
                        {formatMetricOutput(selectedDetail.output)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Diagnostics & Notes */}
              {selectedDetail.diagnostics && selectedDetail.diagnostics.length > 0 && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                  <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--warning)', marginBottom: '4px' }}>
                    Engine Diagnostics
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    {selectedDetail.diagnostics.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Drawer>
      </div>
    </PageContainer>
  );
};
