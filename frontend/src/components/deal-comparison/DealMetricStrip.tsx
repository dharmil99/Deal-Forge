import React from 'react';
import type { ComparisonDeal } from './types';
import { formatCurrencyCr, formatPercent, formatSignedPercent } from '@/utils/formatters';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { X, ExternalLink } from 'lucide-react';

export interface DealMetricStripProps {
  deals: ComparisonDeal[];
  highlightedDealId?: string | null;
  onHoverDeal?: (id: string | null) => void;
  onSelectDeal?: (id: string) => void;
  onRemoveDeal?: (id: string) => void;
  onOpenWorkspace?: (deal: ComparisonDeal) => void;
}

export const DealMetricStrip: React.FC<DealMetricStripProps> = ({
  deals,
  highlightedDealId,
  onHoverDeal,
  onSelectDeal,
  onRemoveDeal,
  onOpenWorkspace,
}) => {
  if (deals.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, Math.min(deals.length, 5))}, minmax(260px, 1fr))`,
        gap: '12px',
        width: '100%',
        overflowX: 'auto',
        paddingBottom: '4px',
        boxSizing: 'border-box',
      }}
    >
      {deals.map((deal) => {
        const isHighlighted = highlightedDealId === deal.id;
        const dealData = deal.dealData;
        const adData = deal.adData;

        // Metrics extraction
        const tev = dealData?.transaction?.transaction_enterprise_value;
        const pe = dealData?.transaction?.purchase_equity_value;
        const prem = deal.premiumPct;
        const synergies = deal.synergiesCr;

        const y1AD = adData?.pro_forma?.years?.year_1?.accretion_dilution_pct;
        const y2AD = adData?.pro_forma?.years?.year_2?.accretion_dilution_pct;
        const y3AD = adData?.pro_forma?.years?.year_3?.accretion_dilution_pct;

        const isAvailable = adData?.is_available !== false && !deal.error;
        const isFeasible = adData?.is_feasible !== false;

        const beGross = adData?.break_even?.year_1?.break_even_gross_synergy;

        let feasibilityLabel: 'EXECUTABLE' | 'INFEASIBLE' | 'DATA UNAVAILABLE' = 'EXECUTABLE';
        let feasibilityVariant: 'positive' | 'warning' | 'neutral' = 'positive';

        if (!isAvailable) {
          feasibilityLabel = 'DATA UNAVAILABLE';
          feasibilityVariant = 'neutral';
        } else if (!isFeasible) {
          feasibilityLabel = 'INFEASIBLE';
          feasibilityVariant = 'warning';
        }

        const adLabel: 'ACCRETIVE' | 'DILUTIVE' | 'NEUTRAL' | null =
          y1AD != null
            ? y1AD > 0.001
              ? 'ACCRETIVE'
              : y1AD < -0.001
              ? 'DILUTIVE'
              : 'NEUTRAL'
            : null;

        const adVariant: 'positive' | 'negative' | 'neutral' =
          adLabel === 'ACCRETIVE' ? 'positive' : adLabel === 'DILUTIVE' ? 'negative' : 'neutral';

        const getYColor = (val: number | null | undefined) => {
          if (val == null) return 'var(--text-muted)';
          if (val > 0.001) return 'var(--positive)';
          if (val < -0.001) return 'var(--negative)';
          return 'var(--text-primary)';
        };

        return (
          <div
            key={deal.id}
            onClick={() => onSelectDeal?.(deal.id)}
            onMouseEnter={() => onHoverDeal?.(deal.id)}
            onMouseLeave={() => onHoverDeal?.(null)}
            style={{
              background: 'var(--bg-surface)',
              border: isHighlighted ? '1px solid var(--accent-line)' : '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background-color 0.15s ease',
              position: 'relative',
            }}
          >
            {/* Header: Counterparties + Status Badges + Action Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--line-rule)',
                paddingBottom: '8px',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={`${deal.buyerId} → ${deal.targetId}`}
                >
                  {deal.buyerId} <span style={{ color: 'var(--text-muted)' }}>→</span> {deal.targetId}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-label)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {deal.targetName || deal.targetId}
                </span>
                {!isFeasible && isAvailable && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--warning)',
                      fontWeight: 500,
                      marginTop: '2px',
                    }}
                  >
                    Illustrative Structure · Unfunded Cash Deficit
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <StatusBadge label={feasibilityLabel} variant={feasibilityVariant} size="sm" />
                  {adLabel && <StatusBadge label={adLabel} variant={adVariant} size="sm" />}
                  {onOpenWorkspace && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenWorkspace(deal);
                      }}
                      title="Open Deal Workspace"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-line)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                  {onRemoveDeal && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveDeal(deal.id);
                      }}
                      title="Remove from comparison"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--negative)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Compact Tabular Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px 12px',
                fontSize: '11px',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                  Transaction EV
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {tev != null ? formatCurrencyCr(tev) : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                  Purchase Equity
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {pe != null ? formatCurrencyCr(pe) : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                  Premium
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPercent(prem, { isRatio: false, decimals: 1 })}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                  Synergies
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(synergies)}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                  Year 1 A/D {!isFeasible && isAvailable ? '(Illustrative)' : ''}
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    color: getYColor(y1AD),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title={!isFeasible ? 'Earnings impact assumes requested structure despite cash deficit' : undefined}
                >
                  {y1AD != null ? formatSignedPercent(y1AD, 1, false) : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                  Year 2 A/D {!isFeasible && isAvailable ? '(Illustrative)' : ''}
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    color: getYColor(y2AD),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title={!isFeasible ? 'Earnings impact assumes requested structure despite cash deficit' : undefined}
                >
                  {y2AD != null ? formatSignedPercent(y2AD, 1, false) : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                  Year 3 A/D {!isFeasible && isAvailable ? '(Illustrative)' : ''}
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    color: getYColor(y3AD),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title={!isFeasible ? 'Earnings impact assumes requested structure despite cash deficit' : undefined}
                >
                  {y3AD != null ? formatSignedPercent(y3AD, 1, false) : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                  Break-Even Syn
                </div>
                <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {beGross != null ? (
                    beGross <= 0 ? (
                      <span
                        style={{ color: 'var(--positive)' }}
                        title={`Parity Benchmark: ${formatCurrencyCr(beGross)} (Pre-synergy earnings are accretive)`}
                      >
                        Not Required (Already Accretive)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--warning)' }}>
                        {formatCurrencyCr(beGross)}
                      </span>
                    )
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
