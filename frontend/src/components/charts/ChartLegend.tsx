import React from 'react';

export interface LegendItem {
  label: string;
  color: string;
  type?: 'square' | 'line' | 'dashed' | 'circle';
  value?: string | number;
}

export interface ChartLegendProps {
  items: LegendItem[];
  align?: 'left' | 'right' | 'center';
}

export const ChartLegend: React.FC<ChartLegendProps> = ({
  items,
  align = 'right',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        gap: '16px',
        flexWrap: 'wrap',
        fontSize: '11px',
        color: 'var(--text-body)',
      }}
    >
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {item.type === 'line' ? (
            <span
              style={{
                width: '12px',
                height: '2px',
                background: item.color,
                display: 'inline-block',
              }}
            />
          ) : item.type === 'dashed' ? (
            <span
              style={{
                width: '14px',
                height: '2px',
                borderTop: `2px dashed ${item.color}`,
                display: 'inline-block',
              }}
            />
          ) : item.type === 'circle' ? (
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: item.color,
                display: 'inline-block',
              }}
            />
          ) : (
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '1px',
                background: item.color,
                display: 'inline-block',
              }}
            />
          )}

          <span>{item.label}</span>
          {item.value !== undefined && (
            <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {item.value}
            </strong>
          )}
        </div>
      ))}
    </div>
  );
};
