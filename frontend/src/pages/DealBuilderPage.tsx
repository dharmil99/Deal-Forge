import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/services/api/client';
import type { CompanyListItem, DealResponse, SourcesUsesResponse } from '@/types/api';
import { useDealContext } from '@/context/DealContext';
import { PageContainer } from '@/components/ui/PageContainer';
import { formatCurrencyCr, formatPriceINR } from '@/utils/formatters';
import {
  ChartContainer,
  ChartHeader,
  ChartLoadingState,
  ChartErrorState,
  WaterfallChart,
  StackedBarChart,
  type WaterfallStep,
  type StackedBarGroup,
} from '@/components/charts';

export const DealBuilderPage: React.FC = () => {
  const { activeDeal, dealParams, updateDealParams, setCounterparties } = useDealContext();

  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [buyerId, setBuyerId] = useState<string>(activeDeal?.buyerId || 'TCS');
  const [targetId, setTargetId] = useState<string>(activeDeal?.targetId || 'Infosys');
  const [premiumPct, setPremiumPct] = useState<number>(dealParams.premiumPct);
  const [cashPct, setCashPct] = useState<number>(dealParams.cashPct);
  const [debtPct, setDebtPct] = useState<number>(dealParams.debtPct);
  const [stockPct, setStockPct] = useState<number>(dealParams.stockPct);
  const [feesCr, setFeesCr] = useState<number>(dealParams.feesCr);
  const [synergiesCr, setSynergiesCr] = useState<number>(dealParams.synergiesCr);

  const [dealData, setDealData] = useState<DealResponse | null>(null);
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
    setFeesCr(dealParams.feesCr);
    setSynergiesCr(dealParams.synergiesCr);
  }, [dealParams]);

  // Fetch available companies for the selector dropdowns
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
    if (field === 'feesCr') setFeesCr(value);
    if (field === 'synergiesCr') setSynergiesCr(value);
    updateDealParams({ [field]: value });
  };

  // Fetch deal model & sources-uses execution validation
  const fetchDealModel = async () => {
    setLoading(true);
    setError(null);
    try {
      const sum = cashPct + debtPct + stockPct;
      if (Math.abs(sum - 100) > 0.01) {
        throw new Error(`Financing mix must sum to 100%. Current sum: ${sum.toFixed(1)}%`);
      }

      const dealPayload = {
        buyer_id: buyerId,
        target_id: targetId,
        acquisition_premium: premiumPct / 100,
        cash_pct: cashPct / 100,
        debt_pct: debtPct / 100,
        stock_pct: stockPct / 100,
        transaction_fees: feesCr,
        expected_annual_synergies: synergiesCr,
      };

      const suPayload = {
        buyer_id: buyerId,
        target_id: targetId,
        acquisition_premium: premiumPct / 100,
        cash_pct: cashPct / 100,
        debt_pct: debtPct / 100,
        stock_pct: stockPct / 100,
        transaction_fees: feesCr,
        refinance_target_debt: true,
        use_target_cash: true,
      };

      const [dealRes, suRes] = await Promise.all([
        apiClient.deals.buildDeal(dealPayload),
        apiClient.deals.sourcesAndUses(suPayload),
      ]);

      setDealData(dealRes);
      setSuData(suRes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to calculate deal model';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealModel();
  }, [buyerId, targetId, premiumPct, cashPct, debtPct, stockPct, feesCr, synergiesCr]);

  // 1. Purchase Price Bridge Steps
  const waterfallSteps: WaterfallStep[] = useMemo(() => {
    if (!dealData) return [];
    const t = dealData.transaction;
    const target = dealData.target;

    const baseEq = t.target_standalone_equity_value ?? target.equity_value ?? 0;
    const premiumVal = t.purchase_equity_value - baseEq;
    const debtRefinance = target.total_debt ?? 0;
    const cashSweep = target.cash ?? 0;
    const tev = t.transaction_enterprise_value ?? 0;

    return [
      {
        label: 'Target Mkt Cap',
        value: baseEq,
        type: 'start',
        sublabel: target.company_id,
        formattedValue: formatCurrencyCr(baseEq, { decimals: 0 }),
      },
      {
        label: 'Premium',
        value: premiumVal,
        type: premiumVal >= 0 ? 'add' : 'subtract',
        sublabel: `+${premiumPct.toFixed(0)}%`,
        formattedValue: `+${formatCurrencyCr(premiumVal, { decimals: 0 })}`,
      },
      {
        label: 'Purchase Equity',
        value: t.purchase_equity_value,
        type: 'total',
        sublabel: 'Offer Value',
        formattedValue: formatCurrencyCr(t.purchase_equity_value, { decimals: 0 }),
      },
      {
        label: 'Target Debt',
        value: debtRefinance,
        type: 'add',
        sublabel: 'Refinanced',
        formattedValue: `+${formatCurrencyCr(debtRefinance, { decimals: 0 })}`,
      },
      {
        label: 'Target Cash',
        value: -cashSweep,
        type: 'subtract',
        sublabel: 'Deducted/Swept',
        formattedValue: `-${formatCurrencyCr(cashSweep, { decimals: 0 })}`,
      },
      {
        label: 'Transaction TEV',
        value: tev,
        type: 'total',
        sublabel: 'Enterprise Value',
        formattedValue: formatCurrencyCr(tev, { decimals: 0 }),
      },
    ];
  }, [dealData, premiumPct]);

  // 2. Financing Mix: Requested vs Executable Stacked Bars
  const financingMixGroups: StackedBarGroup[] = useMemo(() => {
    if (!dealData) return [];
    const f = dealData.financing;

    const reqGroup: StackedBarGroup = {
      label: 'Requested Structure',
      sublabel: `Target consideration mix (${cashPct}% Cash / ${debtPct}% Debt / ${stockPct}% Stock)`,
      total: f.funding_amount,
      segments: [
        { id: 'cash', label: 'Cash', value: f.cash_amount, percentage: f.cash_pct * 100, color: 'var(--accent)' },
        { id: 'debt', label: 'Debt', value: f.debt_amount, percentage: f.debt_pct * 100, color: 'var(--warning)' },
        { id: 'stock', label: 'Stock', value: f.stock_amount, percentage: f.stock_pct * 100, color: '#38bdf8' },
      ],
    };

    if (!suData) return [reqGroup];

    const isFeasible = suData.reconciliation.is_feasible;
    const execSources = suData.sources;
    const totalExec = execSources.total_sources || 1;

    const execGroup: StackedBarGroup = {
      label: 'Executable Structure',
      sublabel: isFeasible ? 'Fully balance sheet supported' : 'Constrained by acquirer cash deficit',
      total: execSources.total_sources,
      isExecutable: isFeasible,
      statusBadge: isFeasible ? 'EXECUTABLE' : 'INFEASIBLE — CASH SHORTFALL',
      segments: [
        {
          id: 'cash',
          label: 'Acquirer Cash',
          value: execSources.acquirer_cash,
          percentage: (execSources.acquirer_cash / totalExec) * 100,
          color: isFeasible ? 'var(--accent)' : 'var(--negative)',
        },
        {
          id: 'debt',
          label: 'New Debt',
          value: execSources.new_debt,
          percentage: (execSources.new_debt / totalExec) * 100,
          color: 'var(--warning)',
        },
        {
          id: 'stock',
          label: 'Stock Issuance',
          value: execSources.stock_issuance,
          percentage: (execSources.stock_issuance / totalExec) * 100,
          color: '#38bdf8',
        },
        ...(execSources.target_cash_sweep > 0
          ? [
              {
                id: 'sweep',
                label: 'Target Cash',
                value: execSources.target_cash_sweep,
                percentage: (execSources.target_cash_sweep / totalExec) * 100,
                color: '#94a3b8',
              },
            ]
          : []),
      ],
    };

    return [reqGroup, execGroup];
  }, [dealData, suData, cashPct, debtPct, stockPct]);

  return (
    <PageContainer maxWidth="1600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 1. Header & Context */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', fontWeight: 600 }}>
                Deal Workspace
              </span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Transaction Structuring</span>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Deal Builder & Acquisition Pricing
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Configure purchase equity consideration, transaction enterprise value (TEV), financing mix, and operational synergies.
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

        {/* 2. Transaction Structuring Inputs Panel */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            alignItems: 'flex-end',
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
              step={1}
              value={premiumPct}
              onChange={(e) => handleParamChange('premiumPct', Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Cash Consideration: <strong style={{ color: 'var(--accent)' }}>{cashPct}%</strong>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={cashPct}
              onChange={(e) => handleParamChange('cashPct', Number(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: 'var(--radius-xs)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Debt Financing: <strong style={{ color: 'var(--warning)' }}>{debtPct}%</strong>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={debtPct}
              onChange={(e) => handleParamChange('debtPct', Number(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: 'var(--radius-xs)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Stock Issuance: <strong style={{ color: '#38bdf8' }}>{stockPct}%</strong>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={stockPct}
              onChange={(e) => handleParamChange('stockPct', Number(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: 'var(--radius-xs)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Pre-tax Synergies (₹ Cr)
            </label>
            <input
              type="number"
              min={0}
              step={50}
              value={synergiesCr}
              onChange={(e) => handleParamChange('synergiesCr', Number(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: 'var(--radius-xs)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Advisory Fees (₹ Cr)
            </label>
            <input
              type="number"
              min={0}
              step={10}
              value={feesCr}
              onChange={(e) => handleParamChange('feesCr', Number(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                color: 'var(--text-primary)',
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: 'var(--radius-xs)',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-label)' }}>Financing Mix Total</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: cashPct + debtPct + stockPct === 100 ? 'var(--positive)' : 'var(--negative)',
              }}
            >
              {cashPct + debtPct + stockPct}% {cashPct + debtPct + stockPct === 100 ? '✓ Balanced' : '✗ Must = 100%'}
            </span>
          </div>
        </div>

        {loading && <ChartLoadingState message="Calculating acquisition terms and balance sheet constraints..." />}
        {error && <ChartErrorState message={error} />}

        {!loading && !error && dealData && (
          <>
            {/* Feasibility Alert Banner if Infeasible */}
            {!suData?.reconciliation.is_feasible && suData && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid var(--negative)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--negative)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.04em' }}>
                    ⚠ EXECUTION STATUS: INFEASIBLE — CASH SHORTFALL
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>|</span>
                  <span style={{ color: 'var(--text-body)' }}>
                    Requested consideration requires <strong>{formatCurrencyCr(dealData.financing.cash_amount)} cash</strong>, but {dealData.acquirer.company_name} standalone liquid cash is <strong>{formatCurrencyCr(dealData.acquirer.cash)}</strong>. Shortfall: <strong style={{ color: 'var(--negative)' }}>{formatCurrencyCr(suData.reconciliation.funding_shortfall)}</strong>.
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Refinancing or equity adjustment required on <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sources & Uses</span>
                </div>
              </div>
            )}

            {/* 3. Headline Metrics Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
              }}
            >
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '14px 16px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Offer Price Per Share
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
                  {formatPriceINR(dealData.transaction.offer_price_per_share)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--positive)', marginTop: '2px' }}>
                  +{premiumPct}% vs Unaffected {formatPriceINR(dealData.target.current_price)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '14px 16px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Purchase Equity Value
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
                  {formatCurrencyCr(dealData.transaction.purchase_equity_value)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  100% target equity consideration
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '14px 16px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Transaction Enterprise Value (TEV)
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
                  {formatCurrencyCr(dealData.transaction.transaction_enterprise_value)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Equity Value + Target Net Debt ({formatCurrencyCr(dealData.transaction.target_net_debt)})
                </div>
              </div>

              {/* Financing Feasibility & Requested Structure Card */}
              <div style={{ background: 'var(--bg-surface)', border: `1px solid ${suData?.reconciliation.is_feasible ? 'var(--line)' : 'var(--negative)'}`, padding: '14px 16px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    Financing Feasibility
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-xs)', background: suData?.reconciliation.is_feasible ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: suData?.reconciliation.is_feasible ? 'var(--positive)' : 'var(--negative)' }}>
                    {suData?.reconciliation.is_feasible ? 'EXECUTABLE' : 'INFEASIBLE'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: suData?.reconciliation.is_feasible ? 'var(--positive)' : 'var(--negative)',
                    marginTop: '4px',
                  }}
                >
                  {suData?.reconciliation.is_feasible ? 'EXECUTABLE' : 'INFEASIBLE — CASH SHORTFALL'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-body)', marginTop: '3px' }}>
                  Requested: <strong>{cashPct}% Cash / {debtPct}% Debt / {stockPct}% Stock</strong>
                </div>
                <div style={{ fontSize: '10px', color: suData?.reconciliation.is_feasible ? 'var(--text-muted)' : 'var(--negative)', marginTop: '2px' }}>
                  {suData?.reconciliation.is_feasible
                    ? 'Acquirer cash balance sufficient'
                    : `Cash Deficit: ${formatCurrencyCr(suData?.reconciliation.funding_shortfall)}`}
                </div>
              </div>
            </div>

            {/* 4. Primary Analytical Charts (Purchase Price Bridge & Financing Mix) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              {/* Chart 1: Purchase Price Bridge */}
              <ChartContainer>
                <ChartHeader
                  title="Purchase Price Bridge (Market Cap → TEV)"
                  subtitle="Triangulates standalone market equity value, acquisition premium, debt assumption, and cash deduction to derive Transaction Enterprise Value."
                />
                <WaterfallChart
                  steps={waterfallSteps}
                  formatValue={(v) => formatCurrencyCr(v, { decimals: 0 })}
                  unitLabel="₹ Crores"
                  height={260}
                />
              </ChartContainer>

              {/* Chart 2: Financing Mix (100% Horizontal Stacked Bar) */}
              <ChartContainer>
                <ChartHeader
                  title="Financing Mix: Requested vs Executable Capital Structure"
                  subtitle="Compares requested consideration proportions against balance sheet liquidity reality. Feasibility audit highlights any cash deficit."
                />
                <StackedBarChart
                  groups={financingMixGroups}
                  formatValue={(v) => formatCurrencyCr(v, { decimals: 1 })}
                  showPercentages={true}
                />
              </ChartContainer>
            </div>

            {/* 5. Authoritative Deal Terms & Counterparty Profiles Table */}
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
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Authoritative Counterparty & Transaction Schedule
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Source: Official Filings & Deterministic Engine</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-surface)' }}>
                      <th style={{ padding: '8px 16px', textAlign: 'left', color: 'var(--text-label)', fontWeight: 600 }}>Financial Metric</th>
                      <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Acquirer: {dealData.acquirer.company_name}</th>
                      <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Target: {dealData.target.company_name}</th>
                      <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Transaction / Combined</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>Latest Revenue</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.acquirer.revenue)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.target.revenue)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrencyCr((dealData.acquirer.revenue ?? 0) + (dealData.target.revenue ?? 0))}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>Latest EBITDA</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.acquirer.ebitda)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.target.ebitda)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrencyCr((dealData.acquirer.ebitda ?? 0) + (dealData.target.ebitda ?? 0))}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>Reported Net Debt</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.acquirer.net_debt)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.target.net_debt)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {formatCurrencyCr(dealData.transaction.target_net_debt)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>Standalone Equity Value</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.acquirer.market_cap)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.target.equity_value)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--accent)' }}>
                        {formatCurrencyCr(dealData.transaction.purchase_equity_value)} (Offer)
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>Pre-deal Cash Balance</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.acquirer.cash)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.target.cash)}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: suData?.cash_reconciliation.is_cash_funded ? 'var(--positive)' : 'var(--negative)' }}>
                        Pro Forma Acquirer: {formatCurrencyCr(suData?.cash_reconciliation.pro_forma_acquirer_cash)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>Standalone EPS / Price</td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatPriceINR(dealData.acquirer.eps)} / {formatPriceINR(dealData.acquirer.current_price)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatPriceINR(dealData.target.eps)} / {formatPriceINR(dealData.target.current_price)}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--positive)' }}>
                        Offer: {formatPriceINR(dealData.transaction.offer_price_per_share)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 6. Diagnostics & Warnings Strip */}
            {(dealData.warnings.length > 0 || (suData?.warnings && suData.warnings.length > 0)) && (
              <div
                style={{
                  background: 'rgba(234, 179, 8, 0.05)',
                  border: '1px solid var(--warning)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  fontSize: '11px',
                  color: 'var(--text-body)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--warning)', marginBottom: '4px' }}>
                  Transaction & Balance Sheet Diagnostics
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {[...dealData.warnings, ...(suData?.warnings || [])].map((w, idx) => (
                    <li key={idx} style={{ color: 'var(--text-muted)' }}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
};
