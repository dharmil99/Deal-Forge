import React from 'react';
import type { ComparisonDeal } from './types';
import {
  formatCurrencyCr,
  formatMultiple,
  formatPercent,
  formatPriceINR,
  formatSignedPercent,
} from '@/utils/formatters';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ExternalLink, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

export interface DealComparisonTableProps {
  deals: ComparisonDeal[];
  highlightedDealId?: string | null;
  onHoverDeal?: (id: string | null) => void;
  onSelectDeal?: (id: string) => void;
  onOpenWorkspace?: (deal: ComparisonDeal) => void;
}

export const DealComparisonTable: React.FC<DealComparisonTableProps> = ({
  deals,
  highlightedDealId,
  onHoverDeal,
  onSelectDeal,
  onOpenWorkspace,
}) => {
  if (deals.length === 0) {
    return (
      <div
        style={{
          padding: '40px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        No transactions selected for comparison table.
      </div>
    );
  }

  const getADBadge = (val: number | null | undefined, isFeas: boolean) => {
    if (val == null) return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
    const suffix = !isFeas ? '*' : '';
    if (val > 0.001) {
      return (
        <span
          style={{ color: 'var(--positive)', fontWeight: 600 }}
          title={!isFeas ? 'Illustrative: Assumes requested structure despite funding deficit' : undefined}
        >
          {formatSignedPercent(val, 1, false)}{suffix}
        </span>
      );
    }
    if (val < -0.001) {
      return (
        <span
          style={{ color: 'var(--negative)', fontWeight: 600 }}
          title={!isFeas ? 'Illustrative: Assumes requested structure despite funding deficit' : undefined}
        >
          {formatSignedPercent(val, 1, false)}{suffix}
        </span>
      );
    }
    return <span style={{ color: 'var(--text-primary)' }}>0.0%{suffix}</span>;
  };

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-surface)',
        boxSizing: 'border-box',
      }}
      className="dealforge-table-container"
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          textAlign: 'left',
          fontSize: '12px',
          fontFamily: 'var(--font-family)',
        }}
      >
        <thead>
          <tr
            style={{
              background: 'var(--bg-surface-2)',
              borderBottom: '1px solid var(--line)',
              height: '36px',
            }}
          >
            {/* Sticky First Column: Deal */}
            <th
              style={{
                position: 'sticky',
                left: 0,
                zIndex: 2,
                background: 'var(--bg-surface-2)',
                padding: '6px 14px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                borderRight: '1px solid var(--line-rule)',
                minWidth: '180px',
              }}
            >
              Deal (Buyer → Target)
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Buyer
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Target
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Premium
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Purchase Equity
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Transaction EV
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              EV / Revenue
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              EV / EBITDA
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Cash Consideration
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Debt Financing
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Stock Issuance
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Annual Synergies
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Year 1 EPS
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Year 1 A/D
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Year 2 A/D
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Year 3 A/D
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
              Break-Even Synergy
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}>
              Feasibility
            </th>
            <th style={{ padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}>
              Data Quality
            </th>
            <th style={{ padding: '6px 14px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}>
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const isHighlighted = highlightedDealId === deal.id;
            const dealData = deal.dealData;
            const adData = deal.adData;

            const tev = dealData?.transaction?.transaction_enterprise_value;
            const pe = dealData?.transaction?.purchase_equity_value;
            const tgtRev = dealData?.target?.revenue;
            const tgtEbitda = dealData?.target?.ebitda;

            const evRev = tev && tgtRev && tgtRev > 0 ? tev / tgtRev : null;
            const evEbitda = tev && tgtEbitda && tgtEbitda > 0 ? tev / tgtEbitda : null;

            const cashCr = dealData?.financing?.cash_amount;
            const debtCr = dealData?.financing?.debt_amount;
            const stockCr = dealData?.financing?.stock_amount;

            const y1EPS = adData?.pro_forma?.years?.year_1?.pro_forma_eps;
            const y1AD = adData?.pro_forma?.years?.year_1?.accretion_dilution_pct;
            const y2AD = adData?.pro_forma?.years?.year_2?.accretion_dilution_pct;
            const y3AD = adData?.pro_forma?.years?.year_3?.accretion_dilution_pct;
            const beGross = adData?.break_even?.year_1?.break_even_gross_synergy;

            const isAvailable = adData?.is_available !== false && !deal.error;
            const isFeasible = adData?.is_feasible !== false;

            let feasibilityBadge: 'EXECUTABLE' | 'INFEASIBLE' | 'DATA UNAVAILABLE' = 'EXECUTABLE';
            let feasibilityVar: 'positive' | 'warning' | 'neutral' = 'positive';

            if (!isAvailable) {
              feasibilityBadge = 'DATA UNAVAILABLE';
              feasibilityVar = 'neutral';
            } else if (!isFeasible) {
              feasibilityBadge = 'INFEASIBLE';
              feasibilityVar = 'warning';
            }

            const dataQuality = isAvailable ? (
              tgtEbitda != null ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--positive)' }}>
                  <CheckCircle2 size={12} /> Complete
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--warning)' }}>
                  <AlertTriangle size={12} /> EBITDA N/A
                </span>
              )
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--neutral)' }}>
                <AlertCircle size={12} /> Incomplete
              </span>
            );

            return (
              <tr
                key={deal.id}
                onClick={() => onSelectDeal?.(deal.id)}
                onMouseEnter={() => onHoverDeal?.(deal.id)}
                onMouseLeave={() => onHoverDeal?.(null)}
                style={{
                  height: '38px',
                  borderBottom: '1px solid var(--line-rule)',
                  background: isHighlighted ? 'var(--accent-wash)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Sticky First Column */}
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: isHighlighted ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                    padding: '8px 14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    borderRight: '1px solid var(--line-rule)',
                  }}
                >
                  {deal.buyerId} <span style={{ color: 'var(--text-muted)' }}>→</span> {deal.targetId}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>
                  {deal.buyerName || deal.buyerId}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>
                  {deal.targetName || deal.targetId}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPercent(deal.premiumPct, { isRatio: false, decimals: 1 })}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {pe != null ? formatCurrencyCr(pe) : 'N/A'}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {tev != null ? formatCurrencyCr(tev) : 'N/A'}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatMultiple(evRev, 2, 'N/A')}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatMultiple(evEbitda, 2, 'N/A')}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {cashCr != null
                    ? `${formatCurrencyCr(cashCr)} (${deal.cashPct}% Req${!isFeasible && isAvailable ? ' · Deficit' : ''})`
                    : `${deal.cashPct}%`}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {debtCr != null ? `${formatCurrencyCr(debtCr)} (${deal.debtPct}%)` : `${deal.debtPct}%`}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {stockCr != null ? `${formatCurrencyCr(stockCr)} (${deal.stockPct}%)` : `${deal.stockPct}%`}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(deal.synergiesCr)}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {y1EPS != null ? formatPriceINR(y1EPS) : 'N/A'}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {getADBadge(y1AD, isFeasible)}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {getADBadge(y2AD, isFeasible)}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {getADBadge(y3AD, isFeasible)}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {beGross != null ? (
                    beGross <= 0 ? (
                      <span
                        style={{ color: 'var(--positive)', fontWeight: 500 }}
                        title={`Parity Benchmark: ${formatCurrencyCr(beGross)} (Pre-synergy earnings are accretive)`}
                      >
                        Not Required (Already Accretive)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                        {formatCurrencyCr(beGross)}
                      </span>
                    )
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                  )}
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <StatusBadge label={feasibilityBadge} variant={feasibilityVar} size="sm" />
                    {!isFeasible && isAvailable && (
                      <span style={{ fontSize: '9px', color: 'var(--warning)', whiteSpace: 'nowrap' }}>
                        Cash Deficit
                      </span>
                    )}
                  </div>
                </td>

                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'center', fontSize: '11px' }}>
                  {dataQuality}
                </td>

                <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  {onOpenWorkspace && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenWorkspace(deal);
                      }}
                      style={{
                        padding: '3px 8px',
                        background: 'var(--accent-wash)',
                        border: '1px solid var(--accent-line)',
                        borderRadius: 'var(--radius-xs)',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--accent-wash)';
                      }}
                    >
                      <ExternalLink size={11} /> Workspace
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {deals.some((d) => d.adData?.is_feasible === false) && (
        <div
          style={{
            padding: '8px 14px',
            fontSize: '11px',
            color: 'var(--text-label)',
            background: 'var(--bg-surface-2)',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ color: 'var(--warning)', fontWeight: 600 }}>*</span>
          <span>
            Earnings impact marked with an asterisk reflects an illustrative requested structure; consideration cash requirements currently exceed acquirer liquid balance sheet capacity.
          </span>
        </div>
      )}
    </div>
  );
};
