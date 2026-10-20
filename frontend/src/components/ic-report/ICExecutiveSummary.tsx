import React from 'react';
import type { DealResponse, SourcesUsesResponse, AccretionDilutionResponse } from '@/types/api';
import { formatCurrencyCr, formatPercent, formatSignedPercent, formatPriceINR } from '@/utils/formatters';

interface ICExecutiveSummaryProps {
  dealData: DealResponse;
  suData: SourcesUsesResponse;
  adData: AccretionDilutionResponse;
}

export const ICExecutiveSummary: React.FC<ICExecutiveSummaryProps> = ({
  dealData,
  suData,
  adData,
}) => {
  const y1 = adData.pro_forma.years['1'];
  const y3 = adData.pro_forma.years['3'];

  const isFeasible = suData.reconciliation.is_feasible;
  const isY1Accretive = (y1?.accretion_dilution_pct ?? 0) >= 0;
  const isY3Accretive = (y3?.accretion_dilution_pct ?? 0) >= 0;

  // Break-even synergy logic (CRITICAL SEMANTICS: <= 0 is "Not Required (Already Accretive)")
  const beGrossY1 = adData.break_even['1']?.break_even_gross_synergy ?? 0;
  const isSynergyNotRequired = beGrossY1 <= 0;

  // Premium ratio
  const premiumPct = (dealData.transaction.acquisition_premium ?? 0.20) * 100;

  // Deterministic Narrative Generation (Strictly without LLM)
  const generateExecutiveNarrative = (): { statement: string; highlight: string; type: 'positive' | 'warning' | 'negative' } => {
    if (!isFeasible) {
      const deficit = suData.reconciliation.funding_shortfall || 0;
      if (isY1Accretive) {
        return {
          statement: `DealForge's deterministic model indicates that the illustrative transaction structure is accretive to Year 1 EPS (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}); however, the requested financing structure is not executable under available buyer liquidity (unfunded deficit of ${formatCurrencyCr(deficit)}). Committee consideration should focus first on funding restructuring before relying on the modeled accretion outcome.`,
          highlight: 'Illustrative structure is accretive, but requested funding is infeasible.',
          type: 'warning',
        };
      }
      return {
        statement: `Requested structure is illustrative and cannot be funded with available buyer liquidity. Pre-deal acquirer cash of ${formatCurrencyCr(suData.cash_reconciliation.pre_deal_acquirer_cash)} is insufficient to meet the ${formatCurrencyCr(suData.requested_financing.acquirer_cash)} cash consideration demand, leaving an unfunded deficit of ${formatCurrencyCr(deficit)}. In addition, the structure is dilutive to Year 1 EPS (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}). Capital structure must be restructured with higher debt or equity consideration to achieve execution feasibility.`,
        highlight: 'Requested structure is illustrative and cannot be funded with available buyer liquidity.',
        type: 'negative',
      };
    }

    if (isY1Accretive) {
      if (isSynergyNotRequired) {
        return {
          statement: `Transaction is executable under the modeled financing structure (${dealData.financing.cash_pct}% Cash / ${dealData.financing.debt_pct}% Debt / ${dealData.financing.stock_pct}% Stock). Transaction is accretive before modeled synergies (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)} Year 1 A/D); additional synergy is not required for break-even.`,
          highlight: 'Transaction is accretive before modeled synergies; additional synergy is not required for break-even.',
          type: 'positive',
        };
      }
      return {
        statement: `Transaction is executable under the modeled financing structure and accretive to Year 1 EPS (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}), delivering pro forma EPS of ${formatPriceINR(y1?.pro_forma_eps)} vs undisturbed buyer EPS of ${formatPriceINR(adData.standalone.buyer_eps)}.`,
        highlight: 'Transaction is executable under the modeled financing structure and accretive to Year 1 EPS.',
        type: 'positive',
      };
    }

    // Feasible but Dilutive
    return {
      statement: `Transaction is executable under the modeled financing structure, but dilutive to Year 1 EPS (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}). It requires approximately ${formatCurrencyCr(beGrossY1)} of gross annual synergy to reach EPS neutrality (modeled Year 1 synergy is ${formatCurrencyCr(adData.synergies.gross_year_1)}).`,
      highlight: `Transaction is dilutive in Year 1 and requires approximately ${formatCurrencyCr(beGrossY1)} of gross synergy to reach break-even.`,
      type: 'warning',
    };
  };

  const narrative = generateExecutiveNarrative();

  return (
    <section
      className="ic-executive-summary"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Section Sub-header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--line)',
          paddingBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            SECTION B
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Executive Summary & Key Transaction Metrics
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Authoritative Deterministic Output
        </span>
      </div>

      {/* 1. 7-Metric Executive Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
        }}
      >
        {/* Metric 1: Premium */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 600 }}>
            Acquisition Premium
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
            {formatPercent(premiumPct, 1, false)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Over undisturbed share price
          </div>
        </div>

        {/* Metric 2: Purchase Equity Value */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 600 }}>
            Purchase Equity Value
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
            {formatCurrencyCr(dealData.transaction.purchase_equity_value, 0)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Offer equity consideration
          </div>
        </div>

        {/* Metric 3: Transaction EV */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 600 }}>
            Transaction EV
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
            {formatCurrencyCr(dealData.transaction.transaction_enterprise_value, 0)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Net enterprise value
          </div>
        </div>

        {/* Metric 4: Year 1 Pro Forma EPS */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 600 }}>
            Year 1 Pro Forma EPS
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: isY1Accretive ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
            {formatPriceINR(y1?.pro_forma_eps)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Baseline: {formatPriceINR(adData.standalone.buyer_eps)}
          </div>
        </div>

        {/* Metric 5: Year 1 A/D */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 600 }}>
            {isFeasible ? 'Year 1 A/D' : 'Illustrative Year 1 A/D'}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: !isFeasible ? 'var(--warning)' : isY1Accretive ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
            {formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}
          </div>
          <div style={{ fontSize: '10px', color: !isFeasible ? 'var(--warning)' : isY1Accretive ? 'var(--positive)' : 'var(--negative)', marginTop: '2px', fontWeight: 600 }}>
            {!isFeasible
              ? isY1Accretive
                ? 'ILLUSTRATIVE (UNFUNDED)'
                : 'DILUTIVE (UNFUNDED)'
              : isY1Accretive
              ? 'ACCRETIVE'
              : 'DILUTIVE'}
          </div>
        </div>

        {/* Metric 6: Year 3 A/D */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 600 }}>
            {isFeasible ? 'Year 3 A/D' : 'Illustrative Year 3 A/D'}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: !isFeasible ? 'var(--warning)' : isY3Accretive ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums', marginTop: '4px' }}>
            {formatSignedPercent(y3?.accretion_dilution_pct, 2, false)}
          </div>
          <div style={{ fontSize: '10px', color: !isFeasible ? 'var(--warning)' : isY3Accretive ? 'var(--positive)' : 'var(--negative)', marginTop: '2px', fontWeight: 600 }}>
            {!isFeasible
              ? isY3Accretive
                ? 'ILLUSTRATIVE (UNFUNDED)'
                : 'DILUTIVE (UNFUNDED)'
              : isY3Accretive
              ? 'ACCRETIVE'
              : 'DILUTIVE'}
          </div>
        </div>

        {/* Metric 7: Break-Even Synergy */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 600 }}>
            Break-Even Synergy
          </div>
          <div
            style={{
              fontSize: isSynergyNotRequired ? '13px' : '20px',
              fontWeight: 700,
              color: isSynergyNotRequired ? 'var(--positive)' : 'var(--warning)',
              fontVariantNumeric: 'tabular-nums',
              marginTop: '4px',
              lineHeight: isSynergyNotRequired ? '26px' : undefined,
            }}
          >
            {isSynergyNotRequired ? 'SYNERGY NOT REQUIRED' : formatCurrencyCr(beGrossY1, 0)}
          </div>
          <div style={{ fontSize: '10px', color: isSynergyNotRequired ? 'var(--positive)' : 'var(--text-muted)', marginTop: '2px' }}>
            {isSynergyNotRequired
              ? 'Already accretive before incremental synergy'
              : `Modeled: ${formatCurrencyCr(adData.synergies.gross_year_1, 0)} · Cushion: ${formatCurrencyCr(adData.synergies.gross_year_1 - beGrossY1, 0)}`}
          </div>
        </div>
      </div>

      {/* 2. Executive Deal View & Deterministic Interpretation */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-xs)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Executive Deal Structure & Strategic Diagnosis
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Funding Status:</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isFeasible ? 'var(--positive)' : 'var(--negative)',
                background: isFeasible ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-xs)',
                border: `1px solid ${isFeasible ? 'var(--positive)' : 'var(--negative)'}`,
              }}
            >
              {isFeasible ? 'EXECUTABLE' : 'INFEASIBLE (UNFUNDED)'}
            </span>
          </div>
        </div>

        {/* Structured Spec Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '8px 16px',
            fontSize: '12px',
            padding: '10px 14px',
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--line)',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Acquirer: </span>
            <strong style={{ color: 'var(--text-primary)' }}>{dealData.acquirer.company_name || dealData.acquirer.company_id}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Target: </span>
            <strong style={{ color: 'var(--text-primary)' }}>{dealData.target.company_name || dealData.target.company_id}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Premium: </span>
            <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatPercent(premiumPct, 1, false)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Transaction EV: </span>
            <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.transaction.transaction_enterprise_value, 0)}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Financing Mix: </span>
            <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {dealData.financing.cash_pct}% C / {dealData.financing.debt_pct}% D / {dealData.financing.stock_pct}% S
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Annual Run-Rate Synergies: </span>
            <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyCr(dealData.synergies.annual_run_rate, 0)}</strong>
          </div>
        </div>

        {/* Deterministic Executive Assessment Box */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-xs)',
            background: narrative.type === 'positive'
              ? 'rgba(34, 197, 94, 0.06)'
              : narrative.type === 'warning'
              ? 'rgba(245, 158, 11, 0.06)'
              : 'rgba(239, 68, 68, 0.06)',
            borderLeft: `3px solid ${
              narrative.type === 'positive'
                ? 'var(--positive)'
                : narrative.type === 'warning'
                ? 'var(--warning)'
                : 'var(--negative)'
            }`,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: narrative.type === 'positive'
                ? 'var(--positive)'
                : narrative.type === 'warning'
                ? 'var(--warning)'
                : 'var(--negative)',
            }}
          >
            {narrative.highlight}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: 'var(--text-body)',
              lineHeight: 1.5,
            }}
          >
            {narrative.statement}
          </p>
        </div>
      </div>
    </section>
  );
};
