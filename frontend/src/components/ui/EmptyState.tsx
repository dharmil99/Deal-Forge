import React from 'react';
import { Database } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  message: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Data Available',
  message,
  action,
  icon,
  className = '',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        textAlign: 'center',
        gap: '12px',
      }}
      className={`dealforge-empty-state ${className}`}
    >
      <div
        style={{
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon || <Database size={32} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-muted)',
            margin: 0,
            maxWidth: '440px',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      </div>
      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  );
};
