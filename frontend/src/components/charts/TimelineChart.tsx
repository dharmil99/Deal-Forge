import React, { useState, useRef } from 'react';
import { formatCurrencyCr, formatMultiple } from '@/utils/formatters';
import { ChartTooltip, TooltipRow } from './ChartTooltip';

export interface TimelineDealItem {
  id: string;
  date?: string | null;
  target?: string;
  acquirer?: string;
  dealValueCr?: number | null;
  evRevenue?: number | null;
  sector?: string | null;
}

export interface TimelineChartProps {
  deals: TimelineDealItem[];
  height?: number;
  smallSampleWarning?: boolean;
  onSelectDeal?: (deal: TimelineDealItem) => void;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({
  deals,
  height = 200,
  smallSampleWarning = true,
  onSelectDeal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDeal, setHoveredDeal] = useState<TimelineDealItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filter deals with date and dealValueCr
  const validDeals = deals.filter((d) => Boolean(d.date) && d.dealValueCr != null);

  if (validDeals.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '12px' }}>
        No precedent transactions available.
      </div>
    );
  }

  // Sort deals chronologically
  const sorted = [...validDeals].sort(
    (a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()
  );

  const timestamps = sorted.map((d) => new Date(d.date!).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeSpan = maxTime - minTime || 86400000 * 30; // at least 30 days span

  // Deal values
  const values = sorted.map((d) => d.dealValueCr || 0);
  const maxVal = Math.max(...values, 1000);

  const svgWidth = 720;
  const svgHeight = height;
  const padding = { top: 30, right: 40, bottom: 45, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const scaleX = (dateStr?: string | null) => {
    if (!dateStr) return padding.left;
    const t = new Date(dateStr).getTime();
    return padding.left + ((t - minTime) / timeSpan) * plotWidth;
  };

  const scaleY = (val?: number | null) => {
    const v = val || 0;
    return padding.top + plotHeight - (v / maxVal) * plotHeight;
  };

  const tooltipRows: TooltipRow[] = [];
  if (hoveredDeal) {
    tooltipRows.push({ label: 'Deal Value', value: formatCurrencyCr(hoveredDeal.dealValueCr, 1), bold: true });
    if (hoveredDeal.acquirer) {
      tooltipRows.push({ label: 'Acquirer', value: hoveredDeal.acquirer });
    }
    if (hoveredDeal.date) {
      tooltipRows.push({ label: 'Announcement', value: hoveredDeal.date });
    }
    if (hoveredDeal.evRevenue != null) {
      tooltipRows.push({ label: 'EV / Revenue', value: formatMultiple(hoveredDeal.evRevenue) });
    }
    if (hoveredDeal.sector) {
      tooltipRows.push({ label: 'Sector', value: hoveredDeal.sector });
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block', minWidth: '500px' }}
      >
        {/* Baseline Date Axis Line */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke="var(--line-strong)"
          strokeWidth={1}
        />

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

        {/* Deal Stems and Nodes */}
        {sorted.map((deal) => {
          const cx = scaleX(deal.date);
          const cy = scaleY(deal.dealValueCr);
          const isHovered = hoveredDeal?.id === deal.id;

          return (
            <g key={deal.id} onClick={() => onSelectDeal?.(deal)}>
              {/* Vertical Stalk */}
              <line
                x1={cx}
                y1={padding.top + plotHeight}
                x2={cx}
                y2={cy}
                stroke={isHovered ? 'var(--accent-line)' : 'var(--line)'}
                strokeWidth={isHovered ? 2 : 1}
                strokeDasharray={isHovered ? 'none' : '2 2'}
              />

              {/* Deal Node */}
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 7 : 5}
                fill={isHovered ? 'var(--accent-line)' : 'var(--accent)'}
                stroke="#FFFFFF"
                strokeWidth={1.5}
                style={{ cursor: 'pointer', transition: 'r var(--transition-fast)' }}
                onMouseEnter={(e) => {
                  setHoveredDeal(deal);
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
                onMouseLeave={() => setHoveredDeal(null)}
              />

              {/* Target Name Tag */}
              <text
                x={cx}
                y={cy - 9}
                fill={isHovered ? 'var(--text-primary)' : 'var(--text-strong)'}
                fontSize="10px"
                fontWeight={isHovered ? 600 : 500}
                textAnchor="middle"
                fontFamily="var(--font-family)"
              >
                {deal.target ? deal.target.split(' ')[0] : deal.id}
              </text>

              {/* Date on X Axis */}
              <text
                x={cx}
                y={padding.top + plotHeight + 15}
                fill="var(--text-muted)"
                fontSize="9px"
                textAnchor="middle"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {deal.date || '—'}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Small Sample Warning note */}
      {smallSampleWarning && (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--warning)',
            textAlign: 'right',
            marginTop: '4px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          * Precedent sample size: {deals.length} seed transactions (n &lt; 5 limitation active)
        </div>
      )}

      {/* Hover Tooltip */}
      <ChartTooltip
        x={tooltipPos.x}
        y={tooltipPos.y}
        title={hoveredDeal?.target}
        subtitle={hoveredDeal?.id}
        rows={tooltipRows}
        visible={!!hoveredDeal}
        containerWidth={containerRef.current?.clientWidth}
      />
    </div>
  );
};
