import React, { useState } from 'react';

export interface DistributionBin {
  label: string;
  count: number;
  highlightedCount?: number;
  rangeDesc?: string;
}

export interface DistributionBarChartProps {
  bins: DistributionBin[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  p25?: number | string;
  median?: number | string;
  p75?: number | string;
  height?: number;
}

export const DistributionBarChart: React.FC<DistributionBarChartProps> = ({
  bins,
  xAxisLabel,
  yAxisLabel = 'Companies',
  p25,
  median,
  p75,
  height = 180,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (bins.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
        No distribution data available.
      </div>
    );
  }

  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  const svgWidth = 600;
  const svgHeight = height;
  const padding = { top: 15, right: 20, bottom: 35, left: 45 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const binWidth = (plotWidth / bins.length) * 0.75;
  const step = plotWidth / bins.length;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Percentiles summary header if present */}
      {(median !== undefined || p25 !== undefined || p75 !== undefined) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '16px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: '8px',
          }}
        >
          {p25 !== undefined && (
            <span>
              P25: <strong style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{p25}</strong>
            </span>
          )}
          {median !== undefined && (
            <span>
              Median: <strong style={{ color: 'var(--focus)', fontVariantNumeric: 'tabular-nums' }}>{median}</strong>
            </span>
          )}
          {p75 !== undefined && (
            <span>
              P75: <strong style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{p75}</strong>
            </span>
          )}
        </div>
      )}

      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Horizontal Hairline Grids */}
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + plotHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + plotWidth}
                y2={y}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth={1}
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                fill="var(--text-muted)"
                fontSize="10px"
                textAnchor="end"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {Math.round(maxCount * ratio)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {bins.map((bin, idx) => {
          const x = padding.left + idx * step + (step - binWidth) / 2;
          const barHeight = (bin.count / maxCount) * plotHeight;
          const y = padding.top + plotHeight - barHeight;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={y}
                width={binWidth}
                height={Math.max(2, barHeight)}
                fill={isHovered ? 'var(--accent-line)' : 'var(--accent)'}
                rx={2}
                opacity={isHovered ? 1.0 : 0.8}
                style={{ transition: 'fill var(--transition-fast)' }}
              />

              {/* Count label above bar */}
              {bin.count > 0 && (
                <text
                  x={x + binWidth / 2}
                  y={y - 4}
                  fill={isHovered ? 'var(--text-primary)' : 'var(--text-muted)'}
                  fontSize="10px"
                  fontWeight={isHovered ? 600 : 400}
                  textAnchor="middle"
                  fontFamily="var(--font-family)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {bin.count}
                </text>
              )}

              {/* Bin label */}
              <text
                x={x + binWidth / 2}
                y={padding.top + plotHeight + 14}
                fill="var(--text-body)"
                fontSize="10px"
                textAnchor="middle"
                fontFamily="var(--font-family)"
              >
                {bin.label}
              </text>
            </g>
          );
        })}

        {/* Axis Labels */}
        {xAxisLabel && (
          <text
            x={padding.left + plotWidth / 2}
            y={svgHeight - 4}
            fill="var(--text-label)"
            fontSize="10px"
            fontWeight="600"
            letterSpacing="0.04em"
            textAnchor="middle"
            fontFamily="var(--font-family)"
          >
            {xAxisLabel.toUpperCase()}
          </text>
        )}

        {yAxisLabel && (
          <text
            x={12}
            y={padding.top + plotHeight / 2}
            fill="var(--text-label)"
            fontSize="9px"
            fontWeight="600"
            letterSpacing="0.04em"
            textAnchor="middle"
            transform={`rotate(-90 12 ${padding.top + plotHeight / 2})`}
            fontFamily="var(--font-family)"
          >
            {yAxisLabel.toUpperCase()}
          </text>
        )}
      </svg>
    </div>
  );
};
