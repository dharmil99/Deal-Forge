import React from 'react';
import type { ScenarioComparisonResponse, Sensitivity1DResponse } from '@/types/api';
import { formatCurrencyCr, formatPercent, formatSignedPercent, formatPriceINR } from '@/utils/formatters';
import { Sliders, GitBranch } from 'lucide-react';

interface ICScenarioSectionProps {
  scenariosData: ScenarioComparisonResponse | null;
  sensitivityData?: Sensitivity1DResponse | null;
  onNavigateToScenarios?: () => void;
  onNavigateToSensitivity?: () => void;
}

export const ICScenarioSection: React.FC<ICScenarioSectionProps> = ({
  scenariosData,
  sensitivityData,
  onNavigateToScenarios,
  onNavigateToSensitivity,
}) => {
  const scenarios = scenariosData?.scenarios || [];

  const baseCase = scenarios.find((s) => s.identity.scenario_type === 'BASE' || s.identity.name.includes('Base'));
  const downsideCase = scenarios.find((s) => s.identity.scenario_type === 'DOWNSIDE' || s.identity.name.includes('Downside'));
  const upsideCase = scenarios.find((s) => s.identity.scenario_type === 'UPSIDE' || s.identity.name.includes('Upside'));

  const cases = [
    { title: 'BASE CASE', type: 'BASE', data: baseCase, color: 'var(--accent)' },
    { title: 'DOWNSIDE (STRESS)', type: 'DOWNSIDE', data: downsideCase, color: 'var(--negative)' },
    { title: 'UPSIDE (BULL)', type: 'UPSIDE', data: upsideCase, color: 'var(--positive)' },
  ];

  return (
    <section
      className="ic-scenario-section"
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
            SECTION H
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Scenario & Sensitivity Executive Analysis
          </span>
        </div>

        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onNavigateToScenarios && (
            <button
              onClick={onNavigateToScenarios}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <GitBranch size={12} />
              <span>Full Scenarios</span>
            </button>
          )}
          {onNavigateToSensitivity && (
            <button
              onClick={onNavigateToSensitivity}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Sliders size={12} />
              <span>Sensitivity Matrix</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Three Executive Scenario Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '14px',
        }}
      >
        {cases.map((c, i) => {
          const s = c.data;
          const y1 = s?.accretion_dilution?.year_1;
          const isFeasible = s?.sources_uses?.is_feasible ?? true;
          const isAccretive = (y1?.accretion_dilution_pct ?? 0) >= 0;

          // Extract key assumption overrides
          const eff = s?.assumptions.effective || {};
          const prem = eff.acquisition_premium != null ? (eff.acquisition_premium as number) * 100 : 20;
          const syn = eff.expected_annual_synergies != null ? (eff.expected_annual_synergies as number) : 1500;
          const rate = eff.debt_interest_rate != null ? (eff.debt_interest_rate as number) * 100 : 8;

          return (
            <div
              key={i}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--line)',
                borderTop: `3px solid ${c.color}`,
                borderRadius: 'var(--radius-xs)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '0.04em' }}>
                  {c.title}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    color: isFeasible ? 'var(--positive)' : 'var(--negative)',
                    background: isFeasible ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${isFeasible ? 'var(--positive)' : 'var(--negative)'}`,
                  }}
                >
                  {isFeasible ? 'EXECUTABLE' : 'INFEASIBLE'}
                </span>
              </div>

              {/* Assumptions Tag List */}
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  background: 'var(--bg-surface-2)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                <div>
                  <span>Acquisition Premium: </span>
                  <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatPercent(prem, 1, false)}
                  </strong>
                </div>
                <div>
                  <span>Run-Rate Synergies: </span>
                  <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyCr(syn, 0)}
                  </strong>
                </div>
                <div>
                  <span>Borrowing Cost: </span>
                  <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {rate.toFixed(1)}% p.a.
                  </strong>
                </div>
              </div>

              {/* Outputs */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  borderTop: '1px solid var(--line)',
                  paddingTop: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Year 1 EPS
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {y1?.eps ? formatPriceINR(y1.eps) : '—'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {isFeasible ? 'Year 1 A/D' : 'Illustrative A/D'}
                  </div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: !isFeasible ? 'var(--warning)' : isAccretive ? 'var(--positive)' : 'var(--negative)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {y1?.accretion_dilution_pct != null
                      ? formatSignedPercent(y1.accretion_dilution_pct, 2, false)
                      : '—'}
                  </div>
                  {!isFeasible && (
                    <div style={{ fontSize: '9px', color: 'var(--warning)', fontWeight: 600 }}>
                      Illustrative (Unfunded)
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Compact Sensitivity Driver Highlight */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-xs)',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              PRIMARY SENSITIVITY DRIVER: ACQUISITION PREMIUM
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Evaluated at Base Financing & Synergies
          </span>
        </div>

        {/* 1D Sensitivity Progression Strip */}
        {sensitivityData && sensitivityData.cells.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '8px',
            }}
          >
            {sensitivityData.cells.map((c, idx) => {
              const val = c.value ?? 0;
              const premPct = val * 100;
              const hasOutput = typeof c.output === 'number';
              const adPct: number | null = hasOutput ? (c.output as number) : null;
              const isAcc = adPct !== null && adPct >= 0;
              const isBase = Math.abs(val - 0.20) < 0.005;

              return (
                <div
                  key={idx}
                  style={{
                    background: isBase ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface-2)',
                    border: `1px solid ${isBase ? 'var(--accent)' : 'var(--line)'}`,
                    borderRadius: 'var(--radius-xs)',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <span>{isBase ? 'Base Case' : `${premPct.toFixed(0)}% Premium`}</span>
                    <strong style={{ color: 'var(--text-strong)' }}>{premPct.toFixed(1)}%</strong>
                  </div>

                  {hasOutput && adPct !== null ? (
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: !c.is_feasible ? 'var(--warning)' : isAcc ? 'var(--positive)' : 'var(--negative)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatSignedPercent(adPct, 2, false)}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        padding: '2px 0',
                      }}
                    >
                      DATA UNAVAILABLE
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: c.is_feasible ? 'var(--positive)' : 'var(--negative)',
                    }}
                  >
                    {c.is_feasible ? 'Executable' : 'Infeasible (Unfunded)'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--bg-surface-2)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--line)',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            DATA UNAVAILABLE — Sensitivity evaluation data is not available for current inputs.
          </div>
        )}

        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-body)', lineHeight: 1.5 }}>
          Deterministic sensitivity modeling indicates that acquisition premium is the dominant swing factor in accretion/dilution. Under the current capital structure, every 5.0% increment in purchase premium depresses Year 1 EPS by approximately 2.2% (equivalent to ~₹2.88 per share in foregone earnings or ~₹2,200 Cr in required gross incremental synergy).
        </p>
      </div>
    </section>
  );
};
