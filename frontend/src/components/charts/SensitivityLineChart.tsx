import React, { useState, useMemo } from 'react';
import { formatPercent, formatSignedPercent } from '@/utils/formatters';
import { ChartStatusBadge } from './ChartStatusBadge';

export interface Sensitivity1DPoint {
  value: number;
  output: number | null;
  isFeasible: boolean;
  diagnostics?: string[];
}

export interface SensitivityLineChartProps {
  variableLabel: string;
  metricLabel: string;
  points: Sensitivity1DPoint[];
  baseValue?: number;
  selectedVal?: number | null;
  formatVariable?: (val: number) => string;
  formatOutput?: (val: number) => string;
  height?: number;
  onPointSelect?: (point: Sensitivity1DPoint) => void;
}

export const SensitivityLineChart: React.FC<SensitivityLineChartProps> = ({
  variableLabel,
  metricLabel,
  points,
  baseValue,
  selectedVal,
  formatVariable = (v) => formatPercent(v),
  formatOutput = (v) => formatSignedPercent(v, 2, false),
  height = 260,
  onPointSelect,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compute min/max for scale bounds
  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (points.length === 0) {
      return { minX: 0, maxX: 1, minY: -10, maxY: 10 };
    }
    const xVals = points.map((p) => p.value);
    const yVals = points.map((p) => p.output).filter((v): v is number => v !== null);

    const minXVal = Math.min(...xVals);
    const maxXVal = Math.max(...xVals);

    let minYVal = yVals.length > 0 ? Math.min(...yVals) : 0;
    let maxYVal = yVals.length > 0 ? Math.max(...yVals) : 0;

    // Ensure zero is included for A/D % so positive/negative threshold is visible
    if (metricLabel.toLowerCase().includes('a/d') || metricLabel.toLowerCase().includes('accretion')) {
      minYVal = Math.min(minYVal, 0);
      maxYVal = Math.max(maxYVal, 0);
    }

    const yPad = Math.max(Math.abs(maxYVal - minYVal) * 0.15, 1.0);
    return {
      minX: minXVal,
      maxX: maxXVal,
      minY: minYVal - yPad,
      maxY: maxYVal + yPad,
    };
  }, [points, metricLabel]);

  // Chart dimensions in SVG viewBox coordinates
  const svgWidth = 800;
  const svgHeight = height;
  const padding = { top: 30, right: 40, bottom: 40, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const getSvgX = (val: number) => {
    const rangeX = maxX - minX || 1;
    return padding.left + ((val - minX) / rangeX) * plotWidth;
  };

  const getSvgY = (val: number) => {
    const rangeY = maxY - minY || 1;
    return padding.top + plotHeight - ((val - minY) / rangeY) * plotHeight;
  };

  // Generate SVG path for continuous line (skip null values)
  const linePath = useMemo(() => {
    const validPoints = points
      .map((p, idx) => ({ ...p, idx, x: getSvgX(p.value), y: p.output !== null ? getSvgY(p.output) : null }))
      .filter((p): p is typeof p & { y: number } => p.y !== null);

    if (validPoints.length === 0) return '';
    return validPoints.reduce((acc, curr, idx) => {
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x} ${curr.y}`;
    }, '');
  }, [points, minX, maxX, minY, maxY, plotWidth, plotHeight]);

  const zeroY = (minY <= 0 && maxY >= 0) ? getSvgY(0) : null;
  const baseX = baseValue !== undefined ? getSvgX(baseValue) : null;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* SVG Canvas */}
      <div
        style={{
          width: '100%',
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: `${svgHeight}px`, overflow: 'visible' }}
        >
          {/* Subtle Gridlines (Y-axis) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const val = minY + (maxY - minY) * ratio;
            const y = getSvgY(val);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="var(--line-subtle)"
                  strokeDasharray="2 4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-label)"
                  fontFamily="var(--font-family)"
                >
                  {formatOutput(val)}
                </text>
              </g>
            );
          })}

          {/* Zero Line (Accretive / Dilutive Threshold) */}
          {zeroY !== null && (
            <g>
              <line
                x1={padding.left}
                y1={zeroY}
                x2={svgWidth - padding.right}
                y2={zeroY}
                stroke="var(--line-strong)"
                strokeWidth="1.5"
              />
              <text
                x={svgWidth - padding.right + 6}
                y={zeroY + 3}
                fontSize="9"
                fill="var(--text-muted)"
                fontWeight="600"
              >
                0% Neutral
              </text>
            </g>
          )}

          {/* Base Case Vertical Line */}
          {baseX !== null && (
            <g>
              <line
                x1={baseX}
                y1={padding.top}
                x2={baseX}
                y2={svgHeight - padding.bottom}
                stroke="var(--focus)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text
                x={baseX}
                y={padding.top - 8}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="var(--focus)"
              >
                BASE CASE
              </text>
            </g>
          )}

          {/* Main Sensitivity Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--accent-line)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Data Points */}
          {points.map((p, idx) => {
            const cx = getSvgX(p.value);
            const cy = p.output !== null ? getSvgY(p.output) : zeroY ?? padding.top + plotHeight / 2;
            const isBase = baseValue !== undefined && Math.abs(p.value - baseValue) < 1e-4;
            const isSelected = selectedVal !== undefined && selectedVal !== null && Math.abs(p.value - selectedVal) < 1e-4;
            const isHovered = hoveredIdx === idx;
            const isFeasible = p.isFeasible;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => onPointSelect?.(p)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hit target */}
                <circle cx={cx} cy={cy} r="16" fill="transparent" />

                {/* Outer halo if selected or hovered */}
                {(isHovered || isSelected) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isBase ? '12' : '9'}
                    fill="none"
                    stroke={!isFeasible ? 'var(--negative)' : 'var(--focus)'}
                    strokeWidth="2"
                    strokeOpacity="0.5"
                  />
                )}

                {/* Point circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isBase ? '6' : '4.5'}
                  fill={!isFeasible ? 'var(--negative)' : isBase ? 'var(--focus)' : (p.output ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)'}
                  stroke="var(--bg-surface)"
                  strokeWidth="2"
                />

                {/* X-axis tick label */}
                <text
                  x={cx}
                  y={svgHeight - padding.bottom + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="var(--font-family)"
                  fill={isBase ? 'var(--focus)' : 'var(--text-muted)'}
                  fontWeight={isBase || isHovered ? 600 : 400}
                >
                  {formatVariable(p.value)}
                </text>
              </g>
            );
          })}

          {/* X Axis Title */}
          <text
            x={svgWidth / 2}
            y={svgHeight - 4}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="var(--text-primary)"
            letterSpacing="0.04em"
          >
            {variableLabel.toUpperCase()} →
          </text>
        </svg>
      </div>

      {/* Point Hover / Inspection Summary Card */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        (() => {
          const pt = points[hoveredIdx];
          const isBase = baseValue !== undefined && Math.abs(pt.value - baseValue) < 1e-4;
          return (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--line-strong)',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{variableLabel}:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatVariable(pt.value)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{metricLabel}:</span>
                  <strong style={{ color: pt.output !== null && pt.output >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                    {pt.output !== null ? formatOutput(pt.output) : 'N/A (Infeasible)'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Feasibility:</span>
                  <ChartStatusBadge status={pt.isFeasible ? 'EXECUTABLE' : 'INFEASIBLE'} size="sm" />
                </div>
              </div>
              <div style={{ color: isBase ? 'var(--focus)' : 'var(--text-label)', fontSize: '10px' }}>
                {isBase ? '★ Base Case Parameter' : 'Sensitized Evaluation Point'}
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};
