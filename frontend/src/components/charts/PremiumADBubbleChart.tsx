import React, { useState, useRef } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { formatCurrencyCr, formatPercent, formatSignedPercent } from '@/utils/formatters';

export interface DealBubbleData {
  id: string;
  buyerId: string;
  buyerName?: string;
  targetId: string;
  targetName?: string;
  premiumPct: number; // e.g. 20
  year1ADPct: number | null; // e.g. 15.2 or -16.5
  transactionEV: number | null; // in Rs Cr
  synergiesCr: number | null;
  isFeasible: boolean | null;
  isAvailable: boolean | null;
}

export interface PremiumADBubbleChartProps {
  deals: DealBubbleData[];
  highlightedDealId?: string | null;
  onHoverDeal?: (id: string | null) => void;
  onSelectDeal?: (id: string) => void;
  height?: number;
}

export const PremiumADBubbleChart: React.FC<PremiumADBubbleChartProps> = ({
  deals,
  highlightedDealId,
  onHoverDeal,
  onSelectDeal,
  height = 360,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDeal, setHoveredDeal] = useState<DealBubbleData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filter valid deals that have at least premium and Y1 A/D
  const validDeals = deals.filter(
    (d) => typeof d.premiumPct === 'number' && !isNaN(d.premiumPct) && d.year1ADPct !== null && !isNaN(d.year1ADPct)
  );

  if (validDeals.length === 0) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
          fontSize: '12px',
          gap: '8px',
        }}
      >
        <span>Insufficient data to render Premium vs Accretion / Dilution bubble chart.</span>
        <span style={{ fontSize: '11px', color: 'var(--text-label)' }}>
          Modeled deals require active financial statement coverage.
        </span>
      </div>
    );
  }

  // Determine coordinate bounds
  const xValues = validDeals.map((d) => d.premiumPct);
  const yValues = validDeals.map((d) => d.year1ADPct as number);

  // X axis bounds (Premium %)
  let minX = Math.min(...xValues, 0);
  let maxX = Math.max(...xValues, 35);
  const padX = Math.max((maxX - minX) * 0.15, 5);
  minX = Math.max(0, Math.floor(minX - padX));
  maxX = Math.ceil(maxX + padX);

  // Y axis bounds (A/D %)
  let minY = Math.min(...yValues, -10);
  let maxY = Math.max(...yValues, 20);
  const padY = Math.max((maxY - minY) * 0.2, 5);
  minY = Math.floor(minY - padY);
  maxY = Math.ceil(maxY + padY);

  // EV scale for bubble radii (min 16px, max 36px)
  const evValues = validDeals.map((d) => d.transactionEV || 50000);
  const minEV = Math.min(...evValues);
  const maxEV = Math.max(...evValues);

  const getRadius = (ev: number | null) => {
    if (ev == null || ev <= 0) return 18;
    if (maxEV === minEV) return 24;
    const norm = (Math.sqrt(ev) - Math.sqrt(minEV)) / (Math.sqrt(maxEV) - Math.sqrt(minEV) || 1);
    return 16 + norm * 20;
  };

  const svgWidth = 800;
  const svgHeight = height;
  const padding = { top: 30, right: 35, bottom: 45, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const scaleX = (val: number) => padding.left + ((val - minX) / (maxX - minX)) * plotWidth;
  const scaleY = (val: number) => padding.top + ((maxY - val) / (maxY - minY)) * plotHeight;

  // Horizontal 0% Neutral parity line position
  const zeroY = scaleY(0);

  // Generate grid ticks
  const xStep = Math.max(5, Math.round((maxX - minX) / 6 / 5) * 5);
  const xTicks: number[] = [];
  for (let x = Math.ceil(minX / 5) * 5; x <= maxX; x += xStep) {
    xTicks.push(x);
  }

  const yStep = Math.max(5, Math.round((maxY - minY) / 6 / 5) * 5);
  const yTicks: number[] = [];
  for (let y = Math.ceil(minY / 5) * 5; y <= maxY; y += yStep) {
    yTicks.push(y);
  }

  const handleMouseEnter = (deal: DealBubbleData, e: React.MouseEvent) => {
    setHoveredDeal(deal);
    onHoverDeal?.(deal.id);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredDeal(null);
    onHoverDeal?.(null);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Chart Legend & Visual Semantics */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.25)',
                border: '1.5px solid var(--positive)',
                display: 'inline-block',
              }}
            />
            <span>Accretive (&gt; 0%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1.5px solid var(--negative)',
                display: 'inline-block',
              }}
            />
            <span>Dilutive (&lt; 0%)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.25)',
                border: '1.5px solid var(--warning)',
                display: 'inline-block',
              }}
            />
            <span>Infeasible / Deficit</span>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-label)', fontVariantNumeric: 'tabular-nums' }}>
          Bubble Size = <strong>Transaction EV (₹ Cr)</strong>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
      >
        {/* Shaded Accretive Zone (> 0%) */}
        {zeroY > padding.top && (
          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={Math.max(0, zeroY - padding.top)}
            fill="rgba(34, 197, 94, 0.03)"
          />
        )}

        {/* Shaded Dilutive Zone (< 0%) */}
        {zeroY < svgHeight - padding.bottom && (
          <rect
            x={padding.left}
            y={zeroY}
            width={plotWidth}
            height={Math.max(0, svgHeight - padding.bottom - zeroY)}
            fill="rgba(239, 68, 68, 0.03)"
          />
        )}

        {/* Horizontal Grid lines */}
        {yTicks.map((yVal) => {
          const yPos = scaleY(yVal);
          return (
            <g key={`y-${yVal}`}>
              <line
                x1={padding.left}
                y1={yPos}
                x2={svgWidth - padding.right}
                y2={yPos}
                stroke="var(--line-rule)"
                strokeDasharray="2 3"
              />
              <text
                x={padding.left - 8}
                y={yPos + 4}
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily="var(--font-family)"
                textAnchor="end"
                fontVariant="tabular-nums"
              >
                {formatSignedPercent(yVal, 0, false)}
              </text>
            </g>
          );
        })}

        {/* Vertical Grid lines */}
        {xTicks.map((xVal) => {
          const xPos = scaleX(xVal);
          return (
            <g key={`x-${xVal}`}>
              <line
                x1={xPos}
                y1={padding.top}
                x2={xPos}
                y2={svgHeight - padding.bottom}
                stroke="var(--line-rule)"
                strokeDasharray="2 3"
              />
              <text
                x={xPos}
                y={svgHeight - padding.bottom + 16}
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily="var(--font-family)"
                textAnchor="middle"
                fontVariant="tabular-nums"
              >
                {formatPercent(xVal, { isRatio: false, decimals: 0 })}
              </text>
            </g>
          );
        })}

        {/* 0% Neutral Reference Parity Line */}
        {zeroY >= padding.top && zeroY <= svgHeight - padding.bottom && (
          <g>
            <line
              x1={padding.left}
              y1={zeroY}
              x2={svgWidth - padding.right}
              y2={zeroY}
              stroke="var(--line-strong)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <rect
              x={svgWidth - padding.right - 92}
              y={zeroY - 9}
              width="90"
              height="16"
              fill="var(--bg-elevated)"
              stroke="var(--line-strong)"
              rx="2"
            />
            <text
              x={svgWidth - padding.right - 47}
              y={zeroY + 3}
              fill="var(--text-primary)"
              fontSize="9"
              fontWeight="600"
              fontFamily="var(--font-family)"
              textAnchor="middle"
            >
              0.0% Neutral Parity
            </text>
          </g>
        )}

        {/* Axis Labels */}
        <text
          x={padding.left + plotWidth / 2}
          y={svgHeight - 10}
          fill="var(--text-muted)"
          fontSize="11"
          fontWeight="500"
          fontFamily="var(--font-family)"
          textAnchor="middle"
        >
          Acquisition Premium (%)
        </text>

        <text
          x={-((padding.top + plotHeight / 2))}
          y={16}
          fill="var(--text-muted)"
          fontSize="11"
          fontWeight="500"
          fontFamily="var(--font-family)"
          textAnchor="middle"
          transform="rotate(-90)"
        >
          Year 1 Accretion / Dilution (%)
        </text>

        {/* Render Bubbles for Selected Deals */}
        {validDeals.map((deal) => {
          const cx = scaleX(deal.premiumPct);
          const cy = scaleY(deal.year1ADPct as number);
          const r = getRadius(deal.transactionEV);
          const isSelected = highlightedDealId === deal.id;
          const isHovered = hoveredDeal?.id === deal.id;

          // Determine semantic palette
          const isFeasible = deal.isFeasible !== false;
          const isAccretive = (deal.year1ADPct as number) > 0;

          let strokeColor = isAccretive ? 'var(--positive)' : 'var(--negative)';
          let fillColor = isAccretive ? 'rgba(34, 197, 94, 0.28)' : 'rgba(239, 68, 68, 0.28)';

          if (!isFeasible) {
            strokeColor = 'var(--warning)';
            fillColor = 'rgba(245, 158, 11, 0.28)';
          }

          const opacity = highlightedDealId && !isSelected ? 0.4 : 1.0;

          return (
            <g
              key={deal.id}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => onSelectDeal?.(deal.id)}
              onMouseEnter={(e) => handleMouseEnter(deal, e)}
              onMouseLeave={handleMouseLeave}
            >
              {/* Outer Selection Highlight Ring */}
              {(isSelected || isHovered) && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 6}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
              )}

              {/* Main Bubble */}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected || isHovered ? '2.5' : '1.5'}
                strokeDasharray={!isFeasible ? '4 2' : undefined}
                opacity={opacity}
              />

              {/* Counterparty Text Label */}
              <text
                x={cx}
                y={!isFeasible && r > 20 ? cy - 2 : cy + 4}
                fill="var(--text-primary)"
                fontSize={r > 24 ? '11' : '10'}
                fontWeight="600"
                fontFamily="var(--font-family)"
                textAnchor="middle"
                opacity={opacity}
                pointerEvents="none"
              >
                {deal.buyerId} → {deal.targetId}
              </text>
              {!isFeasible && r > 20 && (
                <text
                  x={cx}
                  y={cy + 10}
                  fill="var(--warning)"
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="var(--font-family)"
                  textAnchor="middle"
                  opacity={opacity}
                  pointerEvents="none"
                >
                  [Infeasible]
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Institutional Interactive Tooltip */}
      {hoveredDeal && (
        <ChartTooltip
          visible={true}
          x={tooltipPos.x}
          y={tooltipPos.y}
          title={`${hoveredDeal.buyerName || hoveredDeal.buyerId} → ${hoveredDeal.targetName || hoveredDeal.targetId}`}
          subtitle="Modeled Acquisition Analysis"
          rows={[
            {
              label: 'Acquisition Premium',
              value: formatPercent(hoveredDeal.premiumPct, { isRatio: false, decimals: 1 }),
            },
            {
              label: 'Year 1 Accretion / Dilution',
              value: `${formatSignedPercent(hoveredDeal.year1ADPct, 1, false)}${
                hoveredDeal.isFeasible === false ? ' (Illustrative Structure)' : ''
              }`,
              bold: true,
            },
            {
              label: 'Transaction EV',
              value: formatCurrencyCr(hoveredDeal.transactionEV),
            },
            {
              label: 'Cost Synergies',
              value: formatCurrencyCr(hoveredDeal.synergiesCr),
            },
            {
              label: 'Funding Feasibility',
              value:
                hoveredDeal.isFeasible === false
                  ? 'INFEASIBLE (Cash Deficit)'
                  : hoveredDeal.isAvailable === false
                  ? 'DATA UNAVAILABLE'
                  : 'EXECUTABLE',
              color:
                hoveredDeal.isFeasible === false
                  ? 'var(--warning)'
                  : hoveredDeal.isAvailable === false
                  ? 'var(--neutral)'
                  : 'var(--positive)',
            },
          ]}
        />
      )}
    </div>
  );
};
