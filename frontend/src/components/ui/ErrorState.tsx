import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  error: string | Error;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Calculation / Network Error',
  error,
  onRetry,
  className = '',
}) => {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 20px',
        background: 'var(--bg-surface)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 'var(--radius-sm)',
        textAlign: 'center',
        gap: '12px',
      }}
      className={`dealforge-error-state ${className}`}
      role="alert"
    >
      <div style={{ color: 'var(--negative)', display: 'flex', alignItems: 'center' }}>
        <AlertCircle size={32} />
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
            color: 'var(--text-body)',
            margin: 0,
            maxWidth: '500px',
            lineHeight: 1.5,
          }}
        >
          {errorMessage}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          icon={<RefreshCw size={13} />}
          style={{ marginTop: '4px' }}
        >
          Retry request
        </Button>
      )}
    </div>
  );
};
