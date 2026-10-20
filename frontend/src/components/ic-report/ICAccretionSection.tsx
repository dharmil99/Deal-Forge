import React, { useMemo } from 'react';
import type { AccretionDilutionResponse } from '@/types/api';
import { WaterfallChart, WaterfallStep } from '@/components/charts/WaterfallChart';
import { MultiYearADChart } from '@/components/charts/MultiYearADChart';
import { formatCurrencyCr, formatPriceINR, formatSignedPercent } from '@/utils/formatters';
import { ExternalLink } from 'lucide-react';

interface ICAccretionSectionProps {
  adData: AccretionDilutionResponse;
  buyerId: string;
  onNavigateToAD?: () => void;
}

export const ICAccretionSection: React.FC<ICAccretionSectionProps> = ({
  adData,
  buyerId,
  onNavigateToAD,
}) => {
  // Helper to safely access years and break_even across year_1 / 1
  const getY = (num: number) =>
    adData.pro_forma.years[`year_${num}`] || adData.pro_forma.years[String(num)];
  const getBE = (num: number) =>
    adData.break_even[`year_${num}`] || adData.break_even[String(num)];

  const y1 = getY(1);
  const y2 = getY(2);
  const y3 = getY(3);

  const be1 = getBE(1);
  const be2 = getBE(2);
  const be3 = getBE(3);

  // Construct Waterfall Steps for Signature Year 1 EPS Bridge
  const epsWaterfallSteps: WaterfallStep[] = useMemo(() => {
    if (!adData || !adData.standalone.buyer_eps || !y1) return [];

    const buyerEps = adData.standalone.buyer_eps;
    const shares = (y1.pro_forma_shares ?? 0) / 10000000; // in Cr shares for unit ratio

    if (shares === 0) return [];

    const targetContribution = (y1.target_net_income ?? 0) / shares;
    const synergyImpact = y1.after_tax_synergy / shares;
    const debtInterestImpact = -(y1.after_tax_debt_interest / shares);
    const foregoneInterestImpact = -(y1.after_tax_foregone_interest / shares);
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
        label: 'After-Tax Synergies',
        value: synergyImpact,
        type: 'add',
        sublabel: `+${formatCurrencyCr(y1.after_tax_synergy, 1)}`,
        formattedValue: `+${formatPriceINR(synergyImpact)}`,
      },
      {
        label: 'New Debt Interest',
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
        label: 'Share Dilution',
        value: shareIssuanceEffect,
        type: shareIssuanceEffect >= 0 ? 'add' : 'subtract',
        sublabel: 'Equity Dilution',
        formattedValue: formatPriceINR(shareIssuanceEffect),
      },
      {
        label: adData.is_feasible ? 'Year 1 Pro Forma EPS' : 'Illustrative Year 1 EPS',
        value: proFormaEps,
        type: 'total',
        sublabel: y1.accretion_dilution_pct ? formatSignedPercent(y1.accretion_dilution_pct, 1, false) : 'Combined',
        formattedValue: formatPriceINR(proFormaEps),
      },
    ];
  }, [adData, buyerId, y1]);

  const renderBreakEvenLabel = (grossBe: number | null | undefined) => {
    if (grossBe == null) return '—';
    if (grossBe <= 0) {
      return (
        <span style={{ color: 'var(--positive)', fontWeight: 600 }}>
          SYNERGY NOT REQUIRED (Already Accretive)
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--warning)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrencyCr(grossBe, 0)} Required
      </span>
    );
  };

  return (
    <section
      className="ic-accretion-section"
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
            SECTION F
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Accretion / Dilution & EPS Impact Analysis
          </span>
        </div>

        {onNavigateToAD && (
          <button
            onClick={onNavigateToAD}
            className="no-print"
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
              padding: '2px 6px',
            }}
          >
            <span>Open Accretion / Dilution Engine</span>
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* 1. Multi-Year EPS Summary Table */}
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
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Multi-Year Earnings Per Share (EPS) Trajectory
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Units: INR (₹) per share · % A/D · ₹ Cr Synergies
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              minWidth: '600px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Horizon / Horizon Case</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Buyer Standalone</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Pro Forma EPS</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>EPS Change (₹)</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Accretion / Dilution (%)</th>
                <th style={{ textAlign: 'center', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Break-Even Gross Synergy</th>
              </tr>
            </thead>
            <tbody>
              {/* Standalone Baseline Row */}
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-body)' }}>Standalone Undisturbed</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatPriceINR(adData.standalone.buyer_eps)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)' }}>—</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)' }}>—</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)' }}>—</td>
                <td style={{ textAlign: 'center', padding: '8px 14px', color: 'var(--text-muted)' }}>BASELINE</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)' }}>—</td>
              </tr>

              {/* Year 1 Row */}
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  Pro Forma Year 1 (33% Synergy Ramp)
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPriceINR(adData.standalone.buyer_eps)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatPriceINR(y1?.pro_forma_eps)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '8px 14px',
                    color: (y1?.eps_change ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                  }}
                >
                  {(y1?.eps_change ?? 0) >= 0 ? '+' : ''}{formatPriceINR(y1?.eps_change)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '8px 14px',
                    color: (y1?.accretion_dilution_pct ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                  }}
                >
                  {formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 14px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: (y1?.accretion_dilution_pct ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                      background: (y1?.accretion_dilution_pct ?? 0) >= 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    {(y1?.accretion_dilution_pct ?? 0) >= 0 ? 'ACCRETIVE' : 'DILUTIVE'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px' }}>
                  {renderBreakEvenLabel(be1?.break_even_gross_synergy)}
                </td>
              </tr>

              {/* Year 2 Row */}
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  Pro Forma Year 2 (67% Synergy Ramp)
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPriceINR(adData.standalone.buyer_eps)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatPriceINR(y2?.pro_forma_eps)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '8px 14px',
                    color: (y2?.eps_change ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                  }}
                >
                  {(y2?.eps_change ?? 0) >= 0 ? '+' : ''}{formatPriceINR(y2?.eps_change)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '8px 14px',
                    color: (y2?.accretion_dilution_pct ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                  }}
                >
                  {formatSignedPercent(y2?.accretion_dilution_pct, 2, false)}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 14px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: (y2?.accretion_dilution_pct ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                      background: (y2?.accretion_dilution_pct ?? 0) >= 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    {(y2?.accretion_dilution_pct ?? 0) >= 0 ? 'ACCRETIVE' : 'DILUTIVE'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px' }}>
                  {renderBreakEvenLabel(be2?.break_even_gross_synergy)}
                </td>
              </tr>

              {/* Year 3 Row */}
              <tr>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  Pro Forma Year 3 (100% Run-Rate Synergy)
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPriceINR(adData.standalone.buyer_eps)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatPriceINR(y3?.pro_forma_eps)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '8px 14px',
                    color: (y3?.eps_change ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                  }}
                >
                  {(y3?.eps_change ?? 0) >= 0 ? '+' : ''}{formatPriceINR(y3?.eps_change)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '8px 14px',
                    color: (y3?.accretion_dilution_pct ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                  }}
                >
                  {formatSignedPercent(y3?.accretion_dilution_pct, 2, false)}
                </td>
                <td style={{ textAlign: 'center', padding: '8px 14px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: (y3?.accretion_dilution_pct ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)',
                      background: (y3?.accretion_dilution_pct ?? 0) >= 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    {(y3?.accretion_dilution_pct ?? 0) >= 0 ? 'ACCRETIVE' : 'DILUTIVE'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px' }}>
                  {renderBreakEvenLabel(be3?.break_even_gross_synergy)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Signature Visual Analytics: EPS Bridge Waterfall & Trajectory */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Waterfall Chart: Step-by-Step EPS Bridge */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Year 1 EPS Bridge / Step-by-Step Waterfall
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Triangulates standalone EPS, target contribution, synergies, financing costs, and share issuance.
          </div>
          <WaterfallChart
            steps={epsWaterfallSteps}
            formatValue={(v) => formatPriceINR(v)}
            unitLabel="₹ per share"
            height={240}
          />
        </div>

        {/* Multi-Year Accretion Trajectory Chart */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Three-Year Pro Forma EPS Trajectory
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Progression of EPS across realization ramp relative to undisturbed buyer baseline.
          </div>
          <MultiYearADChart
            proForma={adData.pro_forma}
            standalone={adData.standalone}
            height={240}
          />
        </div>
      </div>
    </section>
  );
};
