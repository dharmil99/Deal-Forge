import React, { useState } from 'react';
import type { ADProFormaProjections, ADStandaloneEPS } from '@/types/api';

export interface MultiYearADChartProps {
  proForma: ADProFormaProjections;
  standalone: ADStandaloneEPS;
  height?: number;
}

export const MultiYearADChart: React.FC<MultiYearADChartProps> = ({
  proForma,
  standalone,
  height = 240,
}) => {
  const [hoveredYear, setHoveredYear] = useState<string | null>(null);

  const buyerEps = standalone.buyer_eps || 0;
  const years = [
    { key: 'year_1', label: 'Year 1', data: proForma.years.year_1 },
    { key: 'year_2', label: 'Year 2', data: proForma.years.year_2 },
    { key: 'year_3', label: 'Year 3', data: proForma.years.year_3 },
  ].filter((y) => !!y.data);

  if (years.length === 0 || buyerEps === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '12px' }}>
        Accretion / Dilution projections unavailable.
      </div>
    );
  }

  const allEps = [buyerEps, ...years.map((y) => y.data?.pro_forma_eps || 0)];
  const maxEps = Math.max(...allEps) * 1.15;
  const minEps = Math.max(0, Math.min(...allEps) * 0.85);
  const epsRange = maxEps - minEps || 1;

  const svgWidth = 600;
  const svgHeight = height;
  const padding = { top: 30, right: 30, bottom: 40, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const scaleY = (val: number) => {
    return padding.top + plotHeight - ((val - minEps) / epsRange) * plotHeight;
  };

  const baselineY = scaleY(buyerEps);
  const colWidth = (plotWidth / (years.length + 1)) * 0.65;
  const colSpacing = plotWidth / (years.length + 1);

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block', minWidth: '480px' }}
      >
        {/* Gridlines */}
        {[0, 0.5, 1].map((r) => {
          const val = minEps + epsRange * r;
          const y = scaleY(val);
          return (
            <g key={r}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + plotWidth}
                y2={y}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                fill="var(--text-muted)"
                fontSize="10px"
                textAnchor="end"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                ₹{val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Standalone Baseline Line */}
        <line
          x1={padding.left}
          y1={baselineY}
          x2={padding.left + plotWidth}
          y2={baselineY}
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={padding.left + plotWidth}
          y={baselineY - 5}
          fill="var(--text-label)"
          fontSize="9px"
          textAnchor="end"
          fontFamily="var(--font-family)"
        >
          Baseline: ₹{buyerEps.toFixed(2)}
        </text>

        {/* 1. Standalone Bar */}
        {(() => {
          const x = padding.left + (colSpacing - colWidth) / 2;
          const y = scaleY(buyerEps);
          const barH = padding.top + plotHeight - y;
          return (
            <g>
              <rect
                x={x}
                y={y}
                width={colWidth}
                height={barH}
                fill="var(--bg-surface-3)"
                stroke="var(--line-strong)"
                strokeWidth={1}
                rx={2}
              />
              <text
                x={x + colWidth / 2}
                y={y - 6}
                fill="var(--text-secondary)"
                fontSize="10px"
                fontWeight="600"
                textAnchor="middle"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                ₹{buyerEps.toFixed(2)}
              </text>
              <text
                x={x + colWidth / 2}
                y={padding.top + plotHeight + 14}
                fill="var(--text-muted)"
                fontSize="10px"
                fontWeight="600"
                textAnchor="middle"
                fontFamily="var(--font-family)"
              >
                Standalone
              </text>
            </g>
          );
        })()}

        {/* 2. Projected Years */}
        {years.map((year, idx) => {
          const x = padding.left + (idx + 1) * colSpacing + (colSpacing - colWidth) / 2;
          const proFormaEps = year.data.pro_forma_eps || 0;
          const y = scaleY(proFormaEps);
          const barH = padding.top + plotHeight - y;
          const pct = year.data.accretion_dilution_pct ?? 0;
          const isAccretive = pct >= 0;
          const color = isAccretive ? 'var(--positive)' : 'var(--negative)';
          const isHovered = hoveredYear === year.key;

          return (
            <g
              key={year.key}
              onMouseEnter={() => setHoveredYear(year.key)}
              onMouseLeave={() => setHoveredYear(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={colWidth}
                height={barH}
                fill={color}
                opacity={isHovered ? 1.0 : 0.85}
                stroke={isHovered ? '#FFFFFF' : color}
                strokeWidth={1}
                rx={2}
                style={{ transition: 'opacity var(--transition-fast)' }}
              />

              {/* EPS Number Label */}
              <text
                x={x + colWidth / 2}
                y={y - 18}
                fill="var(--text-primary)"
                fontSize="11px"
                fontWeight="600"
                textAnchor="middle"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                ₹{proFormaEps.toFixed(2)}
              </text>

              {/* Accretion / Dilution Delta Badge */}
              <text
                x={x + colWidth / 2}
                y={y - 6}
                fill={color}
                fontSize="10px"
                fontWeight="600"
                textAnchor="middle"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {year.data.is_feasible === false
                  ? `Ill: ${isAccretive ? '+' : ''}${pct.toFixed(1)}%`
                  : isAccretive
                  ? `+${pct.toFixed(1)}%`
                  : `${pct.toFixed(1)}%`}
              </text>

              {/* Year Label on X-axis */}
              <text
                x={x + colWidth / 2}
                y={padding.top + plotHeight + 14}
                fill={isHovered ? 'var(--text-primary)' : 'var(--text-body)'}
                fontSize="10px"
                fontWeight="600"
                textAnchor="middle"
                fontFamily="var(--font-family)"
              >
                {year.label}
              </text>

              <text
                x={x + colWidth / 2}
                y={padding.top + plotHeight + 25}
                fill={year.data.is_feasible === false ? 'var(--warning)' : 'var(--text-muted)'}
                fontSize="9px"
                fontWeight={year.data.is_feasible === false ? '600' : '400'}
                textAnchor="middle"
                fontFamily="var(--font-family)"
              >
                {year.data.is_feasible === false ? 'ILLUSTRATIVE' : (year.data.modelled_status || year.data.status)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
