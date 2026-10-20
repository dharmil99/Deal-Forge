import React from 'react';
import type { SourcesUsesResponse } from '@/types/api';
import { SourcesUsesFlowChart } from '@/components/charts/SourcesUsesFlowChart';
import { formatCurrencyCr } from '@/utils/formatters';
import { ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ICFinancingSectionProps {
  suData: SourcesUsesResponse;
  onNavigateToSourcesUses?: () => void;
}

export const ICFinancingSection: React.FC<ICFinancingSectionProps> = ({
  suData,
  onNavigateToSourcesUses,
}) => {
  const isFeasible = suData.reconciliation.is_feasible;
  const shortfall = suData.reconciliation.funding_shortfall || 0;

  const uses = suData.uses;
  const req = suData.requested_financing;
  const exec = suData.sources;
  const cashRec = suData.cash_reconciliation;

  return (
    <section
      className="ic-financing-section"
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
            SECTION E
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Purchase Price, Financing Mix & Capital Applications
          </span>
        </div>

        {onNavigateToSourcesUses && (
          <button
            onClick={onNavigateToSourcesUses}
            className="no-print"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
            }}
          >
            <span>Open Sources & Uses</span>
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* Infeasibility Warning / Feasibility Confirmation */}
      {!isFeasible ? (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid var(--negative)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--negative)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--negative)' }}>
              Requested structure is illustrative and not executable.
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.5 }}>
              The requested consideration model calls for <strong>{formatCurrencyCr(req.acquirer_cash)}</strong> in cash, but the acquirer’s available pre-deal liquid cash is only <strong>{formatCurrencyCr(cashRec.pre_deal_acquirer_cash)}</strong>. This generates an unfunded cash deficit of <strong style={{ color: 'var(--negative)' }}>{formatCurrencyCr(shortfall)}</strong>. The transaction cannot close without either increasing debt, issuing more shares, or raising external sponsor equity.
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid var(--positive)',
            borderRadius: 'var(--radius-xs)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '12px',
          }}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--positive)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--positive)' }}>Fully Balanced & Executable Capital Structure. </strong>
            <span style={{ color: 'var(--text-body)' }}>
              Acquirer pre-deal cash ({formatCurrencyCr(cashRec.pre_deal_acquirer_cash)}) satisfies requested cash application ({formatCurrencyCr(req.acquirer_cash)}) leaving a pro forma combined liquidity buffer of {formatCurrencyCr(cashRec.pro_forma_combined_cash)}.
            </span>
          </div>
        </div>
      )}

      {/* 1. Side-by-Side Sources and Uses Table */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Uses Table */}
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
            Capital Applications (Total Uses)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Use Item</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Amount (₹ Cr)</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-primary)' }}>Purchase Equity Consideration</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(uses.purchase_equity_value, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {((uses.purchase_equity_value / uses.total_uses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Target Debt Refinanced</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(uses.target_debt_refinancing, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {((uses.target_debt_refinancing / uses.total_uses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Transaction & M&A Advisory Fees</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(uses.transaction_fees, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {((uses.transaction_fees / uses.total_uses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Debt Issuance Financing Fees</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(uses.debt_issuance_fees, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {((uses.debt_issuance_fees / uses.total_uses) * 100).toFixed(1)}%
                </td>
              </tr>
              {uses.other_uses > 0 && (
                <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                  <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Other Uses</td>
                  <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyCr(uses.other_uses, 1)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {((uses.other_uses / uses.total_uses) * 100).toFixed(1)}%
                  </td>
                </tr>
              )}
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 700 }}>Total Uses (Capital Required)</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {formatCurrencyCr(uses.total_uses, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  100.0%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sources Table (Requested vs Executable) */}
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
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Financing Sources (Requested vs Executable)
            </span>
            <span style={{ fontSize: '11px', color: isFeasible ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
              {isFeasible ? 'EXECUTABLE' : 'SHORTFALL'}
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Source Instrument</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Requested (₹ Cr)</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>Executable (₹ Cr)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-primary)' }}>Acquirer Balance Sheet Cash</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(req.acquirer_cash, 1)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '7px 14px',
                    color: exec.acquirer_cash < req.acquirer_cash ? 'var(--negative)' : 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                  }}
                >
                  {formatCurrencyCr(exec.acquirer_cash, 1)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>New Debt Facility</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(req.new_debt, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(exec.new_debt, 1)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Stock Consideration (Shares Issued)</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(req.stock_issuance, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(exec.stock_issuance, 1)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Target Cash Sweep</td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(req.target_cash_sweep, 1)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatCurrencyCr(exec.target_cash_sweep, 1)}
                </td>
              </tr>
              {exec.other_sources > 0 && (
                <tr style={{ borderBottom: '1px solid var(--line-rule)' }}>
                  <td style={{ padding: '7px 14px', color: 'var(--text-body)' }}>Other Sources</td>
                  <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyCr(req.other_sources, 1)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '7px 14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyCr(exec.other_sources, 1)}
                  </td>
                </tr>
              )}
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 700 }}>Total Financing Raised</td>
                <td style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrencyCr(req.total_requested_sources, 1)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '8px 14px',
                    color: !isFeasible ? 'var(--negative)' : 'var(--positive)',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                  }}
                >
                  {formatCurrencyCr(exec.total_sources, 1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Visual Reconciliation Flow */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-xs)',
          padding: '16px 20px',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Sources & Uses Balanced Capital Flow Bridge
        </div>
        <SourcesUsesFlowChart data={suData} />
      </div>
    </section>
  );
};
