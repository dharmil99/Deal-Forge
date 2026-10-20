import React, { useState } from 'react';
import type { SourcesUsesResponse } from '@/types/api';
import { formatCurrencyCr } from '@/utils/formatters';

export interface SourcesUsesFlowChartProps {
  data: SourcesUsesResponse;
  height?: number;
}

export const SourcesUsesFlowChart: React.FC<SourcesUsesFlowChartProps> = ({
  data,
}) => {
  const [hoveredItem, setHoveredItem] = useState<{ side: 'source' | 'use'; label: string } | null>(null);

  const { uses, sources, requested_financing, reconciliation } = data;

  const sourcesList = [
    { id: 'acquirer_cash', label: 'Acquirer Cash', value: sources.acquirer_cash, reqValue: requested_financing.acquirer_cash, color: 'var(--accent)' },
    { id: 'new_debt', label: 'New Debt Financing', value: sources.new_debt, reqValue: requested_financing.new_debt, color: 'var(--warning)' },
    { id: 'stock_issuance', label: 'Stock Consideration', value: sources.stock_issuance, reqValue: requested_financing.stock_issuance, color: '#38bdf8' },
    { id: 'target_cash_sweep', label: 'Target Cash Sweep', value: sources.target_cash_sweep, reqValue: requested_financing.target_cash_sweep, color: '#94a3b8' },
    ...(sources.other_sources > 0 ? [{ id: 'other_sources', label: 'Other Sources', value: sources.other_sources, reqValue: requested_financing.other_sources, color: '#64748b' }] : []),
  ];

  const usesList = [
    { id: 'purchase_equity_value', label: 'Purchase Equity Value', value: uses.purchase_equity_value, color: 'var(--accent)' },
    { id: 'target_debt_refinancing', label: 'Debt Refinancing', value: uses.target_debt_refinancing, color: '#f43f5e' },
    { id: 'transaction_fees', label: 'Transaction Fees', value: uses.transaction_fees, color: '#e2e8f0' },
    { id: 'debt_issuance_fees', label: 'Debt Issuance Fees', value: uses.debt_issuance_fees, color: '#cbd5e1' },
    ...(uses.other_uses > 0 ? [{ id: 'other_uses', label: 'Other Uses', value: uses.other_uses, color: '#94a3b8' }] : []),
  ];

  const totalUses = uses.total_uses || 1;
  const totalSources = sources.total_sources || 0;
  const maxTotal = Math.max(totalUses, requested_financing.total_requested_sources, totalSources);

  const formatCr = (val: number) => formatCurrencyCr(val, { decimals: 1 });

  const isBalanced = reconciliation.sources_uses_balanced;
  const isFeasible = reconciliation.is_feasible;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Reconciliation Status Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          background: !isFeasible
            ? 'rgba(239, 68, 68, 0.08)'
            : isBalanced
            ? 'rgba(34, 197, 94, 0.08)'
            : 'rgba(234, 179, 8, 0.08)',
          border: `1px solid ${
            !isFeasible ? 'var(--negative)' : isBalanced ? 'var(--positive)' : 'var(--warning)'
          }`,
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: !isFeasible ? 'var(--negative)' : isBalanced ? 'var(--positive)' : 'var(--warning)',
            }}
          />
          <strong
            style={{
              color: !isFeasible ? 'var(--negative)' : isBalanced ? 'var(--positive)' : 'var(--warning)',
              letterSpacing: '0.04em',
            }}
          >
            {reconciliation.status.replace(':', ' —')}
          </strong>
          {!isFeasible && reconciliation.funding_shortfall > 0 && (
            <span style={{ color: 'var(--text-muted)' }}>
              — Cash deficit of <strong style={{ color: 'var(--negative)' }}>{formatCr(reconciliation.funding_shortfall)}</strong>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '16px', fontVariantNumeric: 'tabular-nums', fontSize: '11px' }}>
          <span>
            Total Uses: <strong style={{ color: 'var(--text-primary)' }}>{formatCr(totalUses)}</strong>
          </span>
          <span>
            Executable Sources: <strong style={{ color: isFeasible ? 'var(--positive)' : 'var(--negative)' }}>{formatCr(totalSources)}</strong>
          </span>
          {reconciliation.difference !== 0 && (
            <span>
              Net Gap: <strong style={{ color: 'var(--negative)' }}>{formatCr(Math.abs(reconciliation.difference))}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Visual Balanced Flow Grid (Sources on Left, Uses on Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 60px 1fr',
          gap: '12px',
          alignItems: 'stretch',
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px',
        }}
      >
        {/* Left: Sources Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sources of Funds
            </span>
            <span style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums', color: 'var(--accent)', fontWeight: 600 }}>
              {formatCr(totalSources)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sourcesList.map((item) => {
              if (item.value <= 0 && item.reqValue <= 0) return null;
              const pct = (item.value / maxTotal) * 100;
              const reqPct = (item.reqValue / maxTotal) * 100;
              const hasDeficit = item.id === 'acquirer_cash' && item.reqValue > item.value;

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredItem({ side: 'source', label: item.label })}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-xs)',
                    background: hoveredItem?.label === item.label ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                    border: '1px solid var(--line-subtle)',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-body)', fontWeight: 500 }}>{item.label}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {hasDeficit && (
                        <span style={{ fontSize: '9px', color: 'var(--negative)', textDecoration: 'line-through' }}>
                          Req: {formatCr(item.reqValue)}
                        </span>
                      )}
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: hasDeficit ? 'var(--negative)' : 'var(--text-primary)' }}>
                        {formatCr(item.value)}
                      </span>
                    </div>
                  </div>

                  {/* Proportional Bar */}
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                    {hasDeficit && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: '100%',
                          width: `${Math.min(100, reqPct)}%`,
                          background: 'rgba(239, 68, 68, 0.25)',
                        }}
                        title={`Requested: ${formatCr(item.reqValue)}`}
                      />
                    )}
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, pct)}%`,
                        background: hasDeficit ? 'var(--negative)' : item.color,
                        borderRadius: '2px',
                        transition: 'width var(--transition-fast)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Transfer / Balance Icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line)',
              fontSize: '12px',
              color: isBalanced ? 'var(--positive)' : 'var(--negative)',
            }}
          >
            {isBalanced ? '⇄' : '≠'}
          </div>
          <span style={{ fontSize: '9px', color: 'var(--text-label)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isBalanced ? 'Balanced' : 'Deficit'}
          </span>
        </div>

        {/* Right: Uses Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Uses of Funds
            </span>
            <span style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', fontWeight: 600 }}>
              {formatCr(totalUses)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {usesList.map((item) => {
              if (item.value <= 0) return null;
              const pct = (item.value / maxTotal) * 100;

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredItem({ side: 'use', label: item.label })}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-xs)',
                    background: hoveredItem?.label === item.label ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                    border: '1px solid var(--line-subtle)',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-body)', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCr(item.value)}
                    </span>
                  </div>

                  {/* Proportional Bar */}
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, pct)}%`,
                        background: item.color,
                        borderRadius: '2px',
                        transition: 'width var(--transition-fast)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
