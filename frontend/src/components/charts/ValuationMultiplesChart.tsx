import React, { useState, useRef } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { formatMultiple } from '@/utils/formatters';

export interface DealMultipleItem {
  id: string;
  buyerId: string;
  targetId: string;
  buyerName?: string;
  targetName?: string;
  evRevenue: number | null;
  evEbitda: number | null;
  targetRevenue?: number | null;
  targetEbitda?: number | null;
}

export interface ValuationMultiplesChartProps {
  deals: DealMultipleItem[];
  highlightedDealId?: string | null;
  onHoverDeal?: (id: string | null) => void;
  onSelectDeal?: (id: string) => void;
}

export const ValuationMultiplesChart: React.FC<ValuationMultiplesChartProps> = ({
  deals,
  highlightedDealId,
  onHoverDeal,
  onSelectDeal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDeal, setHoveredDeal] = useState<DealMultipleItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  if (deals.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
          background: 'var(--bg-surface-2)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--line)',
        }}
      >
        No deal records available for valuation multiple comparison.
      </div>
    );
  }

  // Check data availability
  const hasAnyEvEbitda = deals.some((d) => d.evEbitda != null && d.evEbitda > 0);

  // Maximum multiple for bar scaling
  const allMultiples = deals
    .flatMap((d) => [d.evRevenue, d.evEbitda])
    .filter((v): v is number => v != null && !isNaN(v) && v > 0);
  const maxMultiple = Math.max(...allMultiples, 10) * 1.15;

  const handleMouseEnter = (deal: DealMultipleItem, e: React.MouseEvent) => {
    setHoveredDeal(deal);
    onHoverDeal?.(deal.id);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredDeal(null);
    onHoverDeal?.(null);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onMouseMove={handleMouseMove}
    >
      {/* Header and Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--line-rule)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Implied Transaction Multiples
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '12px',
                height: '8px',
                borderRadius: '1px',
                background: 'var(--accent-line)',
                display: 'inline-block',
              }}
            />
            <span>EV / Revenue</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '12px',
                height: '8px',
                borderRadius: '1px',
                background: '#10B981',
                display: 'inline-block',
              }}
            />
            <span>EV / EBITDA</span>
          </div>
        </div>
      </div>

      {/* Warning banner if EV / EBITDA is unavailable across all deals */}
      {!hasAnyEvEbitda && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: '14px',
            background: 'var(--warning-bg)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-xs)',
            fontSize: '11px',
            color: 'var(--warning)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠ EV / EBITDA unavailable for selected transactions: Required transaction EBITDA data is not available.</span>
        </div>
      )}

      {/* Grouped Deal Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {deals.map((deal) => {
          const isHighlighted = highlightedDealId === deal.id;
          const isHovered = hoveredDeal?.id === deal.id;

          const evRevPct = deal.evRevenue != null ? Math.min(100, (deal.evRevenue / maxMultiple) * 100) : 0;
          const evEbitdaPct = deal.evEbitda != null ? Math.min(100, (deal.evEbitda / maxMultiple) * 100) : 0;

          return (
            <div
              key={deal.id}
              onClick={() => onSelectDeal?.(deal.id)}
              onMouseEnter={(e) => handleMouseEnter(deal, e)}
              onMouseLeave={handleMouseLeave}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer',
                background: isHighlighted || isHovered ? 'var(--bg-surface-2)' : 'transparent',
                border: isHighlighted
                  ? '1px solid var(--accent-line)'
                  : isHovered
                  ? '1px solid var(--line-hover)'
                  : '1px solid transparent',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {/* Row title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {deal.buyerId} <span style={{ color: 'var(--text-muted)' }}>→</span> {deal.targetId}
                </span>

                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: 'var(--accent-line)' }}>
                    EV/Rev: <strong>{formatMultiple(deal.evRevenue, 1, 'N/A')}</strong>
                  </span>
                  <span style={{ color: deal.evEbitda != null ? '#10B981' : 'var(--text-muted)' }}>
                    EV/EBITDA: <strong>{formatMultiple(deal.evEbitda, 1, 'N/A')}</strong>
                  </span>
                </div>
              </div>

              {/* Bar 1: EV / Revenue */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '65px', fontSize: '10px', color: 'var(--text-muted)' }}>EV / Rev</span>
                <div
                  style={{
                    flex: 1,
                    height: '14px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-xs)',
                    overflow: 'hidden',
                  }}
                >
                  {deal.evRevenue != null ? (
                    <div
                      style={{
                        width: `${evRevPct}%`,
                        height: '100%',
                        background: 'var(--accent-line)',
                        borderRadius: 'var(--radius-xs)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '6px' }}>
                      N/A
                    </span>
                  )}
                </div>
              </div>

              {/* Bar 2: EV / EBITDA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '65px', fontSize: '10px', color: 'var(--text-muted)' }}>EV / EBITDA</span>
                <div
                  style={{
                    flex: 1,
                    height: '14px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-xs)',
                    overflow: 'hidden',
                  }}
                >
                  {deal.evEbitda != null ? (
                    <div
                      style={{
                        width: `${evEbitdaPct}%`,
                        height: '100%',
                        background: '#10B981',
                        borderRadius: 'var(--radius-xs)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '6px',
                        fontSize: '10px',
                        color: 'var(--warning)',
                        background: 'rgba(245, 158, 11, 0.06)',
                      }}
                    >
                      N/A · EBITDA undisclosed
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredDeal && (
        <ChartTooltip
          visible={true}
          x={tooltipPos.x}
          y={tooltipPos.y}
          title={`${hoveredDeal.buyerName || hoveredDeal.buyerId} → ${hoveredDeal.targetName || hoveredDeal.targetId}`}
          subtitle="Valuation Multiples Breakdown"
          rows={[
            {
              label: 'EV / Revenue',
              value: formatMultiple(hoveredDeal.evRevenue, 2, 'N/A'),
              bold: true,
            },
            {
              label: 'EV / EBITDA',
              value: formatMultiple(hoveredDeal.evEbitda, 2, 'N/A'),
            },
            ...(hoveredDeal.targetRevenue != null
              ? [
                  {
                    label: 'Target Revenue',
                    value: `₹${(hoveredDeal.targetRevenue).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`,
                  },
                ]
              : []),
            ...(hoveredDeal.targetEbitda != null
              ? [
                  {
                    label: 'Target EBITDA',
                    value: `₹${(hoveredDeal.targetEbitda).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr`,
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
};
