import React, { useState } from 'react';

export interface WaterfallStep {
  label: string;
  value: number; // positive or negative
  type: 'start' | 'add' | 'subtract' | 'total';
  sublabel?: string;
  formattedValue?: string;
}

export interface WaterfallChartProps {
  steps: WaterfallStep[];
  formatValue?: (val: number) => string;
  height?: number;
  unitLabel?: string;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  steps,
  formatValue = (v) => v.toFixed(1),
  height = 240,
  unitLabel,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (steps.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '12px' }}>
        No bridge steps available.
      </div>
    );
  }

  // Calculate running cumulative bases
  let running = 0;
  const computedSteps = steps.map((step) => {
    let startVal = running;
    let endVal = running;

    if (step.type === 'start') {
      startVal = 0;
      endVal = step.value;
      running = step.value;
    } else if (step.type === 'total') {
      startVal = 0;
      endVal = running;
    } else {
      // add or subtract
      startVal = running;
      endVal = running + step.value;
      running = endVal;
    }

    return {
      ...step,
      startVal,
      endVal,
      delta: step.value,
      cumulative: running,
    };
  });

  // Calculate Y min and max
  const allLevels = [
    0,
    ...computedSteps.map((s) => s.startVal),
    ...computedSteps.map((s) => s.endVal),
  ];
  const minVal = Math.min(0, Math.min(...allLevels));
  const maxVal = Math.max(...allLevels);
  const range = maxVal - minVal || 1;

  const svgWidth = 820;
  const svgHeight = height;
  const padding = { top: 25, right: 30, bottom: 45, left: 90 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const scaleY = (val: number) => {
    return padding.top + plotHeight - ((val - minVal) / range) * plotHeight;
  };

  const stepWidth = (plotWidth / computedSteps.length) * 0.65;
  const stepSpacing = plotWidth / computedSteps.length;

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: 'auto', display: 'block', minWidth: '550px' }}
      >
        {/* Zero baseline */}
        <line
          x1={padding.left}
          y1={scaleY(0)}
          x2={padding.left + plotWidth}
          y2={scaleY(0)}
          stroke="var(--line-strong)"
          strokeWidth={1}
        />

        {/* Hairline Gridlines */}
        {[0, 0.5, 1].map((ratio) => {
          const val = minVal + range * ratio;
          const y = scaleY(val);
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
                {formatValue(val)}
              </text>
            </g>
          );
        })}

        {/* Steps */}
        {computedSteps.map((step, idx) => {
          const x = padding.left + idx * stepSpacing + (stepSpacing - stepWidth) / 2;
          const yTop = scaleY(Math.max(step.startVal, step.endVal));
          const yBottom = scaleY(Math.min(step.startVal, step.endVal));
          const barHeight = Math.max(2, yBottom - yTop);

          let color = 'var(--accent)';
          if (step.type === 'add') color = 'var(--positive)';
          else if (step.type === 'subtract') color = 'var(--negative)';
          else if (step.type === 'total') color = 'var(--focus)';

          const isHovered = hoveredIdx === idx;

          // Connector line to next step
          const nextStep = computedSteps[idx + 1];
          const hasConnector = nextStep && nextStep.type !== 'total';
          const nextX = padding.left + (idx + 1) * stepSpacing + (stepSpacing - stepWidth) / 2;

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Connector line */}
              {hasConnector && (
                <line
                  x1={x + stepWidth}
                  y1={scaleY(step.endVal)}
                  x2={nextX}
                  y2={scaleY(step.endVal)}
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              )}

              {/* Step bar */}
              <rect
                x={x}
                y={yTop}
                width={stepWidth}
                height={barHeight}
                fill={color}
                opacity={isHovered ? 1.0 : 0.85}
                rx={2}
                stroke={isHovered ? '#FFFFFF' : 'transparent'}
                strokeWidth={1}
                style={{ transition: 'opacity var(--transition-fast)' }}
              />

              {/* Value label */}
              <text
                x={x + stepWidth / 2}
                y={yTop - 5}
                fill={color}
                fontSize="10px"
                fontWeight="600"
                textAnchor="middle"
                fontFamily="var(--font-family)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {step.formattedValue ||
                  (step.delta > 0 && step.type === 'add' ? `+${formatValue(step.delta)}` : formatValue(step.delta))}
              </text>

              {/* Step label on X-axis */}
              <text
                x={x + stepWidth / 2}
                y={padding.top + plotHeight + 14}
                fill={isHovered ? 'var(--text-primary)' : 'var(--text-body)'}
                fontSize={computedSteps.length >= 7 ? '9px' : '9.5px'}
                fontWeight={step.type === 'total' || step.type === 'start' ? 600 : 400}
                textAnchor="middle"
                fontFamily="var(--font-family)"
              >
                {step.label}
              </text>

              {step.sublabel && (
                <text
                  x={x + stepWidth / 2}
                  y={padding.top + plotHeight + 26}
                  fill="var(--text-muted)"
                  fontSize={computedSteps.length >= 7 ? '8px' : '8.5px'}
                  textAnchor="middle"
                  fontFamily="var(--font-family)"
                >
                  {step.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {unitLabel && (
        <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--text-label)', marginTop: '4px' }}>
          Values in {unitLabel}
        </div>
      )}
    </div>
  );
};
