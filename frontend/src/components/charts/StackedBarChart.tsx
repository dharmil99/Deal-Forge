import React, { useState } from 'react';
import { formatCurrencyCr } from '@/utils/formatters';

export interface StackedSegment {
  id: string;
  label: string;
  value: number; // in absolute units (e.g. ₹ Cr)
  percentage?: number; // 0..100
  color: string;
  helper?: string;
}

export interface StackedBarGroup {
  label: string;
  sublabel?: string;
  total: number;
  segments: StackedSegment[];
  isExecutable?: boolean;
  statusBadge?: string;
}

export interface StackedBarChartProps {
  groups: StackedBarGroup[];
  formatValue?: (val: number) => string;
  showPercentages?: boolean;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({
  groups,
  formatValue = (v) => formatCurrencyCr(v, { decimals: 1 }),
  showPercentages = true,
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<{ groupId: string; segmentId: string } | null>(null);

  if (groups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
        No funding mix data available.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {groups.map((group, gIdx) => {
        const groupTotal = group.total || group.segments.reduce((acc, s) => acc + s.value, 0) || 1;

        return (
          <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Group Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{group.label}</span>
                {group.statusBadge && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-xs)',
                      background: group.isExecutable === false ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: group.isExecutable === false ? 'var(--negative)' : 'var(--positive)',
                      fontWeight: 600,
                    }}
                  >
                    {group.statusBadge}
                  </span>
                )}
                {group.sublabel && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{group.sublabel}</span>
                )}
              </div>

              <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)' }}>
                Total: {formatValue(group.total)}
              </div>
            </div>

            {/* 100% Horizontal Stacked Bar */}
            <div
              style={{
                width: '100%',
                height: '28px',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                overflow: 'hidden',
              }}
            >
              {group.segments.map((seg) => {
                const pct = seg.percentage !== undefined ? seg.percentage : (seg.value / groupTotal) * 100;
                if (pct <= 0) return null;

                const isHovered =
                  hoveredSegment?.groupId === group.label && hoveredSegment?.segmentId === seg.id;

                return (
                  <div
                    key={seg.id}
                    onMouseEnter={() => setHoveredSegment({ groupId: group.label, segmentId: seg.id })}
                    onMouseLeave={() => setHoveredSegment(null)}
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: seg.color,
                      opacity: isHovered ? 1.0 : 0.88,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#FFFFFF',
                      fontVariantNumeric: 'tabular-nums',
                      cursor: 'pointer',
                      transition: 'opacity var(--transition-fast)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      padding: '0 4px',
                      boxSizing: 'border-box',
                      borderRight: '1px solid var(--bg-surface)',
                    }}
                    title={`${seg.label}: ${formatValue(seg.value)} (${pct.toFixed(1)}%)`}
                  >
                    {pct >= 10 && (
                      <span>
                        {seg.label} {showPercentages && `${pct.toFixed(0)}%`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Segment Breakdown Legend / Data strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
                fontSize: '11px',
                color: 'var(--text-muted)',
                padding: '2px 4px',
              }}
            >
              {group.segments.map((seg) => {
                const pct = seg.percentage !== undefined ? seg.percentage : (seg.value / groupTotal) * 100;
                return (
                  <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '1px',
                        background: seg.color,
                      }}
                    />
                    <span style={{ color: 'var(--text-body)' }}>{seg.label}:</span>
                    <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatValue(seg.value)}
                    </strong>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-label)' }}>
                      ({pct.toFixed(1)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
