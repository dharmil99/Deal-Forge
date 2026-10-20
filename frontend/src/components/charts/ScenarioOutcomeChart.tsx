import React, { useState } from 'react';
import { formatSignedPercent } from '@/utils/formatters';
import { ChartStatusBadge } from './ChartStatusBadge';

export interface ScenarioOutcomeItem {
  id: string;
  name: string;
  scenarioType: string;
  outputVal: number;
  isFeasible: boolean;
  deltaFromBase?: number;
  description?: string;
}

export interface ScenarioOutcomeChartProps {
  items: ScenarioOutcomeItem[];
  baseScenarioId?: string;
  metricLabel?: string;
  formatValue?: (val: number) => string;
  selectedId?: string;
  onSelect?: (item: ScenarioOutcomeItem) => void;
}

export const ScenarioOutcomeChart: React.FC<ScenarioOutcomeChartProps> = ({
  items,
  baseScenarioId,
  metricLabel = 'Year 1 A/D',
  formatValue = (v) => formatSignedPercent(v, 2, false),
  selectedId,
  onSelect,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (items.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No scenario outcomes available.</div>;
  }

  // Find scale range
  const allVals = items.map((i) => i.outputVal);
  const minVal = Math.min(0, ...allVals);
  const maxVal = Math.max(0, ...allVals);
  const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal)) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {items.map((item) => {
        const isSelected = selectedId === item.id;
        const isHovered = hoveredId === item.id;
        const isBase = item.scenarioType.toUpperCase() === 'BASE' || item.id === baseScenarioId;
        const barWidthPct = Math.max(2, (Math.abs(item.outputVal) / maxAbs) * 100);
        const isAccretive = item.outputVal >= 0;

        let barBg = isAccretive ? 'var(--positive)' : 'var(--negative)';
        if (!item.isFeasible) {
          barBg = 'rgba(239, 68, 68, 0.45)';
        }

        return (
          <div
            key={item.id}
            title={`${item.name} (${metricLabel}): ${formatValue(item.outputVal)}`}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelect?.(item)}
            style={{
              padding: '10px 14px',
              background: isSelected
                ? 'var(--accent-wash)'
                : isHovered
                ? 'var(--bg-surface-2)'
                : 'var(--bg-surface)',
              border: `1px solid ${
                isSelected ? 'var(--accent-line)' : isBase ? '#F59E0B' : 'var(--line)'
              }`,
              borderRadius: 'var(--radius-sm)',
              cursor: onSelect ? 'pointer' : 'default',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'all var(--transition-fast)',
            }}
          >
            {/* Top row: Name, Badge, Value, Delta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: isBase || isSelected ? 700 : 600,
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-strong)',
                  }}
                >
                  {item.name}
                </span>

                <span
                  style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: 'var(--radius-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background:
                      item.scenarioType.toUpperCase() === 'BASE'
                        ? 'rgba(59, 130, 246, 0.15)'
                        : item.scenarioType.toUpperCase() === 'UPSIDE'
                        ? 'rgba(34, 197, 94, 0.15)'
                        : item.scenarioType.toUpperCase() === 'DOWNSIDE'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(148, 163, 184, 0.15)',
                    color:
                      item.scenarioType.toUpperCase() === 'BASE'
                        ? 'var(--focus)'
                        : item.scenarioType.toUpperCase() === 'UPSIDE'
                        ? 'var(--positive)'
                        : item.scenarioType.toUpperCase() === 'DOWNSIDE'
                        ? 'var(--negative)'
                        : 'var(--text-muted)',
                  }}
                >
                  {item.scenarioType}
                </span>

                <ChartStatusBadge status={item.isFeasible ? 'EXECUTABLE' : 'INFEASIBLE'} size="sm" />
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', fontVariantNumeric: 'tabular-nums' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: !item.isFeasible
                      ? 'var(--negative)'
                      : isAccretive
                      ? 'var(--positive)'
                      : 'var(--negative)',
                  }}
                >
                  {formatValue(item.outputVal)}
                </span>

                {item.deltaFromBase !== undefined && Math.abs(item.deltaFromBase) > 0.01 && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: item.deltaFromBase > 0 ? 'var(--positive)' : 'var(--negative)',
                    }}
                  >
                    (Δ {formatSignedPercent(item.deltaFromBase, 1, false)})
                  </span>
                )}
              </div>
            </div>

            {/* Visual Magnitude Bar */}
            <div
              style={{
                width: '100%',
                height: '6px',
                background: 'var(--bg-surface-2)',
                borderRadius: '3px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${barWidthPct}%`,
                  background: barBg,
                  borderRadius: '3px',
                  transition: 'width var(--transition-fast)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
