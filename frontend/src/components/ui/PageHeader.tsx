import React from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  badge,
  className = '',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--line)',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
      className={`dealforge-page-header ${className}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flexWrap: 'wrap' }}>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.25,
              wordBreak: 'break-word',
            }}
          >
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p
            style={{
              fontSize: 'var(--font-size-md)',
              color: 'var(--text-body)',
              margin: 0,
              maxWidth: '800px',
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'center', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
};
