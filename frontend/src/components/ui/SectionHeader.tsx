import React from 'react';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  description,
  actions,
  className = '',
}) => {
  const displaySubtitle = subtitle || description;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '12px',
      }}
      className={`dealforge-section-header ${className}`}
    >
      <div>
        <h2
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>
        {displaySubtitle && (
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-muted)',
              margin: '2px 0 0 0',
            }}
          >
            {subtitle}
          </p>
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
