import React from 'react';

export type FeasibilityStatus =
  | 'EXECUTABLE'
  | 'INFEASIBLE'
  | 'INFEASIBLE — CASH SHORTFALL'
  | 'ILLUSTRATIVE'
  | 'DATA UNAVAILABLE'
  | string;

export interface ChartStatusBadgeProps {
  status: FeasibilityStatus;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export const ChartStatusBadge: React.FC<ChartStatusBadgeProps> = ({
  status,
  size = 'sm',
  style,
}) => {
  const norm = (status || '').toUpperCase();

  let bg = 'var(--bg-surface-2)';
  let border = 'var(--line)';
  let color = 'var(--text-muted)';

  if (norm.includes('EXECUTABLE')) {
    bg = 'rgba(34, 197, 94, 0.12)';
    border = 'rgba(34, 197, 94, 0.35)';
    color = 'var(--positive)';
  } else if (norm.includes('INFEASIBLE')) {
    bg = 'rgba(239, 68, 68, 0.12)';
    border = 'rgba(239, 68, 68, 0.35)';
    color = 'var(--negative)';
  } else if (norm.includes('ILLUSTRATIVE')) {
    bg = 'rgba(56, 189, 248, 0.12)';
    border = 'rgba(56, 189, 248, 0.35)';
    color = '#38bdf8';
  } else if (norm.includes('UNAVAILABLE')) {
    bg = 'rgba(234, 179, 8, 0.12)';
    border = 'rgba(234, 179, 8, 0.35)';
    color = 'var(--warning)';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'sm' ? '1px 6px' : '3px 8px',
        fontSize: size === 'sm' ? '9px' : '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-xs)',
        background: bg,
        border: `1px solid ${border}`,
        color: color,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {status}
    </span>
  );
};
