import React from 'react';
import { formatMultiple, formatPercent } from '@/utils/formatters';

export interface MultipleComparisonItem {
  metricName: string;
  targetMultiple: number | null;
  peerMedian: number | null;
  p25?: number | null;
  p75?: number | null;
}

export interface PeerComparisonBarProps {
  items: MultipleComparisonItem[];
  targetName?: string;
}

export const PeerComparisonBar: React.FC<PeerComparisonBarProps> = ({
  items,
  targetName = 'Target',
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {items.map((item, idx) => {
        const hasData = item.targetMultiple != null && item.peerMedian != null && item.peerMedian > 0;
        const premiumDiscount = hasData
          ? (item.targetMultiple! - item.peerMedian!) / item.peerMedian!
          : null;

        // Scaling range
        const maxVal = Math.max(
          item.targetMultiple || 0,
          item.peerMedian || 0,
          item.p75 || 0,
          10
        ) * 1.25;

        const targetPct = item.targetMultiple ? Math.min(100, (item.targetMultiple / maxVal) * 100) : 0;
        const medianPct = item.peerMedian ? Math.min(100, (item.peerMedian / maxVal) * 100) : 0;

        const isPremium = premiumDiscount != null && premiumDiscount > 0;

        return (
          <div
            key={idx}
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {/* Header: Metric & Premium/Discount Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {item.metricName}
                </span>
                {premiumDiscount != null && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-xs)',
                      background: isPremium ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                      color: isPremium ? 'var(--negative)' : 'var(--positive)',
                      fontWeight: 600,
                    }}
                  >
                    {isPremium ? `+${formatPercent(premiumDiscount)} Premium` : `${formatPercent(premiumDiscount)} Discount`}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Target: <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatMultiple(item.targetMultiple)}</strong>
                {' · '}
                Peer Median: <strong style={{ color: 'var(--focus)', fontVariantNumeric: 'tabular-nums' }}>{formatMultiple(item.peerMedian)}</strong>
              </div>
            </div>

            {/* Visual Comparison Bar Track */}
            <div
              style={{
                position: 'relative',
                height: '24px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-xs)',
                overflow: 'hidden',
              }}
            >
              {/* Target Bar */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '4px',
                  bottom: '4px',
                  width: `${targetPct}%`,
                  background: 'var(--accent)',
                  borderRadius: '2px',
                  opacity: 0.85,
                }}
              />

              {/* Peer Median Marker */}
              <div
                style={{
                  position: 'absolute',
                  left: `${medianPct}%`,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  background: '#FFFFFF',
                  zIndex: 2,
                  boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
                }}
                title={`Peer Median: ${formatMultiple(item.peerMedian)}`}
              />
            </div>

            {/* Context Labels */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: 'var(--text-label)',
              }}
            >
              <span>0.0x</span>
              <span>{targetName}: {formatMultiple(item.targetMultiple)}</span>
              <span>Peer Median: {formatMultiple(item.peerMedian)}</span>
              <span>Max: {formatMultiple(maxVal)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
