import React, { useState, useRef } from 'react';
import { ChartTooltip, TooltipRow } from './ChartTooltip';

export interface ScatterPoint {
  id: string;
  name: string;
  ticker?: string | null;
  x: number;
  y: number;
  size?: number;
  category?: string | null;
  metadata?: Record<string, string | number | undefined>;
}

export interface ScatterPlotProps {
  data?: ScatterPoint[];
  points?: ScatterPoint[];
  xAxisLabel?: string;
  xLabel?: string;
  yAxisLabel?: string;
  yLabel?: string;
  formatX?: (val: number) => string;
  xFormatter?: (val: number) => string;
  formatY?: (val: number) => string;
  yFormatter?: (val: number) => string;
  highlightId?: string;
  selectedId?: string;
  onSelectPoint?: (point: ScatterPoint) => void;
  height?: number;
  showQuadrantMedians?: boolean;
  showQuadrantLines?: boolean;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  data,
  points,
  xAxisLabel: rawXLabel,
  xLabel,
  yAxisLabel: rawYLabel,
  yLabel,
  formatX: rawFormatX,
  xFormatter,
  formatY: rawFormatY,
  yFormatter,
  highlightId,
  selectedId,
  onSelectPoint,
  height = 300,
  showQuadrantMedians = true,
  showQuadrantLines,
}) => {
  const allPoints = data || points || [];
  const xAxisLabel = rawXLabel || xLabel || 'X Axis';
  const yAxisLabel = rawYLabel || yLabel || 'Y Axis';
  const formatX = rawFormatX || xFormatter || ((v: number) => `${(v * 100).toFixed(1)}%`);
  const formatY = rawFormatY || yFormatter || ((v: number) => `${(v * 100).toFixed(1)}%`);
  const quadrantLines = showQuadrantLines !== undefined ? showQuadrantLines : showQuadrantMedians;

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filter out invalid numbers
  const validPoints = allPoints.filter(
    (p) => typeof p.x === 'number' && !isNaN(p.x) && typeof p.y === 'number' && !isNaN(p.y)
  );

  if (validPoints.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '12px' }}>
        No scatter plot data points available.
      </div>
    );
  }

  // Calculate bounds with padding
  const xValues = validPoints.map((p) => p.x);
  const yValues = validPoints.map((p) => p.y);

  let minX = Math.min(...xValues);
  let maxX = Math.max(...xValues);
  let minY = Math.min(...yValues);
  let maxY = Math.max(...yValues);

  // Pad by 10%
  const padX = (maxX - minX) * 0.08 || 0.05;
  const padY = (maxY - minY) * 0.08 || 0.05;

  minX -= padX;
  maxX += padX;
  minY = Math.min(0, minY - padY); // usually margin can be near 0 or negative
  maxY += padY;

  // Medians for quadrant guides
  const sortedX = [...xValues].sort((a, b) => a - b);
  const sortedY = [...yValues].sort((a, b) => a - b);
  const medianX = sortedX[Math.floor(sortedX.length / 2)] || 0;
  const medianY = sortedY[Math.floor(sortedY.length / 2)] || 0;

  // Chart coordinates
  const svgWidth = 720;
  const svgHeight = height;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const scaleX = (val: number) => {
    return padding.left + ((val - minX) / (maxX - minX || 1)) * plotWidth;
  };

  const scaleY = (val: number) => {
    return padding.top + plotHeight - ((val - minY) / (maxY - minY || 1)) * plotHeight;
  };

  // Generate 4-5 ticks per axis
  const xTicks = Array.from({ length: 5 }, (_, i) => minX + (i / 4) * (maxX - minX));
  const yTicks = Array.from({ length: 5 }, (_, i) => minY + (i / 4) * (maxY - minY));

  // Tooltip rows
  const tooltipRows: TooltipRow[] = [];
  if (hoveredPoint) {
    tooltipRows.push({ label: xAxisLabel, value: formatX(hoveredPoint.x), bold: true });
    tooltipRows.push({ label: yAxisLabel, value: formatY(hoveredPoint.y), bold: true });
    if (hoveredPoint.category) {
      tooltipRows.push({ label: 'Sector', value: hoveredPoint.category });
    }
    if (hoveredPoint.metadata) {
      Object.entries(hoveredPoint.metadata).forEach(([k, v]) => {
        if (v !== undefined) {
          tooltipRows.push({ label: k, value: String(v) });
        }
      });
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block', minWidth: '500px' }}
      >
        {/* Hairline Gridlines */}
        {xTicks.map((xVal, idx) => {
          const xPos = scaleX(xVal);
          return (
            <line
              key={`xgrid-${idx}`}
              x1={xPos}
              y1={padding.top}
              x2={xPos}
              y2={padding.top + plotHeight}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={1}
            />
          );
        })}

        {yTicks.map((yVal, idx) => {
          const yPos = scaleY(yVal);
          return (
            <line
              key={`ygrid-${idx}`}
              x1={padding.left}
              y1={yPos}
              x2={padding.left + plotWidth}
              y2={yPos}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={1}
            />
          );
        })}

        {/* Quadrant Median Reference Lines */}
        {quadrantLines && (
          <>
            <line
              x1={scaleX(medianX)}
              y1={padding.top}
              x2={scaleX(medianX)}
              y2={padding.top + plotHeight}
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <line
              x1={padding.left}
              y1={scaleY(medianY)}
              x2={padding.left + plotWidth}
              y2={scaleY(medianY)}
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </>
        )}

        {/* Hovered Crosshairs */}
        {hoveredPoint && (
          <>
            <line
              x1={scaleX(hoveredPoint.x)}
              y1={padding.top}
              x2={scaleX(hoveredPoint.x)}
              y2={padding.top + plotHeight}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <line
              x1={padding.left}
              y1={scaleY(hoveredPoint.y)}
              x2={padding.left + plotWidth}
              y2={scaleY(hoveredPoint.y)}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          </>
        )}

        {/* Scatter Points */}
        {validPoints.map((p) => {
          const cx = scaleX(p.x);
          const cy = scaleY(p.y);
          const isHighlighted = p.id === (highlightId || selectedId);
          const isHovered = hoveredPoint?.id === p.id;

          let fill = 'var(--accent-line)';
          let stroke = '#1E3A8A';
          let r = 4;

          if (isHighlighted) {
            fill = '#F59E0B'; // Highlight amber
            stroke = '#FFFFFF';
            r = 7;
          } else if (isHovered) {
            fill = '#FFFFFF';
            stroke = 'var(--accent)';
            r = 6;
          }

          return (
            <g key={p.id}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={isHighlighted || isHovered ? 2 : 1}
                opacity={isHighlighted || isHovered ? 1.0 : hoveredPoint ? 0.4 : 0.8}
                style={{
                  cursor: 'pointer',
                  transition: 'r var(--transition-fast), opacity var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  setHoveredPoint(p);
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
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => onSelectPoint?.(p)}
              />

              {/* Persistent Callout Label for Highlighted Point */}
              {isHighlighted && (
                <text
                  x={cx + 9}
                  y={cy - 4}
                  fill="#FFFFFF"
                  fontSize="10px"
                  fontWeight="600"
                  fontFamily="var(--font-family)"
                >
                  {p.name}
                </text>
              )}
            </g>
          );
        })}

        {/* X Axis & Labels */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke="var(--line)"
          strokeWidth={1}
        />
        {xTicks.map((xVal, idx) => (
          <text
            key={`xtick-${idx}`}
            x={scaleX(xVal)}
            y={padding.top + plotHeight + 16}
            fill="var(--text-muted)"
            fontSize="10px"
            textAnchor="middle"
            fontFamily="var(--font-family)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatX(xVal)}
          </text>
        ))}
        <text
          x={padding.left + plotWidth / 2}
          y={svgHeight - 6}
          fill="var(--text-label)"
          fontSize="10px"
          fontWeight="600"
          letterSpacing="0.04em"
          textAnchor="middle"
          fontFamily="var(--font-family)"
        >
          {xAxisLabel.toUpperCase()} →
        </text>

        {/* Y Axis & Labels */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotHeight}
          stroke="var(--line)"
          strokeWidth={1}
        />
        {yTicks.map((yVal, idx) => (
          <text
            key={`ytick-${idx}`}
            x={padding.left - 8}
            y={scaleY(yVal) + 3}
            fill="var(--text-muted)"
            fontSize="10px"
            textAnchor="end"
            fontFamily="var(--font-family)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatY(yVal)}
          </text>
        ))}
        <text
          x={14}
          y={padding.top + plotHeight / 2}
          fill="var(--text-label)"
          fontSize="10px"
          fontWeight="600"
          letterSpacing="0.04em"
          textAnchor="middle"
          transform={`rotate(-90 14 ${padding.top + plotHeight / 2})`}
          fontFamily="var(--font-family)"
        >
          {yAxisLabel.toUpperCase()} →
        </text>
      </svg>

      {/* Floating Tooltip */}
      <ChartTooltip
        x={tooltipPos.x}
        y={tooltipPos.y}
        title={hoveredPoint?.name}
        subtitle={hoveredPoint?.ticker ? `NSE: ${hoveredPoint.ticker} · ${hoveredPoint.id}` : hoveredPoint?.id}
        rows={tooltipRows}
        visible={!!hoveredPoint}
        containerWidth={containerRef.current?.clientWidth}
      />
    </div>
  );
};
