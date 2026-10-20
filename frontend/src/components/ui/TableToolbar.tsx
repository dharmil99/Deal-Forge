import React from 'react';

export interface TableToolbarProps {
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
  title?: string;
  count?: number;
  className?: string;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  leftActions,
  rightActions,
  title,
  count,
  className = '',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '0 0 12px 0',
      }}
      className={`dealforge-table-toolbar ${className}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {title && (
          <h3
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {title}
            {count !== undefined && (
              <span
                style={{
                  marginLeft: '8px',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ({count})
              </span>
            )}
          </h3>
        )}
        {leftActions}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {rightActions}
      </div>
    </div>
  );
};
