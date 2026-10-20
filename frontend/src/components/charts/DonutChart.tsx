import React, { useState } from 'react';

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: DonutSegment[];
  centerLabel?: string;
  selectedId?: string;
  onSelect?: (segment: DonutSegment) => void;
  height?: number;
  innerRadiusRatio?: number;
}

const DEFAULT_PALETTE = [
  '#2563EB', // Primary Accent
  '#3B82F6', // Accent Line
  '#10B981', // Positive Teal/Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#64748B', // Slate
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#A855F7', // Violet
];

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  centerLabel = 'COMPANIES',
  selectedId,
  onSelect,
  height = 220,
  innerRadiusRatio = 0.65,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const total = data.reduce((acc, item) => acc + item.value, 0);

  if (total === 0 || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
        No distribution data available.
      </div>
    );
  }

  const size = height;
  const radius = size / 2 - 12;
  const innerRadius = radius * innerRadiusRatio;
  const cx = size / 2;
  const cy = size / 2;

  // Compute angles
  let currentAngle = -Math.PI / 2; // Start from 12 o'clock
  const segments = data.map((d, idx) => {
    const fraction = d.value / total;
    const angle = fraction * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const color = d.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];

    // SVG arc path
    const isFullCircle = fraction >= 0.9999;
    const largeArcFlag = angle > Math.PI ? 1 : 0;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const x3 = cx + innerRadius * Math.cos(endAngle);
    const y3 = cy + innerRadius * Math.sin(endAngle);
    const x4 = cx + innerRadius * Math.cos(startAngle);
    const y4 = cy + innerRadius * Math.sin(startAngle);

    const pathData = isFullCircle
      ? `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy} M ${cx - innerRadius} ${cy} A ${innerRadius} ${innerRadius} 0 1 1 ${cx + innerRadius} ${cy} A ${innerRadius} ${innerRadius} 0 1 1 ${cx - innerRadius} ${cy} Z`
      : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;

    const pct = Math.round(fraction * 100);

    return {
      ...d,
      color,
      pathData,
      pct,
    };
  });

  const activeSegment = segments.find((s) => s.id === (hoveredId || selectedId));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: '20px',
        flexWrap: 'wrap',
      }}
    >
      {/* SVG Ring */}
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((s) => {
            const isHovered = s.id === (hoveredId || selectedId);
            return (
              <path
                key={s.id}
                d={s.pathData}
                fill={s.color}
                opacity={isHovered ? 1.0 : hoveredId ? 0.45 : 0.85}
                stroke="var(--bg-surface)"
                strokeWidth={2}
                style={{
                  cursor: 'pointer',
                  transition: 'opacity var(--transition-fast), transform var(--transition-fast)',
                }}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onSelect?.(s)}
              />
            );
          })}
        </svg>

        {/* Center Display */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: '12px',
            boxSizing: 'border-box',
          }}
        >
          {activeSegment ? (
            <>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: activeSegment.color,
                  maxWidth: `${innerRadius * 1.5}px`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeSegment.label}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.1,
                  marginTop: '2px',
                }}
              >
                {activeSegment.value}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {activeSegment.pct}% of universe
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.1,
                }}
              >
                {total}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-label)',
                  letterSpacing: '0.06em',
                  marginTop: '3px',
                }}
              >
                {centerLabel}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Institutional Segment Legend */}
      <div
        style={{
          flex: 1,
          minWidth: '180px',
          maxHeight: `${size}px`,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingRight: '6px',
        }}
      >
        {segments.map((s) => {
          const isSelected = s.id === (hoveredId || selectedId);
          return (
            <div
              key={s.id}
              onClick={() => onSelect?.(s)}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                borderRadius: 'var(--radius-xs)',
                background: isSelected ? 'var(--bg-surface-2)' : 'transparent',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)',
                fontSize: '11px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '1px',
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-body)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                  title={s.label}
                >
                  {s.label}
                </span>
              </div>
              <div
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text-muted)',
                  marginLeft: '8px',
                  flexShrink: 0,
                }}
              >
                <strong style={{ color: 'var(--text-strong)' }}>{s.value}</strong> ({s.pct}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
