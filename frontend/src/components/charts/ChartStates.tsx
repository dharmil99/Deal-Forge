import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export const ChartLoadingState: React.FC<{ message?: string }> = ({
  message = 'Calculating financial analytics...',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 20px',
        color: 'var(--text-muted)',
        fontSize: '12px',
        gap: '8px',
        width: '100%',
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          border: '2px solid var(--line)',
          borderTopColor: 'var(--accent-line)',
          borderRadius: '50%',
          animation: 'dealforge-spin 0.8s linear infinite',
        }}
      />
      <span>{message}</span>
    </div>
  );
};

export const ChartEmptyState: React.FC<{ message?: string }> = ({
  message = 'No data points match the selected criteria.',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 20px',
        color: 'var(--text-muted)',
        fontSize: '12px',
        gap: '8px',
        width: '100%',
        textAlign: 'center',
      }}
    >
      <Info size={16} style={{ color: 'var(--text-label)' }} />
      <span>{message}</span>
    </div>
  );
};

export const ChartUnavailableState: React.FC<{
  title?: string;
  reason?: string;
}> = ({
  title = 'DATA UNAVAILABLE',
  reason = 'The requested financial metric is not available in the current dataset.',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 24px',
        background: 'rgba(239, 68, 68, 0.03)',
        border: '1px dashed var(--line)',
        borderRadius: 'var(--radius-xs)',
        margin: '12px 0',
        textAlign: 'center',
        gap: '6px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <AlertTriangle size={16} style={{ color: 'var(--warning)', marginBottom: '2px' }} />
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--warning)',
          letterSpacing: '0.04em',
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          maxWidth: '440px',
          lineHeight: 1.4,
        }}
      >
        {reason}
      </span>
    </div>
  );
};

export const ChartErrorState: React.FC<{
  message?: string;
  title?: string;
  onRetry?: () => void;
}> = ({
  message = 'An error occurred while calculating financial model.',
  title,
  onRetry,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 20px',
        color: 'var(--negative)',
        fontSize: '12px',
        gap: '8px',
        width: '100%',
        textAlign: 'center',
      }}
    >
      <AlertTriangle size={18} />
      {title && (
        <span style={{ fontWeight: 600, fontSize: '13px' }}>
          {title}
        </span>
      )}
      <span style={{ maxWidth: '480px', lineHeight: 1.4 }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: '8px',
            padding: '6px 14px',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry Calculation
        </button>
      )}
    </div>
  );
};

