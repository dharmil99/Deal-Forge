import React, { useState } from 'react';
import type { CompanyFinancialRow } from '@/types/api';
import { formatCurrencyCr } from '@/utils/formatters';

export interface CapitalStructureChartProps {
  financials: CompanyFinancialRow[];
  height?: number;
}

export const CapitalStructureChart: React.FC<CapitalStructureChartProps> = ({
  financials,
  height = 200,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Take recent 5-7 years
  const sorted = [...financials].sort((a, b) => a.fiscal_year - b.fiscal_year).slice(-7);

  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
        No balance sheet capital structure data available.
      </div>
    );
  }

  const maxVal = Math.max(
    ...sorted.map((r) => Math.max(r.total_debt || 0, r.cash || 0, Math.abs(r.net_debt_derived || 0))),
    1000
  );

  const svgWidth = 600;
  const svgHeight = height;
  const padding = { top: 20, right: 20, bottom: 35, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const step = plotWidth / sorted.length;
  const barWidth = Math.min(18, (step - 8) / 3);

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block', minWidth: '460px' }}
      >
        {/* Hairline Gridlines */}
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
                x={padding.left - 8}
                y={y + 3}
                fill="var(--text-muted)"
                fontSize="10px"
                textAnchor="end"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCurrencyCr(maxVal * ratio, 0, false)}
              </text>
            </g>
          );
        })}

        {/* Grouped bars per year: Borrowings, Cash, Net Debt */}
        {sorted.map((r, idx) => {
          const center = padding.left + idx * step + step / 2;
          const debtH = Math.max(0, (r.total_debt || 0) / maxVal) * plotHeight;
          const cashH = Math.max(0, (r.cash || 0) / maxVal) * plotHeight;
          const netDebtVal = r.net_debt_derived || 0;
          const netDebtH = Math.max(0, Math.abs(netDebtVal) / maxVal) * plotHeight;
          const isNetCash = netDebtVal < 0;

          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={r.fiscal_year}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {isHovered && (
                <rect
                  x={padding.left + idx * step}
                  y={padding.top}
                  width={step}
                  height={plotHeight}
                  fill="rgba(255, 255, 255, 0.03)"
                />
              )}

              {/* Borrowings (Red/Amber) */}
              <rect
                x={center - barWidth * 1.5 - 2}
                y={padding.top + plotHeight - debtH}
                width={barWidth}
                height={debtH}
                fill="#EF4444"
                opacity={0.85}
                rx={1}
              >
                <title>{`Borrowings: ${formatCurrencyCr(r.total_debt)}`}</title>
              </rect>

              {/* Cash (Green) */}
              <rect
                x={center - barWidth * 0.5}
                y={padding.top + plotHeight - cashH}
                width={barWidth}
                height={cashH}
                fill="#10B981"
                opacity={0.85}
                rx={1}
              >
                <title>{`Cash: ${formatCurrencyCr(r.cash)}`}</title>
              </rect>

              {/* Net Debt / Cash (Blue if Net Debt, Positive Teal if Net Cash) */}
              <rect
                x={center + barWidth * 0.5 + 2}
                y={padding.top + plotHeight - netDebtH}
                width={barWidth}
                height={netDebtH}
                fill={isNetCash ? 'var(--positive)' : 'var(--focus)'}
                opacity={0.85}
                rx={1}
              >
                <title>{`Net Debt: ${formatCurrencyCr(netDebtVal)} (${isNetCash ? 'Net Cash Position' : 'Net Debt'})`}</title>
              </rect>

              {/* Year label */}
              <text
                x={center}
                y={padding.top + plotHeight + 14}
                fill={isHovered ? 'var(--text-primary)' : 'var(--text-body)'}
                fontSize="10px"
                fontWeight={isHovered ? 600 : 400}
                textAnchor="middle"
                fontFamily="var(--font-family)"
              >
                FY{r.fiscal_year}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
