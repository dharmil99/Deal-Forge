import React from 'react';
import { ChartHeader } from './ChartHeader';
import { ChartLegend, LegendItem } from './ChartLegend';
import { ChartLoadingState, ChartEmptyState, ChartUnavailableState } from './ChartStates';

export interface ChartContainerProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  legend?: LegendItem[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  isUnavailable?: boolean;
  unavailableReason?: string;
  height?: number | string;
  minHeight?: number | string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  badge,
  actions,
  legend,
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  isUnavailable = false,
  unavailableReason,
  height,
  minHeight = '240px',
  children,
  className = '',
  style,
}) => {
  return (
    <div
      className={`dealforge-chart-container ${className}`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px 20px',
        boxSizing: 'border-box',
        width: '100%',
        minHeight: height || minHeight,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...style,
      }}
    >
      {/* Header if title or actions provided */}
      {(title || actions || badge) && (
        <ChartHeader
          title={title}
          subtitle={subtitle}
          badge={badge}
          actions={actions}
        />
      )}

      {/* Legend if provided */}
      {legend && legend.length > 0 && !isLoading && !isUnavailable && !isEmpty && (
        <div style={{ marginBottom: '12px' }}>
          <ChartLegend items={legend} />
        </div>
      )}

      {/* Main Body */}
      <div
        style={{
          flex: 1,
          width: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '160px',
        }}
      >
        {isLoading ? (
          <ChartLoadingState />
        ) : isUnavailable ? (
          <ChartUnavailableState reason={unavailableReason} />
        ) : isEmpty ? (
          <ChartEmptyState message={emptyMessage} />
        ) : (
          children
        )}
      </div>
    </div>
  );
};
