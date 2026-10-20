import React from 'react';

export interface MetricItemDef {
  label: string;
  value: string | React.ReactNode;
  helper?: string;
  tone?: 'default' | 'positive' | 'negative' | 'warning' | 'accent';
}

interface MetricStripProps {
  items: MetricItemDef[];
  columns?: number;
  className?: string;
}

export const MetricStrip: React.FC<MetricStripProps> = ({
  items,
  columns,
  className = '',
}) => {
  const gridColumns = columns || items.length;

  return (
    <div
      className={`dealforge-metric-strip ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {items.map((item, idx) => {
        let valueColor = 'var(--text-primary)';
        if (item.tone === 'positive') valueColor = 'var(--positive)';
        if (item.tone === 'negative') valueColor = 'var(--negative)';
        if (item.tone === 'warning') valueColor = 'var(--warning)';
        if (item.tone === 'accent') valueColor = 'var(--accent-line)';

        return (
          <div
            key={idx}
            style={{
              padding: '12px 16px',
              borderRight: idx < items.length - 1 ? '1px solid var(--line)' : 'none',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: valueColor,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.value}
            </div>
            {item.helper && (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-label)',
                  marginTop: '3px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.helper}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
