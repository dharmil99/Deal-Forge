import React, { useState, useRef } from 'react';
import type { CompanyFinancialRow } from '@/types/api';
import { formatCurrencyCr, formatPercent } from '@/utils/formatters';
import { ChartTooltip, TooltipRow } from './ChartTooltip';

export interface DualAxisTrendChartProps {
  financials: CompanyFinancialRow[];
  companyName?: string;
  height?: number;
}

export const DualAxisTrendChart: React.FC<DualAxisTrendChartProps> = ({
  financials,
  companyName,
  height = 240,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const sorted = [...financials].sort((a, b) => a.fiscal_year - b.fiscal_year);

  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '12px' }}>
        No historical financial trend statements available.
      </div>
    );
  }

  // 1. Left scale: Max Revenue & EBITDA in ₹ Cr
  const maxCurrency = Math.max(
    ...sorted.map((r) => Math.max(r.revenue || 0, r.ebitda_derived || 0)),
    1000
  );

  // 2. Right scale: EBITDA Margin in % (typically -10% to 50%)
  const marginValues = sorted
    .map((r) => {
      if (r.ebitda_margin_derived != null) return r.ebitda_margin_derived;
      return r.revenue && r.revenue > 0 && r.ebitda_derived != null
        ? r.ebitda_derived / r.revenue
        : null;
    })
    .filter((v): v is number => v !== null);

  const minMargin = marginValues.length > 0 ? Math.min(0, Math.min(...marginValues) - 0.05) : 0;
  const maxMargin = marginValues.length > 0 ? Math.max(0.3, Math.max(...marginValues) + 0.05) : 0.4;
  const marginRange = maxMargin - minMargin || 0.4;

  const svgWidth = 720;
  const svgHeight = height;
  const padding = { top: 25, right: 60, bottom: 35, left: 65 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const step = plotWidth / sorted.length;
  const barWidth = Math.min(22, (step - 8) / 2);

  const scaleYMargin = (margin: number) => {
    return padding.top + plotHeight - ((margin - minMargin) / marginRange) * plotHeight;
  };

  // Tooltip content
  const hoveredRow = hoveredIdx !== null ? sorted[hoveredIdx] : null;
  const tooltipRows: TooltipRow[] = [];
  if (hoveredRow) {
    const margin =
      hoveredRow.ebitda_margin_derived != null
        ? hoveredRow.ebitda_margin_derived
        : hoveredRow.revenue && hoveredRow.revenue > 0 && hoveredRow.ebitda_derived != null
        ? hoveredRow.ebitda_derived / hoveredRow.revenue
        : null;

    tooltipRows.push({
      label: 'Revenue',
      value: formatCurrencyCr(hoveredRow.revenue, 1),
      color: '#3B82F6',
      bold: true,
    });
    tooltipRows.push({
      label: 'EBITDA',
      value: formatCurrencyCr(hoveredRow.ebitda_derived, 1),
      color: '#2563EB',
      bold: true,
    });
    tooltipRows.push({
      label: 'EBITDA Margin',
      value: formatPercent(margin),
      color: 'var(--positive)',
      bold: true,
    });
    if (hoveredRow.net_income != null) {
      tooltipRows.push({
        label: 'Net Profit',
        value: formatCurrencyCr(hoveredRow.net_income, 1),
      });
    }
  }

  // Margin polyline points
  const marginPoints = sorted.map((r, idx) => {
    const cx = padding.left + idx * step + step / 2;
    const margin =
      r.ebitda_margin_derived != null
        ? r.ebitda_margin_derived
        : r.revenue && r.revenue > 0 && r.ebitda_derived != null
        ? r.ebitda_derived / r.revenue
        : 0;
    const cy = scaleYMargin(margin);
    return { cx, cy, margin, row: r };
  });

  const polylineStr = marginPoints.map((p) => `${p.cx},${p.cy}`).join(' ');

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block', minWidth: '550px' }}
      >
        {/* Hairline Gridlines based on left currency axis */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + plotHeight * (1 - ratio);
          const currVal = maxCurrency * ratio;
          const margVal = minMargin + marginRange * ratio;

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
              {/* Left Y Axis Label: ₹ Cr */}
              <text
                x={padding.left - 8}
                y={y + 3}
                fill="var(--text-muted)"
                fontSize="10px"
                textAnchor="end"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCurrencyCr(currVal, 0, false)}
              </text>

              {/* Right Y Axis Label: Margin % */}
              <text
                x={padding.left + plotWidth + 8}
                y={y + 3}
                fill="var(--text-muted)"
                fontSize="10px"
                textAnchor="start"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatPercent(margVal)}
              </text>
            </g>
          );
        })}

        {/* Bars: Revenue and EBITDA */}
        {sorted.map((r, idx) => {
          const center = padding.left + idx * step + step / 2;
          const revHeight = Math.max(0, (r.revenue || 0) / maxCurrency) * plotHeight;
          const ebHeight = Math.max(0, (r.ebitda_derived || 0) / maxCurrency) * plotHeight;

          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={r.fiscal_year}
              onMouseEnter={(e) => {
                setHoveredIdx(idx);
                if (containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltipPos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }
              }}
              onMouseMove={(e) => {
                if (containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltipPos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }
              }}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Hover column background highlight */}
              {isHovered && (
                <rect
                  x={padding.left + idx * step}
                  y={padding.top}
                  width={step}
                  height={plotHeight}
                  fill="rgba(255, 255, 255, 0.03)"
                />
              )}

              {/* Revenue Bar */}
              <rect
                x={center - barWidth - 1}
                y={padding.top + plotHeight - revHeight}
                width={barWidth}
                height={revHeight}
                fill="rgba(59, 130, 246, 0.55)"
                stroke="#3B82F6"
                strokeWidth={1}
                rx={1}
              />

              {/* EBITDA Bar */}
              <rect
                x={center + 1}
                y={padding.top + plotHeight - ebHeight}
                width={barWidth}
                height={ebHeight}
                fill="#2563EB"
                rx={1}
              />

              {/* Fiscal Year Label */}
              <text
                x={center}
                y={padding.top + plotHeight + 16}
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

        {/* EBITDA Margin Trend Line (Secondary Right Axis) */}
        <polyline
          points={polylineStr}
          fill="none"
          stroke="var(--positive)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Margin Points */}
        {marginPoints.map((p, idx) => (
          <circle
            key={idx}
            cx={p.cx}
            cy={p.cy}
            r={hoveredIdx === idx ? 4.5 : 3}
            fill="#FFFFFF"
            stroke="var(--positive)"
            strokeWidth={2}
          />
        ))}

        {/* Axis Titles */}
        <text
          x={14}
          y={padding.top + plotHeight / 2}
          fill="var(--text-label)"
          fontSize="9px"
          fontWeight="600"
          letterSpacing="0.04em"
          textAnchor="middle"
          transform={`rotate(-90 14 ${padding.top + plotHeight / 2})`}
          fontFamily="var(--font-family)"
        >
          REVENUE & EBITDA (₹ CR) →
        </text>

        <text
          x={svgWidth - 12}
          y={padding.top + plotHeight / 2}
          fill="var(--text-label)"
          fontSize="9px"
          fontWeight="600"
          letterSpacing="0.04em"
          textAnchor="middle"
          transform={`rotate(90 ${svgWidth - 12} ${padding.top + plotHeight / 2})`}
          fontFamily="var(--font-family)"
        >
          EBITDA MARGIN (%) →
        </text>
      </svg>

      {/* Floating Tooltip */}
      <ChartTooltip
        x={tooltipPos.x}
        y={tooltipPos.y}
        title={hoveredRow ? `FY${hoveredRow.fiscal_year} Audited Statements` : undefined}
        subtitle={companyName}
        rows={tooltipRows}
        visible={hoveredIdx !== null}
        containerWidth={containerRef.current?.clientWidth}
      />
    </div>
  );
};
