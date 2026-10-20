import React from 'react';
import type { FootballFieldRow } from '@/types/api';
import { formatCurrencyCr } from '@/utils/formatters';

export interface MethodologyComparisonBarProps {
  rows: FootballFieldRow[];
  currentMarketCap?: number | null;
}

export const MethodologyComparisonBar: React.FC<MethodologyComparisonBarProps> = ({
  rows,
  currentMarketCap,
}) => {
  // Collect values to find max scale
  const values: number[] = [];
  rows.forEach((r) => {
    if (r.available && r.mid != null) values.push(r.mid);
  });
  if (currentMarketCap) values.push(currentMarketCap);

  const maxVal = values.length > 0 ? Math.max(...values) * 1.15 : 1000000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {rows.map((r, idx) => {
        const isAvail = r.available && r.mid != null;
        const pct = isAvail ? Math.min(100, (r.mid! / maxVal) * 100) : 0;

        let barColor = 'var(--accent)';
        if (r.methodology.includes('DCF')) barColor = 'var(--positive)';
        else if (r.methodology.includes('Precedents')) barColor = '#8B5CF6';

        return (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr 140px',
              gap: '12px',
              alignItems: 'center',
              fontSize: '11px',
              padding: '4px 0',
            }}
          >
            {/* Methodology Name */}
            <div
              style={{
                color: isAvail ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={r.methodology}
            >
              {r.methodology}
            </div>

            {/* Bar Track */}
            <div
              style={{
                position: 'relative',
                height: '18px',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-xs)',
                overflow: 'hidden',
              }}
            >
              {isAvail ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    background: barColor,
                    opacity: 0.85,
                    borderRadius: '1px',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                  }}
                >
                  UNDISCLOSED IN FILINGS (N/A)
                </div>
              )}

              {/* Dotted Market Cap reference line */}
              {currentMarketCap && isAvail && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.min(100, (currentMarketCap / maxVal) * 100)}%`,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    borderLeft: '1px dashed #F59E0B',
                    zIndex: 2,
                  }}
                />
              )}
            </div>

            {/* Implied Value Output */}
            <div
              style={{
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 600,
                color: isAvail ? 'var(--text-strong)' : 'var(--text-muted)',
              }}
            >
              {isAvail ? formatCurrencyCr(r.mid, 0) : 'N/A'}
            </div>
          </div>
        );
      })}

      {/* Market Cap Reference Row */}
      {currentMarketCap && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr 140px',
            gap: '12px',
            alignItems: 'center',
            fontSize: '11px',
            padding: '6px 0',
            marginTop: '4px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <div style={{ color: '#F59E0B', fontWeight: 600 }}>Current Market Cap</div>
          <div
            style={{
              position: 'relative',
              height: '18px',
              background: 'var(--bg-surface-2)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-xs)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.min(100, (currentMarketCap / maxVal) * 100)}%`,
                background: '#F59E0B',
                opacity: 0.65,
                borderRadius: '1px',
              }}
            />
          </div>
          <div
            style={{
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: '#F59E0B',
            }}
          >
            {formatCurrencyCr(currentMarketCap, 0)}
          </div>
        </div>
      )}
    </div>
  );
};
