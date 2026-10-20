import React from 'react';

export interface ChartHeaderProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export const ChartHeader: React.FC<ChartHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '14px',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--line)',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {title && (
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '0.02em',
                margin: 0,
              }}
            >
              {title}
            </h3>
          )}
          {badge}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '3px',
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {actions}
        </div>
      )}
    </div>
  );
};
