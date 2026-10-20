import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/services/api/client';
import type { CompanyListItem, SourcesUsesResponse } from '@/types/api';
import { useDealContext } from '@/context/DealContext';
import { PageContainer } from '@/components/ui/PageContainer';
import { formatCurrencyCr } from '@/utils/formatters';
import {
  ChartContainer,
  ChartHeader,
  ChartLoadingState,
  ChartErrorState,
  StackedBarChart,
  SourcesUsesFlowChart,
  type StackedBarGroup,
} from '@/components/charts';

export const SourcesUsesPage: React.FC = () => {
  const { activeDeal, dealParams, updateDealParams, setCounterparties } = useDealContext();

  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [buyerId, setBuyerId] = useState<string>(activeDeal?.buyerId || 'TCS');
  const [targetId, setTargetId] = useState<string>(activeDeal?.targetId || 'Infosys');
  const [premiumPct, setPremiumPct] = useState<number>(dealParams.premiumPct);
  const [cashPct, setCashPct] = useState<number>(dealParams.cashPct);
  const [debtPct, setDebtPct] = useState<number>(dealParams.debtPct);
  const [stockPct, setStockPct] = useState<number>(dealParams.stockPct);
  const [refinanceDebt, setRefinanceDebt] = useState<boolean>(true);
  const [sweepCash, setSweepCash] = useState<boolean>(true);
  const [debtFeePct, setDebtFeePct] = useState<number>(0.0);
  const [minCashBuffer, setMinCashBuffer] = useState<number>(0.0);
  const [transactionFees, setTransactionFees] = useState<number>(dealParams.feesCr);

  const [suData, setSuData] = useState<SourcesUsesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state if context changes externally
  useEffect(() => {
    if (activeDeal?.buyerId && activeDeal.buyerId !== buyerId) {
      setBuyerId(activeDeal.buyerId);
    }
    if (activeDeal?.targetId && activeDeal.targetId !== targetId) {
      setTargetId(activeDeal.targetId);
    }
  }, [activeDeal?.buyerId, activeDeal?.targetId]);

  useEffect(() => {
    setPremiumPct(dealParams.premiumPct);
    setCashPct(dealParams.cashPct);
    setDebtPct(dealParams.debtPct);
    setStockPct(dealParams.stockPct);
    setTransactionFees(dealParams.feesCr);
  }, [dealParams]);

  useEffect(() => {
    let active = true;
    apiClient.companies.list({ limit: 200 })
      .then((res) => {
        if (active) setCompanies(res.items);
      })
      .catch((err) => console.error('Failed to load companies list', err));
    return () => {
      active = false;
    };
  }, []);

  const handleBuyerChange = (newBuyer: string) => {
    setBuyerId(newBuyer);
    setCounterparties(newBuyer, targetId);
  };

  const handleTargetChange = (newTarget: string) => {
    setTargetId(newTarget);
    setCounterparties(buyerId, newTarget);
  };

  const handleParamChange = (field: keyof typeof dealParams, value: number) => {
    if (field === 'premiumPct') setPremiumPct(value);
    if (field === 'cashPct') setCashPct(value);
    if (field === 'debtPct') setDebtPct(value);
    if (field === 'stockPct') setStockPct(value);
    if (field === 'feesCr') setTransactionFees(value);
    updateDealParams({ [field]: value });
  };

  const fetchSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const sum = cashPct + debtPct + stockPct;
      if (Math.abs(sum - 100) > 0.01) {
        throw new Error(`Financing mix must sum to 100%. Current sum: ${sum.toFixed(1)}%`);
      }

      const res = await apiClient.deals.sourcesAndUses({
        buyer_id: buyerId,
        target_id: targetId,
        acquisition_premium: premiumPct / 100,
        cash_pct: cashPct / 100,
        debt_pct: debtPct / 100,
        stock_pct: stockPct / 100,
        refinance_target_debt: refinanceDebt,
        use_target_cash: sweepCash,
        debt_issuance_fee_pct: debtFeePct / 100,
        minimum_cash_balance: minCashBuffer,
        transaction_fees: transactionFees,
      });

      setSuData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to calculate Sources & Uses schedule';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [
    buyerId,
    targetId,
    premiumPct,
    cashPct,
    debtPct,
    stockPct,
    refinanceDebt,
    sweepCash,
    debtFeePct,
    minCashBuffer,
    transactionFees,
  ]);

  // Funding Composition: Requested vs Executable Stacked Bar
  const fundingCompositionGroups: StackedBarGroup[] = useMemo(() => {
    if (!suData) return [];
    const req = suData.requested_financing;
    const exec = suData.sources;
    const isFeasible = suData.reconciliation.is_feasible;

    const reqTotal = req.total_requested_sources || 1;
    const execTotal = exec.total_sources || 1;

    const requestedGroup: StackedBarGroup = {
      label: 'Requested Funding Structure',
      sublabel: `Target mix allocation (${cashPct}% Cash / ${debtPct}% Debt / ${stockPct}% Stock)`,
      total: req.total_requested_sources,
      segments: [
        { id: 'cash', label: 'Acquirer Cash', value: req.acquirer_cash, percentage: (req.acquirer_cash / reqTotal) * 100, color: 'var(--accent)' },
        { id: 'debt', label: 'New Debt', value: req.new_debt, percentage: (req.new_debt / reqTotal) * 100, color: 'var(--warning)' },
        { id: 'stock', label: 'Stock Issuance', value: req.stock_issuance, percentage: (req.stock_issuance / reqTotal) * 100, color: '#38bdf8' },
        ...(req.target_cash_sweep > 0
          ? [{ id: 'sweep', label: 'Target Cash', value: req.target_cash_sweep, percentage: (req.target_cash_sweep / reqTotal) * 100, color: '#94a3b8' }]
          : []),
      ],
    };

    const executableGroup: StackedBarGroup = {
      label: 'Executable Funding Sources',
      sublabel: isFeasible ? 'Fully balance sheet supported' : 'Constrained by acquirer cash deficit',
      total: exec.total_sources,
      isExecutable: isFeasible,
      statusBadge: isFeasible ? 'EXECUTABLE' : 'INFEASIBLE — CASH SHORTFALL',
      segments: [
        {
          id: 'cash',
          label: 'Acquirer Cash',
          value: exec.acquirer_cash,
          percentage: (exec.acquirer_cash / execTotal) * 100,
          color: isFeasible ? 'var(--accent)' : 'var(--negative)',
        },
        {
          id: 'debt',
          label: 'New Debt',
          value: exec.new_debt,
          percentage: (exec.new_debt / execTotal) * 100,
          color: 'var(--warning)',
        },
        {
          id: 'stock',
          label: 'Stock Issuance',
          value: exec.stock_issuance,
          percentage: (exec.stock_issuance / execTotal) * 100,
          color: '#38bdf8',
        },
        ...(exec.target_cash_sweep > 0
          ? [{ id: 'sweep', label: 'Target Cash', value: exec.target_cash_sweep, percentage: (exec.target_cash_sweep / execTotal) * 100, color: '#94a3b8' }]
          : []),
      ],
    };

    return [requestedGroup, executableGroup];
  }, [suData, cashPct, debtPct, stockPct]);

  return (
    <PageContainer maxWidth="1600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 1. Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', fontWeight: 600 }}>
                Deal Workspace
              </span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Capital Structuring</span>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Sources & Uses Schedule
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Authoritative transaction balance identity reconciling gross capital requirements against executable funding sources.
            </p>
          </div>

          {/* Counterparty Selectors */}
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

        {/* 2. Transaction Parameters & Toggles */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Acquisition Premium: <strong style={{ color: 'var(--text-primary)' }}>{premiumPct}%</strong>
            </label>
            <input
              type="range"
              min={0}
              max={60}
              value={premiumPct}
              onChange={(e) => handleParamChange('premiumPct', Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Cash / Debt / Stock Mix
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="number"
                min={0}
                max={100}
                value={cashPct}
                title="Cash %"
                onChange={(e) => handleParamChange('cashPct', Number(e.target.value))}
                style={{ width: '33%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '4px 6px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={debtPct}
                title="Debt %"
                onChange={(e) => handleParamChange('debtPct', Number(e.target.value))}
                style={{ width: '33%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '4px 6px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={stockPct}
                title="Stock %"
                onChange={(e) => handleParamChange('stockPct', Number(e.target.value))}
                style={{ width: '33%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '4px 6px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
              />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-body)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={refinanceDebt}
                onChange={(e) => setRefinanceDebt(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Refinance Target Debt
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-body)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sweepCash}
                onChange={(e) => setSweepCash(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Sweep Target Cash
            </label>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Min Cash Buffer (₹ Cr)
            </label>
            <input
              type="number"
              min={0}
              step={100}
              value={minCashBuffer}
              onChange={(e) => setMinCashBuffer(Number(e.target.value))}
              style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '6px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Debt Issuance Fee (%)
            </label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={debtFeePct}
              onChange={(e) => setDebtFeePct(Number(e.target.value))}
              style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '6px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Transaction Fees (₹ Cr)
            </label>
            <input
              type="number"
              min={0}
              step={10}
              value={transactionFees}
              onChange={(e) => handleParamChange('feesCr', Number(e.target.value))}
              style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '6px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
            />
          </div>
        </div>

        {loading && <ChartLoadingState message="Reconciling Sources and Uses identity..." />}
        {error && <ChartErrorState message={error} />}

        {!loading && !error && suData && (
          <>
            {/* Feasibility Alert Banner */}
            {!suData.reconciliation.is_feasible && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid var(--negative)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--negative)', letterSpacing: '0.04em' }}>
                      ⚠ TRANSACTION FEASIBILITY: INFEASIBLE — CASH SHORTFALL
                    </span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-xs)', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--negative)', fontWeight: 700 }}>
                      DEFICIT: {formatCurrencyCr(suData.reconciliation.funding_shortfall)}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Total Uses ({formatCurrencyCr(suData.uses.total_uses)}) &gt; Executable Sources ({formatCurrencyCr(suData.sources.total_sources)})
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.5 }}>
                  Requested structure requires <strong>{formatCurrencyCr(suData.requested_financing.acquirer_cash)}</strong> in cash consideration, but acquirer pre-deal cash is only <strong>{formatCurrencyCr(suData.cash_reconciliation.pre_deal_acquirer_cash)}</strong>. Executable sources are capped at available liquid reserves, leaving an unfunded deficit of <strong style={{ color: 'var(--negative)' }}>{formatCurrencyCr(suData.reconciliation.funding_shortfall)}</strong>. The transaction cannot execute without restructuring debt or equity consideration.
                </p>
              </div>
            )}

            {/* 3. Primary Analytical Visualizations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Visualization 1: Institutional Sources & Uses Flow / Balanced Bridge */}
              <ChartContainer>
                <ChartHeader
                  title="Institutional Sources & Uses Balanced Flow"
                  subtitle="Visual reconciliation of transaction funding sources vs gross capital applications. Highlights executable cash constraints and structural deficits."
                />
                <SourcesUsesFlowChart data={suData} />
              </ChartContainer>

              {/* Visualization 2: Funding Composition 100% Stacked Bar */}
              <ChartContainer>
                <ChartHeader
                  title="Funding Composition: Requested vs Executable Allocation"
                  subtitle="Compares requested consideration against executable balance sheet capacity. Feasibility audit prevents plugging fictitious sources."
                />
                <StackedBarChart
                  groups={fundingCompositionGroups}
                  formatValue={(v) => formatCurrencyCr(v, { decimals: 1 })}
                  showPercentages={true}
                />
              </ChartContainer>
            </div>

            {/* 4. Authoritative Sources & Uses Schedule Table */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                gap: '20px',
              }}
            >
              {/* Uses Table */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase' }}>Uses of Funds</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {formatCurrencyCr(suData.uses.total_uses)}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>Purchase Equity Value</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {formatCurrencyCr(suData.uses.purchase_equity_value)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', width: '60px' }}>
                        {((suData.uses.purchase_equity_value / suData.uses.total_uses) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>Target Debt Refinancing</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrencyCr(suData.uses.target_debt_refinancing)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                        {((suData.uses.target_debt_refinancing / suData.uses.total_uses) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>Advisory & Legal Fees</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrencyCr(suData.uses.transaction_fees)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                        {((suData.uses.transaction_fees / suData.uses.total_uses) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>Debt Underwriting / Issuance Fees</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrencyCr(suData.uses.debt_issuance_fees)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                        {((suData.uses.debt_issuance_fees / suData.uses.total_uses) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr style={{ background: 'var(--bg-surface-2)', fontWeight: 600 }}>
                      <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>Total Uses of Funds</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                        {formatCurrencyCr(suData.uses.total_uses)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                        100.0%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sources Table (Executable vs Shortfall) */}
              <div style={{ background: 'var(--bg-surface)', border: `1px solid ${suData.reconciliation.is_feasible ? 'var(--line)' : 'var(--negative)'}`, borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase' }}>
                    Executable Sources of Funds
                  </span>
                  <span style={{ fontSize: '11px', color: suData.reconciliation.is_feasible ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {formatCurrencyCr(suData.sources.total_sources)}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>
                        Acquirer Balance Sheet Cash
                        {!suData.reconciliation.is_feasible && (
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--negative)' }}>
                            Requested: {formatCurrencyCr(suData.requested_financing.acquirer_cash)} (Capped at available balance)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {formatCurrencyCr(suData.sources.acquirer_cash)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', width: '60px' }}>
                        {((suData.sources.acquirer_cash / (suData.sources.total_sources || 1)) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>New Debt Facilities</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrencyCr(suData.sources.new_debt)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                        {((suData.sources.new_debt / (suData.sources.total_sources || 1)) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>Stock Consideration Issued</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrencyCr(suData.sources.stock_issuance)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                        {((suData.sources.stock_issuance / (suData.sources.total_sources || 1)) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>Target Cash Swept</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrencyCr(suData.sources.target_cash_sweep)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>
                        {((suData.sources.target_cash_sweep / (suData.sources.total_sources || 1)) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr style={{ background: 'var(--bg-surface-2)', fontWeight: 600 }}>
                      <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>Total Executable Sources</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: suData.reconciliation.is_feasible ? 'var(--positive)' : 'var(--negative)' }}>
                        {formatCurrencyCr(suData.sources.total_sources)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                        100.0%
                      </td>
                    </tr>
                    {!suData.reconciliation.is_feasible && (
                      <>
                        <tr style={{ borderTop: '1px solid var(--negative)', background: 'rgba(239, 68, 68, 0.05)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--negative)', fontWeight: 600 }}>
                            Funding Shortfall (Unfunded Uses)
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--negative)', fontWeight: 700 }}>
                            -{formatCurrencyCr(suData.reconciliation.funding_shortfall)}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--negative)', fontWeight: 600 }}>
                            -{((suData.reconciliation.funding_shortfall / suData.uses.total_uses) * 100).toFixed(1)}%
                          </td>
                        </tr>
                        <tr style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
                          <td style={{ padding: '8px 16px', color: 'var(--negative)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
                            Execution Status
                          </td>
                          <td colSpan={2} style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--negative)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.04em' }}>
                            INFEASIBLE — CASH SHORTFALL
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Cash & Liquidity Reconciliation Schedule */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px 20px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase', marginBottom: '12px' }}>
                Cash & Pro-Forma Liquidity Audit
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', fontSize: '11px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Pre-Deal Acquirer Cash</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyCr(suData.cash_reconciliation.pre_deal_acquirer_cash)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Cash Required by Mix</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyCr(suData.cash_reconciliation.cash_required)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Cash Deficit</span>
                  <strong style={{ fontSize: '14px', color: suData.cash_reconciliation.cash_deficit > 0 ? 'var(--negative)' : 'var(--positive)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyCr(suData.cash_reconciliation.cash_deficit)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Pro-Forma Combined Cash</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyCr(suData.cash_reconciliation.pro_forma_combined_cash)}
                  </strong>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
};
