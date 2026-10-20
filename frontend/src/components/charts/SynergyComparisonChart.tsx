import React, { useState, useRef } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { formatCurrencyCr } from '@/utils/formatters';

export interface DealSynergyItem {
  id: string;
  buyerId: string;
  targetId: string;
  buyerName?: string;
  targetName?: string;
  modeledSynergiesCr: number | null; // Planned annual cost synergies
  breakEvenSynergiesCr: number | null; // Minimum synergy for Y1 EPS neutral parity
  year1ADPct?: number | null;
}

export interface SynergyComparisonChartProps {
  deals: DealSynergyItem[];
  highlightedDealId?: string | null;
  onHoverDeal?: (id: string | null) => void;
  onSelectDeal?: (id: string) => void;
}

export const SynergyComparisonChart: React.FC<SynergyComparisonChartProps> = ({
  deals,
  highlightedDealId,
  onHoverDeal,
  onSelectDeal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDeal, setHoveredDeal] = useState<DealSynergyItem | null>(null);
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
        No deal records available for synergy comparison.
      </div>
    );
  }

  // Find max value across modeled and positive break-even synergies
  const values = deals.flatMap((d) => [
    d.modeledSynergiesCr || 0,
    d.breakEvenSynergiesCr && d.breakEvenSynergiesCr > 0 ? d.breakEvenSynergiesCr : 0,
  ]);
  const maxVal = Math.max(...values, 2000) * 1.15;

  const handleMouseEnter = (deal: DealSynergyItem, e: React.MouseEvent) => {
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
      {/* Header & Legend */}
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
            Synergy Economics vs Break-Even Threshold
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
            <span>Modeled Annual Synergies</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '12px',
                height: '8px',
                borderRadius: '1px',
                background: 'var(--warning)',
                display: 'inline-block',
              }}
            />
            <span>Break-Even Required</span>
          </div>
        </div>
      </div>

      {/* Distinction explanation note */}
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-label)',
          marginBottom: '14px',
          lineHeight: '1.4',
        }}
      >
        <strong>Note:</strong> Modeled Synergy represents steady-state planned cost synergies. Break-Even Synergy denotes the minimum pre-tax operational synergy required to offset consideration financing costs and achieve 0.0% Year 1 EPS neutral parity.
      </div>

      {/* Deal Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {deals.map((deal) => {
          const isHighlighted = highlightedDealId === deal.id;
          const isHovered = hoveredDeal?.id === deal.id;

          const modeled = deal.modeledSynergiesCr ?? 0;
          const breakEven = deal.breakEvenSynergiesCr;

          const modeledPct = Math.min(100, Math.max(0, (modeled / maxVal) * 100));
          const breakEvenPct = breakEven != null && breakEven > 0 ? Math.min(100, (breakEven / maxVal) * 100) : 0;

          const isAlreadyAccretive = breakEven != null && breakEven <= 0;

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
                    Modeled: <strong>{formatCurrencyCr(modeled)}</strong>
                  </span>
                  <span style={{ color: isAlreadyAccretive ? 'var(--positive)' : 'var(--warning)' }}>
                    Break-Even:{' '}
                    <strong>
                      {isAlreadyAccretive
                        ? 'Not Required (Already Accretive)'
                        : breakEven != null
                        ? formatCurrencyCr(breakEven)
                        : 'N/A'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Bar 1: Modeled Synergy */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '75px', fontSize: '10px', color: 'var(--text-muted)' }}>Modeled</span>
                <div
                  style={{
                    flex: 1,
                    height: '14px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-xs)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${modeledPct}%`,
                      height: '100%',
                      background: 'var(--accent-line)',
                      borderRadius: 'var(--radius-xs)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Bar 2: Break-Even Synergy Required */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '75px', fontSize: '10px', color: 'var(--text-muted)' }}>Break-Even</span>
                <div
                  style={{
                    flex: 1,
                    height: '14px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-xs)',
                    overflow: 'hidden',
                  }}
                >
                  {isAlreadyAccretive ? (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '6px',
                        fontSize: '10px',
                        color: 'var(--positive)',
                        background: 'rgba(34, 197, 94, 0.08)',
                        border: '1px solid rgba(34, 197, 94, 0.25)',
                        borderRadius: 'var(--radius-xs)',
                      }}
                    >
                      Already Accretive · No operational synergies required for EPS neutral parity
                    </div>
                  ) : breakEven != null && breakEven > 0 ? (
                    <div
                      style={{
                        width: `${breakEvenPct}%`,
                        height: '100%',
                        background: 'var(--warning)',
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
                        color: 'var(--text-muted)',
                      }}
                    >
                      Break-even requirement unavailable
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
          subtitle="Synergy & Parity Threshold Analysis"
          rows={[
            {
              label: 'Planned Annual Synergies',
              value: formatCurrencyCr(hoveredDeal.modeledSynergiesCr),
              bold: true,
            },
            {
              label: 'Year 1 Break-Even Synergy',
              value:
                hoveredDeal.breakEvenSynergiesCr != null && hoveredDeal.breakEvenSynergiesCr <= 0
                  ? 'Not Required (Already Accretive)'
                  : formatCurrencyCr(hoveredDeal.breakEvenSynergiesCr),
            },
            ...(hoveredDeal.breakEvenSynergiesCr != null && hoveredDeal.breakEvenSynergiesCr <= 0
              ? [
                  {
                    label: 'Parity Benchmark (Audit)',
                    value: `${formatCurrencyCr(hoveredDeal.breakEvenSynergiesCr)} (Pre-synergy Accretion)`,
                  },
                ]
              : []),
            ...(hoveredDeal.breakEvenSynergiesCr != null && hoveredDeal.modeledSynergiesCr != null && hoveredDeal.breakEvenSynergiesCr > 0
              ? [
                  {
                    label: 'Synergy Cushion / (Deficit)',
                    value: formatCurrencyCr(
                      hoveredDeal.modeledSynergiesCr - hoveredDeal.breakEvenSynergiesCr
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
};
