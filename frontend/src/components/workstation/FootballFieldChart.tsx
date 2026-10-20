import React from 'react';
import type { FootballFieldRow } from '@/types/api';
import { formatCurrencyCr, formatMultiple } from '@/utils/formatters';

interface FootballFieldChartProps {
  rows: FootballFieldRow[];
  currentMarketCap?: number | null;
  targetName?: string;
}

export const FootballFieldChart: React.FC<FootballFieldChartProps> = ({
  rows,
  currentMarketCap,
  targetName,
}) => {
  // 1. Calculate min and max range across available rows and current market cap
  const validValues: number[] = [];

  rows.forEach((r) => {
    if (r.available) {
      if (r.low != null && r.low > 0) validValues.push(r.low);
      if (r.mid != null && r.mid > 0) validValues.push(r.mid);
      if (r.high != null && r.high > 0) validValues.push(r.high);
    }
  });

  if (currentMarketCap != null && currentMarketCap > 0) {
    validValues.push(currentMarketCap);
  }

  const minVal = validValues.length > 0 ? Math.min(...validValues) * 0.85 : 0;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) * 1.15 : 1000000;
  const valRange = maxVal - minVal || 1;

  const getPercent = (val: number) => {
    return Math.max(0, Math.min(100, ((val - minVal) / valRange) * 100));
  };

  const marketCapPct = currentMarketCap ? getPercent(currentMarketCap) : null;

  // Generate 5 grid ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const val = minVal + (valRange / (tickCount - 1)) * i;
    return {
      val,
      pct: (i / (tickCount - 1)) * 100,
    };
  });

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        padding: '20px 24px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Chart Header & Reference Info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {targetName ? `${targetName} — ` : ''}Valuation Football Field (Implied Equity Value)
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '12px' }}>
            Base Currency: ₹ Cr · Unblended Methodologies
          </span>
        </div>

        {currentMarketCap != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '2px',
                background: 'var(--warning)',
                borderTop: '1px dashed var(--warning)',
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-body)' }}>
              Current Market Cap: <strong style={{ color: 'var(--warning)' }}>{formatCurrencyCr(currentMarketCap)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Axis Scale Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 1fr 220px',
          gap: '16px',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginBottom: '8px',
          paddingBottom: '6px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div>METHODOLOGY</div>
        <div style={{ position: 'relative', height: '16px' }}>
          {ticks.map((t, idx) => (
            <span
              key={idx}
              style={{
                position: 'absolute',
                left: `${t.pct}%`,
                transform: 'translateX(-50%)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {formatCurrencyCr(t.val, 0)}
            </span>
          ))}
        </div>
        <div style={{ textAlign: 'right' }}>RANGE [P25 — MEDIAN — P75]</div>
      </div>

      {/* Rows Container */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Market Cap Reference Line spanning all rows */}
        {marketCapPct != null && (
          <div
            style={{
              position: 'absolute',
              left: `calc(240px + 16px + (100% - 240px - 220px - 32px) * ${marketCapPct / 100})`,
              top: 0,
              bottom: 0,
              width: '1px',
              borderLeft: '1px dashed var(--warning)',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          />
        )}

        {rows.map((row, idx) => {
          const hasRange = row.available && row.low != null && row.high != null;
          const hasPoint = row.available && row.mid != null && (row.low == null || row.high == null);
          const isAvail = hasRange || hasPoint;

          const leftPct = hasRange ? getPercent(row.low!) : 0;
          const rightPct = hasRange ? getPercent(row.high!) : 0;
          const midPct = row.mid != null ? getPercent(row.mid) : null;
          const widthPct = hasRange ? Math.max(1, rightPct - leftPct) : 0;

          return (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '240px 1fr 220px',
                gap: '16px',
                alignItems: 'center',
                height: '36px',
                padding: '0 8px',
                background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              {/* Methodology Label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: isAvail ? 'var(--text-strong)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={row.methodology}
                >
                  {row.methodology}
                </span>
                {row.mid_multiple != null && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-label)',
                      background: 'var(--bg-surface-2)',
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-xs)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {formatMultiple(row.mid_multiple)}
                  </span>
                )}
              </div>

              {/* Range Bar Area */}
              <div
                style={{
                  position: 'relative',
                  height: '20px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: 'var(--radius-xs)',
                  overflow: 'hidden',
                }}
              >
                {/* Background hairline ticks */}
                {ticks.map((t, tidx) => (
                  <div
                    key={tidx}
                    style={{
                      position: 'absolute',
                      left: `${t.pct}%`,
                      top: 0,
                      bottom: 0,
                      width: '1px',
                      background: 'rgba(255, 255, 255, 0.04)',
                    }}
                  />
                ))}

                {hasRange ? (
                  <>
                    {/* Range Rectangle */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        top: '3px',
                        bottom: '3px',
                        background: 'rgba(37, 99, 235, 0.35)',
                        border: '1px solid var(--accent-line)',
                        borderRadius: '2px',
                        zIndex: 1,
                      }}
                    />

                    {/* Mid / Median Marker */}
                    {midPct != null && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${midPct}%`,
                          top: '1px',
                          bottom: '1px',
                          width: '2px',
                          background: '#FFFFFF',
                          zIndex: 2,
                          transform: 'translateX(-50%)',
                          boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
                        }}
                        title={`Median: ${formatCurrencyCr(row.mid)}`}
                      />
                    )}
                  </>
                ) : hasPoint && midPct != null ? (
                  /* Point Estimate for DCF */
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        left: `${midPct}%`,
                        top: '1px',
                        bottom: '1px',
                        width: '3px',
                        background: 'var(--positive)',
                        zIndex: 2,
                        transform: 'translateX(-50%)',
                        boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)',
                      }}
                      title={`DCF Base Case Intrinsic Value: ${formatCurrencyCr(row.mid)}`}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: `${Math.min(85, Math.max(15, midPct))}%`,
                        top: '2px',
                        fontSize: '10px',
                        color: 'var(--positive)',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 500,
                        transform: 'translateX(-50%)',
                        zIndex: 3,
                        background: 'var(--bg-surface)',
                        padding: '0 4px',
                        borderRadius: '2px',
                      }}
                    >
                      Intrinsic Base: {formatCurrencyCr(row.mid, 0, false)}
                    </div>
                  </>
                ) : (
                  /* Unavailable State indicator */
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                      fontStyle: 'italic',
                    }}
                  >
                    {row.methodology.includes('EBITDA')
                      ? 'DATA UNAVAILABLE — TARGET EBITDA UNDISCLOSED'
                      : 'DATA UNAVAILABLE'}
                  </div>
                )}
              </div>

              {/* Values Column */}
              <div
                style={{
                  textAlign: 'right',
                  fontSize: '12px',
                  fontVariantNumeric: 'tabular-nums',
                  color: isAvail ? 'var(--text-strong)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {hasRange ? (
                  <span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatCurrencyCr(row.low, 0, false)}</span>
                    <span style={{ color: 'var(--line-strong)', margin: '0 4px' }}>—</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyCr(row.mid, 0, false)}</strong>
                    <span style={{ color: 'var(--line-strong)', margin: '0 4px' }}>—</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatCurrencyCr(row.high, 0)}</span>
                  </span>
                ) : hasPoint ? (
                  <strong style={{ color: 'var(--positive)' }}>
                    Base: {formatCurrencyCr(row.mid, 0)}
                  </strong>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>N/A (Disclosed)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
