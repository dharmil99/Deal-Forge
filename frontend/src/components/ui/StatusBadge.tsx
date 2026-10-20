import React from 'react';

export interface StatusBadgeProps {
  label: string;
  variant?: 'positive' | 'negative' | 'warning' | 'neutral' | 'accent';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
}) => {
  const variantStyles = {
    positive: {
      color: 'var(--positive)',
      background: 'var(--positive-bg)',
      border: '1px solid rgba(34, 197, 94, 0.25)',
    },
    negative: {
      color: 'var(--negative)',
      background: 'var(--negative-bg)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
    },
    warning: {
      color: 'var(--warning)',
      background: 'var(--warning-bg)',
      border: '1px solid rgba(245, 158, 11, 0.25)',
    },
    neutral: {
      color: 'var(--neutral)',
      background: 'var(--neutral-bg)',
      border: '1px solid rgba(100, 116, 139, 0.25)',
    },
    accent: {
      color: 'var(--accent-line)',
      background: 'var(--accent-wash)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
    },
  }[variant];

  const sizeStyles = {
    sm: { padding: '1px 6px', fontSize: '10px' },
    md: { padding: '2px 8px', fontSize: '11px' },
  }[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: 'var(--radius-xs)',
        fontWeight: 500,
        fontFamily: 'var(--font-family)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...sizeStyles,
        ...variantStyles,
      }}
      className={`dealforge-badge ${className}`}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {label}
    </span>
  );
};
