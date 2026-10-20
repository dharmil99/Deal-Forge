import React from 'react';

export interface ChartBaseCaseMarkerProps {
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'badge' | 'dot' | 'outline';
  style?: React.CSSProperties;
}

export const ChartBaseCaseMarker: React.FC<ChartBaseCaseMarkerProps> = ({
  label = 'BASE CASE',
  size = 'sm',
  variant = 'badge',
  style,
}) => {
  if (variant === 'dot') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: size === 'sm' ? '10px' : '11px',
          color: 'var(--focus)',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          ...style,
        }}
      >
        <span
          style={{
            width: size === 'sm' ? '7px' : '9px',
            height: size === 'sm' ? '7px' : '9px',
            borderRadius: '50%',
            background: 'var(--focus)',
            display: 'inline-block',
          }}
        />
        {label}
      </span>
    );
  }

  if (variant === 'outline') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: size === 'sm' ? '10px' : '11px',
          color: '#F59E0B',
          fontWeight: 600,
          ...style,
        }}
      >
        <span
          style={{
            width: size === 'sm' ? '10px' : '12px',
            height: size === 'sm' ? '10px' : '12px',
            border: '2px solid #F59E0B',
            borderRadius: 'var(--radius-xs)',
            display: 'inline-block',
          }}
        />
        {label}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'sm' ? '1px 6px' : '2px 8px',
        fontSize: size === 'sm' ? '9px' : '10px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-xs)',
        background: 'rgba(59, 130, 246, 0.15)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        color: 'var(--focus)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      ★ {label}
    </span>
  );
};
