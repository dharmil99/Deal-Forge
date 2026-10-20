import React from 'react';
import type { DealResponse, SourcesUsesResponse, AccretionDilutionResponse, ValuationSummaryResponse } from '@/types/api';
import { formatCurrencyCr, formatSignedPercent, formatPercent } from '@/utils/formatters';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface ICRiskSectionProps {
  dealData: DealResponse;
  suData: SourcesUsesResponse;
  adData: AccretionDilutionResponse;
  valuationData: ValuationSummaryResponse | null;
}

interface RiskItem {
  category: string;
  factor: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'CONSIDERATION';
  diagnostic: string;
  implication: string;
}

export const ICRiskSection: React.FC<ICRiskSectionProps> = ({
  dealData,
  suData,
  adData,
  valuationData,
}) => {
  const isFeasible = suData.reconciliation.is_feasible;
  const shortfall = suData.reconciliation.funding_shortfall || 0;
  const y1 = adData.pro_forma.years['year_1'] || adData.pro_forma.years['1'];
  const y1AdPct = y1?.accretion_dilution_pct ?? 0;
  const beGrossY1 = adData.break_even['year_1']?.break_even_gross_synergy ?? adData.break_even['1']?.break_even_gross_synergy ?? 0;
  const premiumPct = (dealData.transaction.acquisition_premium ?? 0.20) * 100;

  // Compile deterministic risks based strictly on engine diagnostics
  const risks: RiskItem[] = [
    // 1. Funding Liquidity Risk
    {
      category: 'Capital Structure',
      factor: 'Financing Liquidity & Cash Feasibility',
      severity: !isFeasible ? 'HIGH' : 'LOW',
      diagnostic: !isFeasible
        ? `Funding shortfall of ${formatCurrencyCr(shortfall)}. Pre-deal cash of ${formatCurrencyCr(suData.cash_reconciliation.pre_deal_acquirer_cash)} is insufficient for ${formatCurrencyCr(suData.requested_financing.acquirer_cash)} cash consideration.`
        : `Available acquirer cash of ${formatCurrencyCr(suData.cash_reconciliation.pre_deal_acquirer_cash)} fully covers cash application of ${formatCurrencyCr(suData.sources.acquirer_cash)}.`,
      implication: !isFeasible
        ? 'Structure cannot be executed as modeled without restructuring to increase debt, equity issuance, or external financing.'
        : 'Transaction is fully funded with no execution cash deficit.',
    },
    // 2. Earnings Accretion & Synergy Realization Risk
    {
      category: 'Earnings Economics',
      factor: 'Year 1 EPS Dilution & Synergy Hurdle',
      severity: y1AdPct < -10 ? 'HIGH' : y1AdPct < 0 ? 'MEDIUM' : 'LOW',
      diagnostic: y1AdPct < 0
        ? `Year 1 EPS is dilutive at ${formatSignedPercent(y1AdPct, 2, false)}. Requires ${formatCurrencyCr(beGrossY1)} in gross annual synergy to achieve break-even neutrality.`
        : `Year 1 EPS is accretive at ${formatSignedPercent(y1AdPct, 2, false)}. Incremental synergy is not required for EPS break-even.`,
      implication: y1AdPct < 0
        ? 'Downside risk to public equity valuation if modeled operational synergies face delayed integration or execution shortfalls.'
        : 'Earnings accretion provides downside cushion against post-closing integration friction.',
    },
    // 3. Acquisition Premium Sizing Risk
    {
      category: 'Transaction Valuation',
      factor: 'Control Premium Over Undisturbed Market',
      severity: premiumPct > 25 ? 'MEDIUM' : 'LOW',
      diagnostic: `Acquisition premium modeled at ${formatPercent(premiumPct, 1, false)} over undisturbed target price.`,
      implication: premiumPct > 25
        ? 'Substantial acquisition premium elevates goodwill creation and expands total enterprise value hurdle required for capital return.'
        : 'Acquisition premium is within disciplined institutional parameters (15%–25%).',
    },
    // 4. Precedent Transactions Data Depth
    {
      category: 'Market Intelligence',
      factor: 'Precedent Dataset Sample Depth',
      severity: 'CONSIDERATION',
      diagnostic: 'Precedent transaction dataset contains 4 sourced records. Target EBITDA was undisclosed in public precedent filings.',
      implication: 'Precedent EV/EBITDA multiple is unavailable; valuation triangulation relies primarily on trading comparables and DCF intrinsic cash flow models.',
    },
    // 5. Valuation Dispersion / DCF Sensitivity
    {
      category: 'Valuation Robustness',
      factor: 'DCF Discount Rate & Growth Sensitivity',
      severity: 'CONSIDERATION',
      diagnostic: valuationData?.dcf
        ? `DCF implies ${formatCurrencyCr(valuationData.dcf.implied_equity_value, 0)} at ${(valuationData.dcf.wacc * 100).toFixed(1)}% WACC and ${(valuationData.dcf.terminal_growth * 100).toFixed(1)}% terminal growth.`
        : 'DCF intrinsic cash flow projections subject to terminal value perpetual growth assumptions.',
      implication: 'Small shifts in WACC (+/- 1.0%) or perpetual growth rate produce material swings in implied equity value.',
    },
  ];

  const getSeverityStyle = (sev: RiskItem['severity']) => {
    switch (sev) {
      case 'HIGH':
        return {
          color: 'var(--negative)',
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'var(--negative)',
          icon: AlertCircle,
        };
      case 'MEDIUM':
        return {
          color: 'var(--warning)',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'var(--warning)',
          icon: AlertTriangle,
        };
      case 'LOW':
        return {
          color: 'var(--positive)',
          bg: 'rgba(34, 197, 94, 0.12)',
          border: 'var(--positive)',
          icon: CheckCircle,
        };
      case 'CONSIDERATION':
      default:
        return {
          color: 'var(--text-muted)',
          bg: 'var(--bg-surface-2)',
          border: 'var(--line)',
          icon: Info,
        };
    }
  };

  return (
    <section
      className="ic-risk-section"
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
            SECTION I
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Key Risks & Committee Considerations
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Audited Model Diagnostics & Structural Risk Audit
        </span>
      </div>

      {/* Structured Risk Grid / Table */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-xs)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              minWidth: '700px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600, width: '130px' }}>Category</th>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600, width: '180px' }}>Risk Factor</th>
                <th style={{ textAlign: 'center', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600, width: '120px' }}>Severity</th>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Deterministic Diagnostic</th>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Committee Consideration</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, idx) => {
                const style = getSeverityStyle(r.severity);
                const IconComponent = style.icon;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: idx === risks.length - 1 ? 'none' : '1px solid var(--line-rule)',
                    }}
                  >
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {r.category}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {r.factor}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '10px',
                          fontWeight: 700,
                          color: style.color,
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                        }}
                      >
                        <IconComponent size={11} />
                        <span>{r.severity}</span>
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-body)', lineHeight: 1.4 }}>
                      {r.diagnostic}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>
                      {r.implication}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
