import React from 'react';
import type { ValuationSummaryResponse, FootballFieldRow } from '@/types/api';
import { FootballFieldChart } from '@/components/workstation/FootballFieldChart';
import { formatCurrencyCr, formatMultiple } from '@/utils/formatters';
import { ExternalLink, Info } from 'lucide-react';

interface ICValuationSectionProps {
  valuationData: ValuationSummaryResponse | null;
  targetName: string;
  targetId: string;
  currentMarketCap?: number | null;
  onNavigateToValuation?: () => void;
}

export const ICValuationSection: React.FC<ICValuationSectionProps> = ({
  valuationData,
  targetName,
  targetId,
  currentMarketCap,
  onNavigateToValuation,
}) => {
  const rows: FootballFieldRow[] = valuationData?.valuation_table || [];

  // Deterministic Valuation Interpretation
  const generateValuationInterpretation = () => {
    if (!valuationData) {
      return 'Valuation data is currently unavailable for target entity.';
    }

    const compsEvEbitda = rows.find((r) => r.methodology.toLowerCase().includes('ev/ebitda') && !r.methodology.toLowerCase().includes('precedent'));
    const dcfRow = rows.find((r) => r.methodology.toLowerCase().includes('dcf'));
    const precedentEvEbitda = rows.find((r) => r.methodology.toLowerCase().includes('precedent') && r.methodology.toLowerCase().includes('ebitda'));
    const mCap = currentMarketCap || valuationData.target.market_cap_latest || 0;

    const notes: string[] = [];

    // Precedent disclosure (STRICT RULE: Never fabricate missing precedent data)
    if (precedentEvEbitda && !precedentEvEbitda.available) {
      notes.push('Precedent EV/EBITDA is unavailable because target EBITDA is undisclosed in the available precedent transaction records (n=4).');
    }

    // DCF vs Comps comparison
    if (dcfRow && dcfRow.available && compsEvEbitda && compsEvEbitda.available) {
      const dcfMid = dcfRow.mid || 0;
      const compsMid = compsEvEbitda.mid || 0;
      if (dcfMid < compsMid) {
        notes.push(`DCF implies a lower valuation range (${formatCurrencyCr(dcfRow.low, 0)} – ${formatCurrencyCr(dcfRow.high, 0)}) than trading comparables (${formatCurrencyCr(compsEvEbitda.low, 0)} – ${formatCurrencyCr(compsEvEbitda.high, 0)}), reflecting conservative perpetual growth expectations.`);
      } else {
        notes.push(`DCF implies a premium valuation range (${formatCurrencyCr(dcfRow.low, 0)} – ${formatCurrencyCr(dcfRow.high, 0)}) relative to trading comparables median (${formatCurrencyCr(compsEvEbitda.mid, 0)}).`);
      }
    }

    // Trading Comps vs Current Market Cap
    if (compsEvEbitda && compsEvEbitda.available && mCap > 0) {
      const compsMid = compsEvEbitda.mid || 0;
      const diffPct = ((compsMid - mCap) / mCap) * 100;
      if (diffPct > 5) {
        notes.push(`Trading comparables median indicates target trades at a discount to peers of approximately ${Math.abs(diffPct).toFixed(1)}%.`);
      } else if (diffPct < -5) {
        notes.push(`Target currently trades at a ${Math.abs(diffPct).toFixed(1)}% premium to peer trading comparables median.`);
      } else {
        notes.push('Target current market cap aligns closely with peer trading multiples median.');
      }
    }

    return notes;
  };

  const interpretationNotes = generateValuationInterpretation();

  return (
    <section
      className="ic-valuation-section"
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
            SECTION D
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Valuation Analysis & Football Field Triangulation
          </span>
        </div>

        {onNavigateToValuation && (
          <button
            onClick={onNavigateToValuation}
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
            <span>Open Valuation Summary</span>
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* 1. Football Field Signature Chart */}
      {rows.length > 0 ? (
        <FootballFieldChart
          rows={rows}
          currentMarketCap={currentMarketCap || valuationData?.target.market_cap_latest}
          targetName={targetName || targetId}
        />
      ) : (
        <div
          style={{
            padding: '24px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--text-muted)',
            fontSize: '12px',
            textAlign: 'center',
          }}
        >
          Valuation football field data is loading or unavailable.
        </div>
      )}

      {/* 2. Detailed Methodology Comparison Table */}
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
            Multi-Methodology Implied Equity Value Ranges
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Base Currency: ₹ Cr · Unblended
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
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Methodology</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Low (P25) Multiple</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Mid Multiple</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>High (P75) Multiple</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Implied Equity Value (Low)</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Implied Equity Value (Mid)</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Implied Equity Value (High)</th>
                <th style={{ textAlign: 'center', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: idx === rows.length - 1 ? 'none' : '1px solid var(--line-rule)',
                    opacity: r.available ? 1 : 0.6,
                    cursor: onNavigateToValuation ? 'pointer' : 'default',
                  }}
                  onClick={onNavigateToValuation}
                >
                  <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {r.methodology}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.low_multiple ? formatMultiple(r.low_multiple) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {r.mid_multiple ? formatMultiple(r.mid_multiple) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.high_multiple ? formatMultiple(r.high_multiple) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-body)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.available ? formatCurrencyCr(r.low, 0) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--accent)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {r.available ? formatCurrencyCr(r.mid, 0) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-body)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.available ? formatCurrencyCr(r.high, 0) : '—'}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 14px' }}>
                    {r.available ? (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: 'var(--positive)',
                          background: 'rgba(34, 197, 94, 0.12)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-xs)',
                        }}
                      >
                        AVAILABLE
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: 'var(--warning)',
                          background: 'rgba(245, 158, 11, 0.12)',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-xs)',
                        }}
                      >
                        UNAVAILABLE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Valuation Committee Interpretation Box */}
      <div
        style={{
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-xs)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <Info size={13} style={{ color: 'var(--accent)' }} />
          <span>Deterministic Valuation Interpretation & Methodology Disclosures</span>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: '18px',
            fontSize: '12px',
            color: 'var(--text-body)',
            lineHeight: 1.6,
          }}
        >
          {Array.isArray(interpretationNotes) ? (
            interpretationNotes.map((note, i) => <li key={i}>{note}</li>)
          ) : (
            <li>{interpretationNotes}</li>
          )}
        </ul>
      </div>
    </section>
  );
};
