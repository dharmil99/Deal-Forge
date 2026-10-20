import React, { useState } from 'react';
import type { CompanyFinancialRow } from '@/types/api';
import { formatCurrencyCr, formatPercent } from '@/utils/formatters';

interface FinancialTrendChartProps {
  financials: CompanyFinancialRow[];
  companyName?: string;
}

export const FinancialTrendChart: React.FC<FinancialTrendChartProps> = ({
  financials,
  companyName,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Sort ascending by fiscal year
  const sorted = [...financials].sort((a, b) => a.fiscal_year - b.fiscal_year);

  if (sorted.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        No historical financial trend data available.
      </div>
    );
  }

  // Max revenue for scaling
  const maxRevenue = Math.max(
    ...sorted.map((r) => r.revenue || 0),
    1000,
  );
  const chartHeight = 160;
  const padding = { top: 20, bottom: 30, left: 60, right: 20 };
  const width = 800; // SVG viewBox width

  const usableWidth = width - padding.left - padding.right;
  const usableHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = Math.min(32, usableWidth / (sorted.length * 2.2));
  const step = usableWidth / sorted.length;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px 20px',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {companyName ? `${companyName} · ` : ''}Operating Financial History (FY{sorted[0]?.fiscal_year} — FY{sorted[sorted.length - 1]?.fiscal_year})
        </span>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--text-body)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', background: 'rgba(59, 130, 246, 0.45)', border: '1px solid #3B82F6', borderRadius: '1px' }} />
            <span>Revenue</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', background: '#2563EB', borderRadius: '1px' }} />
            <span>EBITDA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '2px', background: 'var(--positive)' }} />
            <span>Margin %</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block', minWidth: '600px' }}
        >
          {/* Hairline Gridlines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + usableHeight * (1 - ratio);
            const val = maxRevenue * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="9"
                  fontFamily="Inter, sans-serif"
                >
                  {formatCurrencyCr(val, 0, false)}
                </text>
              </g>
            );
          })}

          {/* Bars and Markers */}
          {sorted.map((row, idx) => {
            const centerX = padding.left + step * idx + step / 2;
            const revHeight = ((row.revenue || 0) / maxRevenue) * usableHeight;
            const ebitdaHeight = ((row.ebitda_derived || 0) / maxRevenue) * usableHeight;
            const revY = padding.top + usableHeight - revHeight;
            const ebitdaY = padding.top + usableHeight - ebitdaHeight;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={row.fiscal_year}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Year hover zone */}
                <rect
                  x={padding.left + step * idx}
                  y={padding.top}
                  width={step}
                  height={usableHeight}
                  fill={isHovered ? 'rgba(255, 255, 255, 0.03)' : 'transparent'}
                />

                {/* Revenue Bar */}
                <rect
                  x={centerX - barWidth}
                  y={revY}
                  width={barWidth - 2}
                  height={revHeight}
                  fill={isHovered ? 'rgba(59, 130, 246, 0.65)' : 'rgba(59, 130, 246, 0.35)'}
                  stroke="rgba(59, 130, 246, 0.8)"
                  strokeWidth="1"
                  rx="1"
                />

                {/* EBITDA Bar */}
                <rect
                  x={centerX + 2}
                  y={ebitdaY}
                  width={barWidth - 2}
                  height={ebitdaHeight}
                  fill={isHovered ? '#1D4ED8' : '#2563EB'}
                  rx="1"
                />

                {/* Year Label */}
                <text
                  x={centerX}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  fill={isHovered ? 'var(--text-primary)' : 'var(--text-muted)'}
                  fontSize="10"
                  fontFamily="Inter, sans-serif"
                  fontWeight={isHovered ? '600' : '400'}
                >
                  FY{row.fiscal_year}
                </text>
              </g>
            );
          })}

          {/* Margin Line connecting all years */}
          {sorted.length > 1 && (
            <path
              d={sorted
                .map((row, idx) => {
                  const centerX = padding.left + step * idx + step / 2;
                  // Map margin (typically 0% to 40%) across height
                  const marginVal = Math.max(0, Math.min(0.5, row.ebitda_margin_derived || 0));
                  const marginY = padding.top + usableHeight * (1 - marginVal / 0.5);
                  return `${idx === 0 ? 'M' : 'L'} ${centerX} ${marginY}`;
                })
                .join(' ')}
              fill="none"
              stroke="var(--positive)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* Margin Dots */}
          {sorted.map((row, idx) => {
            const centerX = padding.left + step * idx + step / 2;
            const marginVal = Math.max(0, Math.min(0.5, row.ebitda_margin_derived || 0));
            const marginY = padding.top + usableHeight * (1 - marginVal / 0.5);
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={`dot-${row.fiscal_year}`}
                cx={centerX}
                cy={marginY}
                r={isHovered ? 4 : 2.5}
                fill={isHovered ? '#FFFFFF' : 'var(--positive)'}
                stroke="var(--bg-base)"
                strokeWidth="1"
              />
            );
          })}
        </svg>

        {/* Hover Detail Card */}
        {hoveredIdx !== null && sorted[hoveredIdx] && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '12px',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-xs)',
              padding: '6px 12px',
              fontSize: '11px',
              fontVariantNumeric: 'tabular-nums',
              display: 'flex',
              gap: '12px',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              FY{sorted[hoveredIdx].fiscal_year}
            </span>
            <span>
              Rev: <strong>{formatCurrencyCr(sorted[hoveredIdx].revenue)}</strong>
            </span>
            <span>
              EBITDA: <strong>{formatCurrencyCr(sorted[hoveredIdx].ebitda_derived)}</strong>
            </span>
            <span>
              Margin:{' '}
              <strong style={{ color: 'var(--positive)' }}>
                {formatPercent(sorted[hoveredIdx].ebitda_margin_derived)}
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
