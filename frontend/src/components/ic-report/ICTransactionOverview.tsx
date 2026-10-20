import React from 'react';
import type { DealResponse, SourcesUsesResponse } from '@/types/api';
import { formatCurrencyCr, formatPercent, formatPriceINR, formatMultiple } from '@/utils/formatters';

interface ICTransactionOverviewProps {
  dealData: DealResponse;
  suData: SourcesUsesResponse;
}

export const ICTransactionOverview: React.FC<ICTransactionOverviewProps> = ({
  dealData,
  suData,
}) => {
  const acq = dealData.acquirer;
  const tgt = dealData.target;
  const tx = dealData.transaction;
  const suUses = suData.uses;
  const premiumPct = (tx.acquisition_premium ?? 0.20) * 100;

  return (
    <section
      className="ic-transaction-overview"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Section Sub-header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--line)',
          paddingBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            SECTION C
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Transaction Overview & Counterparty Fundamentals
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Units: ₹ Cr (Rupees Crores) · % · x Multiples
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Table 1: Counterparty Fundamental Profiles */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--bg-surface-2)',
              borderBottom: '1px solid var(--line)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-strong)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Counterparty Profiles (Audited Standalone)
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Metric</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Acquirer ({acq.company_id})
                </th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Target ({tgt.company_id})
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Entity Name</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>{acq.company_name}</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>{tgt.company_name}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Sector / Industry</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>{acq.sector || 'IT Services'}</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>{tgt.sector || 'IT Services'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Share Price (Undisturbed)</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPriceINR(acq.current_price)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPriceINR(tgt.current_price)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Standalone Market Cap</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(acq.market_cap)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(tgt.market_cap)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Revenue (LTM)</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(acq.revenue)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(tgt.revenue)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>EBITDA (LTM)</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(acq.ebitda)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(tgt.ebitda)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Pre-Deal Liquid Cash</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(acq.cash)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(tgt.cash)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Total Outstanding Debt</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(acq.total_debt)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(tgt.total_debt)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Standalone Diluted EPS</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPriceINR(acq.eps)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPriceINR(tgt.eps)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 2: Transaction Valuation & Economics */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--bg-surface-2)',
              borderBottom: '1px solid var(--line)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-strong)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Transaction Terms & Capital Applications
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Parameter</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Value</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Unit / Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Acquisition Premium</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatPercent(premiumPct, 1, false)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>Over Target Market Price</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Implied Offer Price Per Share</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--accent)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatPriceINR(tx.offer_price_per_share)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>₹ per share</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Purchase Equity Value</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(tx.purchase_equity_value, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>₹ Cr (Offer Equity)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Target Net Debt (Balance Sheet)</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(tx.target_net_debt, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>₹ Cr</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Transaction Enterprise Value (TEV)</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(tx.transaction_enterprise_value, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>₹ Cr (Eq + Net Debt)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Implied Transaction EV/EBITDA</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatMultiple(tx.implied_ev_ebitda)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>x LTM EBITDA</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Target Debt Refinanced</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(suUses.target_debt_refinancing, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>₹ Cr</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Transaction Advisory & Legal Fees</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(suUses.transaction_fees, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>₹ Cr</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Debt Issuance Financing Fees</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(suUses.debt_issuance_fees, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>₹ Cr</td>
              </tr>
              <tr>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)', fontWeight: 600 }}>Total Capital Applications (Gross Uses)</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(suUses.total_uses, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)' }}>₹ Cr</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
