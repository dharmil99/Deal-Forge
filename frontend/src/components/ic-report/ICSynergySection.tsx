import React from 'react';
import type { DealResponse, AccretionDilutionResponse } from '@/types/api';
import { BreakEvenSynergyChart } from '@/components/charts/BreakEvenSynergyChart';
import { formatCurrencyCr } from '@/utils/formatters';

interface ICSynergySectionProps {
  dealData: DealResponse;
  adData: AccretionDilutionResponse;
}

export const ICSynergySection: React.FC<ICSynergySectionProps> = ({
  dealData,
  adData,
}) => {
  const syn = adData.synergies;
  const be1 = adData.break_even['year_1'] || adData.break_even['1'] || {};
  const beGrossY1 = be1.break_even_gross_synergy ?? 0;
  const isSynergyNotRequired = beGrossY1 <= 0;
  const modeledY1 = syn.gross_year_1;
  const cushionY1 = modeledY1 - beGrossY1;

  return (
    <section
      className="ic-synergy-section"
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
            SECTION G
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Synergy Realization & Break-Even Analysis
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Modeled Ramp: 33% (Y1) → 67% (Y2) → 100% (Y3)
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Table 1: Phased Synergy Realization Schedule */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--bg-surface-2)',
              borderBottom: '1px solid var(--line)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-strong)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Phased Synergy Realization Schedule
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Realization Stage</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Ramp %</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Gross Pre-Tax (₹ Cr)</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--accent)', fontWeight: 600 }}>After-Tax (₹ Cr)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>Year 1 Integration</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>33.3%</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(syn.gross_year_1, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(syn.after_tax_year_1, 1)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>Year 2 Maturation</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>66.7%</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(syn.gross_year_2, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(syn.after_tax_year_2, 1)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>Year 3 Steady-State</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>100.0%</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(syn.gross_year_3, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(syn.after_tax_year_3, 1)}
                </td>
              </tr>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 700 }}>Modeled Run-Rate Capacity</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)' }}>Steady State</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {formatCurrencyCr(dealData.synergies.annual_run_rate, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {formatCurrencyCr(dealData.synergies.annual_run_rate * 0.75, 1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 2: Break-Even Synergy Evaluation */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--bg-surface-2)',
              borderBottom: '1px solid var(--line)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-strong)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Year 1 Break-Even Synergy Requirement
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '9px 14px', color: 'var(--text-body)' }}>Modeled Year 1 Gross Synergy</td>
                <td style={{ textAlign: 'right', padding: '9px 14px', color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(modeledY1, 1)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '9px 14px', color: 'var(--text-body)' }}>Mathematical Break-Even Requirement</td>
                <td style={{ textAlign: 'right', padding: '9px 14px', fontVariantNumeric: 'tabular-nums' }}>
                  {isSynergyNotRequired ? (
                    <div>
                      <div style={{ color: 'var(--positive)', fontWeight: 700 }}>
                        SYNERGY NOT REQUIRED
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--positive)' }}>
                        Already accretive before incremental synergy
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: 'var(--warning)', fontWeight: 700 }}>
                        {formatCurrencyCr(beGrossY1, 1)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Assumed: {formatCurrencyCr(modeledY1, 1)} · {cushionY1 >= 0 ? 'Surplus' : 'Shortfall'}: {formatCurrencyCr(Math.abs(cushionY1), 1)}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '9px 14px', color: 'var(--text-body)' }}>Synergy Cushion / (Deficit)</td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '9px 14px',
                    color: isSynergyNotRequired || cushionY1 >= 0 ? 'var(--positive)' : 'var(--negative)',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {isSynergyNotRequired
                    ? 'Full Buffer (Accretive ex-synergy)'
                    : cushionY1 >= 0
                    ? `+${formatCurrencyCr(cushionY1, 1)} Cushion`
                    : `${formatCurrencyCr(cushionY1, 1)} Deficit`}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '9px 14px', color: 'var(--text-body)' }}>Execution Feasibility Assessment</td>
                <td style={{ textAlign: 'right', padding: '9px 14px', color: 'var(--text-strong)', fontWeight: 500 }}>
                  {isSynergyNotRequired
                    ? 'No Synergy Execution Risk on Year 1 EPS'
                    : cushionY1 >= 0
                    ? 'Modeled Synergies Exceed Neutrality Threshold'
                    : 'Synergy Target Fails to Compensate Dilution'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Chart Card */}
      <BreakEvenSynergyChart
        modeledSynergy={syn.gross_year_1}
        breakEvenDetail={be1}
        yearLabel="Year 1"
        isFeasible={adData.is_feasible}
      />
    </section>
  );
};
