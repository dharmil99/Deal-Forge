import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/services/api/client';
import type { AccretionDilutionResponse, CompanyListItem } from '@/types/api';
import { useDealContext } from '@/context/DealContext';
import { PageContainer } from '@/components/ui/PageContainer';
import {
  formatCurrencyCr,
  formatPriceINR,
  formatSignedPercent,
} from '@/utils/formatters';
import {
  ChartContainer,
  ChartHeader,
  ChartLoadingState,
  ChartErrorState,
  WaterfallChart,
  MultiYearADChart,
  BreakEvenSynergyChart,
  type WaterfallStep,
} from '@/components/charts';

export const AccretionDilutionPage: React.FC = () => {
  const { activeDeal, dealParams, updateDealParams, setCounterparties } = useDealContext();
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);

  const buyerId = activeDeal?.buyerId || 'TCS';
  const targetId = activeDeal?.targetId || 'Infosys';
  const {
    premiumPct,
    cashPct,
    debtPct,
    stockPct,
    synergiesCr,
    debtInterestRate,
    foregoneCashRate,
    taxRate,
  } = dealParams;

  const [adData, setAdData] = useState<AccretionDilutionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchAccretionDilution = async () => {
    setLoading(true);
    setError(null);
    try {
      const sum = cashPct + debtPct + stockPct;
      if (Math.abs(sum - 100) > 0.01) {
        throw new Error(`Financing mix must sum to 100%. Current sum: ${sum.toFixed(1)}%`);
      }

      const res = await apiClient.deals.accretionDilution({
        buyer_id: buyerId,
        target_id: targetId,
        acquisition_premium: premiumPct / 100,
        cash_pct: cashPct / 100,
        debt_pct: debtPct / 100,
        stock_pct: stockPct / 100,
        expected_annual_synergies: synergiesCr,
        debt_interest_rate: debtInterestRate / 100,
        foregone_cash_interest_rate: foregoneCashRate / 100,
        tax_rate: taxRate / 100,
      });

      setAdData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to calculate Accretion / Dilution model';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccretionDilution();
  }, [
    buyerId,
    targetId,
    premiumPct,
    cashPct,
    debtPct,
    stockPct,
    synergiesCr,
    debtInterestRate,
    foregoneCashRate,
    taxRate,
  ]);

  // 1. Signature EPS Bridge / Waterfall Steps (Year 1)
  const epsWaterfallSteps: WaterfallStep[] = useMemo(() => {
    if (!adData || !adData.standalone.buyer_eps) return [];

    const buyerEps = adData.standalone.buyer_eps;
    const y1 = adData.pro_forma.years.year_1;
    const shares = (y1?.pro_forma_shares ?? 0) / 10000000; // in Cr shares for unit ratio

    if (!y1 || shares === 0) return [];

    // Per-share step impacts in ₹/share
    const targetContribution = (y1.target_net_income ?? 0) / shares;
    const synergyImpact = y1.after_tax_synergy / shares;
    const debtInterestImpact = -(y1.after_tax_debt_interest / shares);
    const foregoneInterestImpact = -(y1.after_tax_foregone_interest / shares);
    // Share issuance dilution effect on buyer's own standalone earnings:
    const buyerStandaloneOnNewShares = (y1.buyer_net_income ?? 0) / shares;
    const shareIssuanceEffect = buyerStandaloneOnNewShares - buyerEps;
    const proFormaEps = y1.pro_forma_eps ?? 0;

    return [
      {
        label: 'Buyer Standalone EPS',
        value: buyerEps,
        type: 'start',
        sublabel: `${buyerId} Base`,
        formattedValue: formatPriceINR(buyerEps),
      },
      {
        label: 'Target Net Income',
        value: targetContribution,
        type: 'add',
        sublabel: 'Earnings Contrib.',
        formattedValue: `+${formatPriceINR(targetContribution)}`,
      },
      {
        label: 'After-tax Synergies',
        value: synergyImpact,
        type: 'add',
        sublabel: `+${formatCurrencyCr(y1.after_tax_synergy, 1)}`,
        formattedValue: `+${formatPriceINR(synergyImpact)}`,
      },
      {
        label: 'Debt Interest Cost',
        value: debtInterestImpact,
        type: 'subtract',
        sublabel: `-${formatCurrencyCr(y1.after_tax_debt_interest, 1)}`,
        formattedValue: formatPriceINR(debtInterestImpact),
      },
      {
        label: 'Foregone Interest',
        value: foregoneInterestImpact,
        type: 'subtract',
        sublabel: `-${formatCurrencyCr(y1.after_tax_foregone_interest, 1)}`,
        formattedValue: formatPriceINR(foregoneInterestImpact),
      },
      {
        label: 'Share Dilution Effect',
        value: shareIssuanceEffect,
        type: shareIssuanceEffect >= 0 ? 'add' : 'subtract',
        sublabel: 'New Shares Issued',
        formattedValue: formatPriceINR(shareIssuanceEffect),
      },
      {
        label: adData.is_feasible ? 'Pro Forma EPS' : 'Illustrative Pro Forma EPS',
        value: proFormaEps,
        type: 'total',
        sublabel: y1.accretion_dilution_pct ? formatSignedPercent(y1.accretion_dilution_pct, 1, false) : 'Combined',
        formattedValue: formatPriceINR(proFormaEps),
      },
    ];
  }, [adData, buyerId]);

  const y1 = adData?.pro_forma.years.year_1;
  const isAccretive = (y1?.accretion_dilution_pct ?? 0) >= 0;
  const beGrossY1 = adData?.break_even.year_1.break_even_gross_synergy ?? 0;
  const isSynergyNotRequired = beGrossY1 <= 0;

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
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Earnings Impact</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Accretion / Dilution Analysis
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Multi-year pro-forma earnings per share (EPS) modeling, transaction interest impacts, share dilution, and synergy break-even sensitivity.
          </p>
        </div>

        {/* Counterparty Selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-surface-2)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase' }}>Acquirer (Buyer)</label>
            <select
              value={buyerId}
              onChange={(e) => setCounterparties(e.target.value, targetId)}
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
              onChange={(e) => setCounterparties(buyerId, e.target.value)}
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

      {/* 2. Transaction Assumptions Inputs Bar */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '14px',
          alignItems: 'center',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Premium: <strong style={{ color: 'var(--text-primary)' }}>{premiumPct}%</strong>
          </label>
          <input
            type="range"
            min={0}
            max={60}
            value={premiumPct}
            onChange={(e) => updateDealParams({ premiumPct: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Cash / Debt / Stock
          </label>
          <div style={{ display: 'flex', gap: '3px' }}>
            <input
              type="number"
              value={cashPct}
              title="Cash %"
              onChange={(e) => updateDealParams({ cashPct: Number(e.target.value) })}
              style={{ width: '33%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '4px 6px', fontSize: '11px', borderRadius: 'var(--radius-xs)' }}
            />
            <input
              type="number"
              value={debtPct}
              title="Debt %"
              onChange={(e) => updateDealParams({ debtPct: Number(e.target.value) })}
              style={{ width: '33%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '4px 6px', fontSize: '11px', borderRadius: 'var(--radius-xs)' }}
            />
            <input
              type="number"
              value={stockPct}
              title="Stock %"
              onChange={(e) => updateDealParams({ stockPct: Number(e.target.value) })}
              style={{ width: '33%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '4px 6px', fontSize: '11px', borderRadius: 'var(--radius-xs)' }}
            />
          </div>
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
            onChange={(e) => updateDealParams({ synergiesCr: Number(e.target.value) })}
            style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '5px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Debt Interest Rate (%)
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={debtInterestRate}
            onChange={(e) => updateDealParams({ debtInterestRate: Number(e.target.value) })}
            style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '5px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Foregone Cash Rate (%)
          </label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={foregoneCashRate}
            onChange={(e) => updateDealParams({ foregoneCashRate: Number(e.target.value) })}
            style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '5px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Tax Rate (%)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={taxRate}
            onChange={(e) => updateDealParams({ taxRate: Number(e.target.value) })}
            style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '5px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
          />
        </div>
      </div>

      {loading && <ChartLoadingState message="Modeling multi-year earnings accretion and dilution..." />}
      {error && <ChartErrorState message={error} />}

      {!loading && !error && adData && y1 && (
        <>
          {/* Infeasible Alert Banner */}
          {!adData.is_feasible && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid var(--negative)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '12px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--negative)',
                  flexShrink: 0,
                }}
              />
              <div>
                <strong style={{ color: 'var(--negative)', marginRight: '6px' }}>
                  TRANSACTION STATUS: INFEASIBLE (CASH SHORTFALL)
                </strong>
                <span style={{ color: 'var(--text-body)' }}>
                  Requested cash consideration exceeds available acquirer balance sheet cash reserves.
                  Accretion / dilution output is presented as an{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    Illustrative Structure ({formatSignedPercent(y1.accretion_dilution_pct, 1, false)})
                  </strong>{' '}
                  and is not executable as configured without external cash raising.
                </span>
              </div>
            </div>
          )}

          {/* 3. Headline Metrics Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '14px 16px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Buyer Standalone EPS
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
                {formatPriceINR(adData.standalone.buyer_eps)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Baseline undisturbed EPS
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '14px 16px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {adData.is_feasible ? 'Pro Forma Year 1 EPS' : 'Illustrative Year 1 EPS'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: isAccretive ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
                {formatPriceINR(y1.pro_forma_eps)}
              </div>
              <div style={{ fontSize: '10px', color: isAccretive ? 'var(--positive)' : 'var(--negative)', marginTop: '2px' }}>
                {adData.is_feasible
                  ? `${formatSignedPercent(y1.accretion_dilution_pct, 1, false)} (${formatPriceINR(y1.eps_change)})`
                  : `Illustrative EPS Impact: ${formatSignedPercent(y1.accretion_dilution_pct, 1, false)} (${formatPriceINR(y1.eps_change)})`}
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '14px 16px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Transaction Feasibility
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: adData.is_feasible ? 'var(--positive)' : 'var(--negative)',
                  marginTop: '4px',
                }}
              >
                {adData.is_feasible ? 'EXECUTABLE' : 'INFEASIBLE'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {adData.is_feasible
                  ? `Fully Funded · ${y1.modelled_status}: ${formatSignedPercent(y1.accretion_dilution_pct, 1, false)}`
                  : `Illustrative A/D: ${formatSignedPercent(y1.accretion_dilution_pct, 1, false)} · Cash Deficit`}
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', padding: '14px 16px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Break-Even Synergy (Y1)
              </div>
              <div
                style={{
                  fontSize: isSynergyNotRequired ? '16px' : '20px',
                  fontWeight: 600,
                  color: isSynergyNotRequired ? 'var(--positive)' : 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: '4px',
                }}
              >
                {isSynergyNotRequired ? 'SYNERGY NOT REQUIRED' : formatCurrencyCr(beGrossY1, 1)}
              </div>
              <div style={{ fontSize: '10px', color: isSynergyNotRequired ? 'var(--positive)' : 'var(--warning)', marginTop: '2px' }}>
                {isSynergyNotRequired
                  ? `No incremental synergy is required for EPS neutrality. (Math: ${formatCurrencyCr(beGrossY1, 1)})`
                  : 'Pre-tax synergy required'}
              </div>
            </div>
          </div>

          {/* 4. SIGNATURE VISUALIZATION 1: EPS Bridge / Waterfall */}
          <ChartContainer>
            <ChartHeader
              title="EPS Bridge / Waterfall (Signature Accretion/Dilution Triangulation)"
              subtitle="Step-by-step bridge demonstrating standalone EPS, target net income contribution, synergy value, new borrowing cost, foregone cash interest, and share issuance dilution."
            />
            <WaterfallChart
              steps={epsWaterfallSteps}
              formatValue={(v) => formatPriceINR(v)}
              unitLabel="₹ per share"
              height={260}
            />
          </ChartContainer>

          {/* 5. VISUALIZATION 2 & 3: Three-Year Accretion Trajectory & Break-Even Synergy */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
            {/* Chart 2: Three-Year Accretion/Dilution Chart */}
            <ChartContainer>
              <ChartHeader
                title="Three-Year Accretion / Dilution Trajectory"
                subtitle="Compares projected Year 1, Year 2, and Year 3 EPS against buyer standalone baseline. Color-coded green for accretion and red for dilution."
              />
              <MultiYearADChart
                proForma={adData.pro_forma}
                standalone={adData.standalone}
                height={220}
              />
            </ChartContainer>

            {/* Chart 3: Break-even Synergy Visualization */}
            <ChartContainer>
              <ChartHeader
                title="Break-Even Synergy Cushion & Sensitivity"
                subtitle="Compares modeled synergies against the mathematical threshold required for EPS neutrality."
              />
              <BreakEvenSynergyChart
                modeledSynergy={y1.gross_synergy}
                breakEvenDetail={adData.break_even.year_1}
                yearLabel="Year 1"
                isFeasible={adData.is_feasible}
              />
            </ChartContainer>
          </div>

          {/* 6. Authoritative Multi-Year Projection Schedule Table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Authoritative Multi-Year Earnings Pro-Forma Schedule
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Currency: ₹ Crores (except per share metrics)</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-surface)' }}>
                    <th style={{ padding: '8px 16px', textAlign: 'left', color: 'var(--text-label)', fontWeight: 600 }}>Earnings Component</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Buyer Standalone</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Year 1 Pro Forma</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Year 2 Pro Forma</th>
                    <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Year 3 Pro Forma</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                    <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>Standalone Net Income</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(adData.buyer.net_income, 1)}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(y1.buyer_net_income, 1)}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(adData.pro_forma.years.year_2?.buyer_net_income, 1)}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(adData.pro_forma.years.year_3?.buyer_net_income, 1)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                    <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>Target Net Income Contribution</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--positive)' }}>
                      +{formatCurrencyCr(y1.target_net_income, 1)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--positive)' }}>
                      +{formatCurrencyCr(adData.pro_forma.years.year_2?.target_net_income, 1)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--positive)' }}>
                      +{formatCurrencyCr(adData.pro_forma.years.year_3?.target_net_income, 1)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                    <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>After-Tax Modeled Synergies</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--positive)' }}>
                      +{formatCurrencyCr(y1.after_tax_synergy, 1)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--positive)' }}>
                      +{formatCurrencyCr(adData.pro_forma.years.year_2?.after_tax_synergy, 1)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--positive)' }}>
                      +{formatCurrencyCr(adData.pro_forma.years.year_3?.after_tax_synergy, 1)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                    <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>After-Tax Debt Interest Cost</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--negative)' }}>
                      -{formatCurrencyCr(y1.after_tax_debt_interest, 1)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--negative)' }}>
                      -{formatCurrencyCr(adData.pro_forma.years.year_2?.after_tax_debt_interest, 1)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--negative)' }}>
                      -{formatCurrencyCr(adData.pro_forma.years.year_3?.after_tax_debt_interest, 1)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                    <td style={{ padding: '8px 16px', color: 'var(--text-body)' }}>After-Tax Foregone Cash Yield</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--negative)' }}>
                      -{formatCurrencyCr(y1.after_tax_foregone_interest, 1)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--negative)' }}>
                      -{formatCurrencyCr(adData.pro_forma.years.year_2?.after_tax_foregone_interest, 1)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--negative)' }}>
                      -{formatCurrencyCr(adData.pro_forma.years.year_3?.after_tax_foregone_interest, 1)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-surface-2)', fontWeight: 600 }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>Combined Pro Forma Net Income</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(adData.buyer.net_income, 1)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--accent)' }}>
                      {formatCurrencyCr(y1.pro_forma_net_income, 1)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--accent)' }}>
                      {formatCurrencyCr(adData.pro_forma.years.year_2?.pro_forma_net_income, 1)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--accent)' }}>
                      {formatCurrencyCr(adData.pro_forma.years.year_3?.pro_forma_net_income, 1)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                    <td style={{ padding: '8px 16px', color: 'var(--text-muted)' }}>Diluted Share Count (Cr)</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {((adData.buyer.diluted_shares ?? 0) / 10000000).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {((y1.pro_forma_shares ?? 0) / 10000000).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {((adData.pro_forma.years.year_2?.pro_forma_shares ?? 0) / 10000000).toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {((adData.pro_forma.years.year_3?.pro_forma_shares ?? 0) / 10000000).toFixed(2)}
                    </td>
                  </tr>
                  <tr style={{ background: 'var(--bg-surface-3)', fontWeight: 600 }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-strong)' }}>
                      {adData.is_feasible ? 'Pro Forma EPS (₹)' : 'Illustrative Pro Forma EPS (₹)'}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                      {formatPriceINR(adData.standalone.buyer_eps)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (y1.accretion_dilution_pct ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                      {formatPriceINR(y1.pro_forma_eps)} ({y1.accretion_dilution_pct ? formatSignedPercent(y1.accretion_dilution_pct, 1, false) : '0%'})
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (adData.pro_forma.years.year_2?.accretion_dilution_pct ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                      {formatPriceINR(adData.pro_forma.years.year_2?.pro_forma_eps)} ({adData.pro_forma.years.year_2?.accretion_dilution_pct ? formatSignedPercent(adData.pro_forma.years.year_2.accretion_dilution_pct, 1, false) : '0%'})
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: (adData.pro_forma.years.year_3?.accretion_dilution_pct ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                      {formatPriceINR(adData.pro_forma.years.year_3?.pro_forma_eps)} ({adData.pro_forma.years.year_3?.accretion_dilution_pct ? formatSignedPercent(adData.pro_forma.years.year_3.accretion_dilution_pct, 1, false) : '0%'})
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      </div>
    </PageContainer>
  );
};
