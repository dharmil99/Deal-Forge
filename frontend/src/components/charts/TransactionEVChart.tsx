import React, { useState, useRef } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { formatCurrencyCr } from '@/utils/formatters';

export interface DealEVItem {
  id: string;
  buyerId: string;
  buyerName?: string;
  targetId: string;
  targetName?: string;
  transactionEV: number | null; // in Rs Cr
  purchaseEquityValue: number | null; // in Rs Cr
  targetNetDebt?: number | null; // in Rs Cr
}

export interface TransactionEVChartProps {
  deals: DealEVItem[];
  highlightedDealId?: string | null;
  onHoverDeal?: (id: string | null) => void;
  onSelectDeal?: (id: string) => void;
}

export const TransactionEVChart: React.FC<TransactionEVChartProps> = ({
  deals,
  highlightedDealId,
  onHoverDeal,
  onSelectDeal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDeal, setHoveredDeal] = useState<DealEVItem | null>(null);
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
        No deal records available for Enterprise Value comparison.
      </div>
    );
  }

  // Sort logically descending by Transaction EV (deals with EV=null placed at the end)
  const sortedDeals = [...deals].sort((a, b) => {
    if (a.transactionEV == null && b.transactionEV == null) return 0;
    if (a.transactionEV == null) return 1;
    if (b.transactionEV == null) return -1;
    return b.transactionEV - a.transactionEV;
  });

  const maxEV = Math.max(
    ...sortedDeals.map((d) => (d.transactionEV && d.transactionEV > 0 ? d.transactionEV : 0)),
    1000
  );

  const handleMouseEnter = (deal: DealEVItem, e: React.MouseEvent) => {
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--line-rule)',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Transaction Enterprise Value Ranking
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          Sorted Descending · Values in ₹ Cr
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sortedDeals.map((deal) => {
          const isHighlighted = highlightedDealId === deal.id;
          const isHovered = hoveredDeal?.id === deal.id;
          const hasEV = deal.transactionEV != null && deal.transactionEV > 0;
          const barWidthPct = hasEV ? Math.min(100, (deal.transactionEV! / maxEV) * 100) : 0;

          return (
            <div
              key={deal.id}
              onClick={() => onSelectDeal?.(deal.id)}
              onMouseEnter={(e) => handleMouseEnter(deal, e)}
              onMouseLeave={handleMouseLeave}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: 'var(--radius-xs)',
                background: isHighlighted || isHovered ? 'var(--bg-surface-2)' : 'transparent',
                border: isHighlighted
                  ? '1px solid var(--accent-line)'
                  : isHovered
                  ? '1px solid var(--line-hover)'
                  : '1px solid transparent',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {/* Row header: Counterparties and formatted value */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {deal.buyerId} <span style={{ color: 'var(--text-muted)' }}>→</span> {deal.targetId}
                </span>

                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: hasEV ? 'var(--text-strong)' : 'var(--warning)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {hasEV ? formatCurrencyCr(deal.transactionEV) : 'N/A'}
                </span>
              </div>

              {/* Horizontal bar track */}
              <div
                style={{
                  width: '100%',
                  height: '18px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-xs)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {hasEV ? (
                  <div
                    style={{
                      width: `${barWidthPct}%`,
                      height: '100%',
                      background: isHighlighted
                        ? 'var(--focus)'
                        : 'var(--accent-line)',
                      borderRadius: 'var(--radius-xs)',
                      transition: 'width 0.4s ease-out',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: '8px',
                      fontSize: '10px',
                      color: 'var(--warning)',
                      background: 'rgba(245, 158, 11, 0.08)',
                      fontStyle: 'italic',
                    }}
                  >
                    Target net debt unavailable · TEV cannot be modeled
                  </div>
                )}
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
          subtitle="Enterprise Value Analysis"
          rows={[
            {
              label: 'Transaction EV',
              value: hoveredDeal.transactionEV != null ? formatCurrencyCr(hoveredDeal.transactionEV) : 'N/A',
              bold: true,
            },
            {
              label: 'Purchase Equity Value',
              value: formatCurrencyCr(hoveredDeal.purchaseEquityValue),
            },
            ...(hoveredDeal.targetNetDebt != null
              ? [
                  {
                    label: 'Target Net Debt',
                    value: formatCurrencyCr(hoveredDeal.targetNetDebt),
                  },
                ]
              : []),
            { label: 'Buyer', value: hoveredDeal.buyerName || hoveredDeal.buyerId },
            { label: 'Target', value: hoveredDeal.targetName || hoveredDeal.targetId },
          ]}
        />
      )}
    </div>
  );
};
