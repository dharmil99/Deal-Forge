import React from 'react';

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  subtext?: string;
  caption?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  trend?: 'positive' | 'negative' | 'neutral';
  trendValue?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtext,
  caption,
  icon,
  badge,
  trend,
  trendValue,
  className = '',
  style,
}) => {
  const displaySubtext = subtext || caption;
  const trendColor = {
    positive: 'var(--positive)',
    negative: 'var(--negative)',
    neutral: 'var(--text-muted)',
  }[trend || 'neutral'];

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '8px',
        boxSizing: 'border-box',
        ...style,
      }}
      className={`dealforge-metric-card ${className}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {icon && (
            <span style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
              {icon}
            </span>
          )}
          <span
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--text-label)',
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        </div>
        {badge}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.15,
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>

      {(displaySubtext || trendValue) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)' }}>
          {trendValue && (
            <span style={{ color: trendColor, fontWeight: 500 }}>
              {trendValue}
            </span>
          )}
          {displaySubtext && <span style={{ color: 'var(--text-muted)' }}>{displaySubtext}</span>}
        </div>
      )}
    </div>
  );
};
