import React from 'react';
import type { BreakEvenSynergyDetail } from '@/types/api';
import { formatCurrencyCr } from '@/utils/formatters';

export interface BreakEvenSynergyChartProps {
  modeledSynergy: number; // e.g. Year 1 gross synergy in ₹ Cr
  breakEvenDetail: BreakEvenSynergyDetail;
  yearLabel?: string;
  isFeasible?: boolean;
}

export const BreakEvenSynergyChart: React.FC<BreakEvenSynergyChartProps> = ({
  modeledSynergy,
  breakEvenDetail,
  yearLabel = 'Year 1',
  isFeasible = true,
}) => {
  const beGross = breakEvenDetail.break_even_gross_synergy ?? 0;
  const isSynergyNotRequired = beGross <= 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Break-Even Synergy Requirement ({yearLabel})
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 'var(--radius-xs)',
            background: isSynergyNotRequired ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isSynergyNotRequired ? 'var(--positive)' : 'var(--negative)',
          }}
        >
          {isSynergyNotRequired ? 'SYNERGY NOT REQUIRED' : 'SYNERGIES REQUIRED FOR PARITY'}
        </span>
      </div>

      {/* Grid of Key Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
        }}
      >
        <div style={{ padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--line-subtle)', borderRadius: 'var(--radius-xs)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Modeled Annual Synergy</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
            {formatCurrencyCr(modeledSynergy, 1)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-label)', marginTop: '2px' }}>Active base-case assumption</div>
        </div>

        <div style={{ padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--line-subtle)', borderRadius: 'var(--radius-xs)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Break-Even Gross Synergy</div>
          <div
            style={{
              fontSize: isSynergyNotRequired ? '13px' : '15px',
              fontWeight: 600,
              color: isSynergyNotRequired ? 'var(--positive)' : 'var(--warning)',
              fontVariantNumeric: 'tabular-nums',
              marginTop: '2px',
            }}
          >
            {isSynergyNotRequired ? 'SYNERGY NOT REQUIRED' : formatCurrencyCr(beGross, 1)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-label)', marginTop: '2px' }}>
            {isSynergyNotRequired
              ? `Math: ${formatCurrencyCr(beGross, 1)} (Neutrality reached)`
              : 'Pre-tax run rate for EPS neutrality'}
          </div>
        </div>

        <div style={{ padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--line-subtle)', borderRadius: 'var(--radius-xs)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Safety Margin / Cushion</div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: isSynergyNotRequired ? 'var(--positive)' : 'var(--negative)',
              fontVariantNumeric: 'tabular-nums',
              marginTop: '2px',
            }}
          >
            {isSynergyNotRequired ? `+${formatCurrencyCr(modeledSynergy, 1)}` : formatCurrencyCr(beGross - modeledSynergy, 1)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-label)', marginTop: '2px' }}>
            {isSynergyNotRequired ? 'Full modeled cushion above parity' : 'Additional synergy required'}
          </div>
        </div>
      </div>

      {/* Visual Safety Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>
            Break-Even Threshold:{' '}
            {isSynergyNotRequired ? `Synergy Not Required (Math: ${formatCurrencyCr(beGross, 1)})` : formatCurrencyCr(beGross, 1)}
          </span>
          <span>Modeled: {formatCurrencyCr(modeledSynergy, 1)}</span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--bg-surface)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
          <div
            style={{
              height: '100%',
              width: isSynergyNotRequired ? '100%' : `${Math.min(100, Math.max(5, (modeledSynergy / (beGross || 1)) * 100))}%`,
              background: isSynergyNotRequired ? 'var(--positive)' : 'var(--warning)',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>

      {/* Context Note */}
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        {isSynergyNotRequired ? (
          <span>
            No incremental synergy is required for EPS neutrality. Target standalone earnings contribution exceeds financing interest and share dilution costs.
            (Mathematical threshold: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyCr(beGross, 1)}</strong>).
            {!isFeasible && (
              <span style={{ display: 'block', color: 'var(--negative)', marginTop: '2px' }}>
                Note: Transaction financing is currently infeasible; earnings figures represent an illustrative capital structure.
              </span>
            )}
          </span>
        ) : (
          <span>
            Transaction is dilutive at current financing mix and standalone earnings contribution. Pre-tax synergies of at least <strong style={{ color: 'var(--warning)' }}>{formatCurrencyCr(beGross, 1)}</strong> are required to achieve EPS neutrality.
          </span>
        )}
      </div>
    </div>
  );
};

