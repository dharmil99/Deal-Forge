import React from 'react';

export interface TooltipRow {
  label: string;
  value: string | number;
  color?: string;
  bold?: boolean;
}

export interface ChartTooltipProps {
  x: number;
  y: number;
  title?: string;
  subtitle?: string;
  rows: TooltipRow[];
  visible: boolean;
  containerWidth?: number;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  x,
  y,
  title,
  subtitle,
  rows,
  visible,
  containerWidth,
}) => {
  if (!visible || rows.length === 0) return null;

  // Reposition if close to right edge
  const width = 220;
  let left = x + 12;
  if (containerWidth && left + width > containerWidth) {
    left = Math.max(10, x - width - 12);
  }

  const top = Math.max(10, y - 20);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--line-strong)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
        pointerEvents: 'none',
        zIndex: 50,
        boxSizing: 'border-box',
      }}
    >
      {title && (
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: subtitle ? '2px' : '6px',
          }}
        >
          {title}
        </div>
      )}

      {subtitle && (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            marginBottom: '6px',
            borderBottom: '1px solid var(--line)',
            paddingBottom: '4px',
          }}
        >
          {subtitle}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {rows.map((r, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              gap: '8px',
            }}
          >
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {r.color && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: r.color,
                    display: 'inline-block',
                  }}
                />
              )}
              {r.label}:
            </span>
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                color: r.color || (r.bold ? 'var(--text-primary)' : 'var(--text-strong)'),
                fontWeight: r.bold ? 600 : 400,
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
