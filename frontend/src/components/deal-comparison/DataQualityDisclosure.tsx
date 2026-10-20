import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const DataQualityDisclosure: React.FC = () => {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={16} style={{ color: 'var(--accent-line)' }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Data Quality & Methodology Disclosure
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px 20px',
          fontSize: '11px',
          color: 'var(--text-body)',
          lineHeight: '1.45',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <Info size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Deterministic Financial Outputs:</strong> All transaction metrics, TEV bridges, financing allocations, and EPS trajectories are derived strictly from DealForge's deterministic calculation engines.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Info size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>No Fabricated Values:</strong> When precedent transaction data or target operating fundamentals (e.g., EBITDA or debt) are undisclosed, metrics display explicit <strong>N/A</strong> and are never replaced with zero or synthetic estimates.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Info size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Funding Feasibility vs Accretion:</strong> <code>EXECUTABLE</code> denotes consideration funding is feasible within available balance sheet cash liquidity. A transaction may be simultaneously <strong>ACCRETIVE + INFEASIBLE</strong> or <strong>DILUTIVE + EXECUTABLE</strong>.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Info size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Synergies & Neutral Parity:</strong> Modeled annual synergies reflect projected operating cost efficiencies. Break-even synergy represents the mathematical threshold required for Year 1 EPS neutral parity (0.0% A/D).
          </span>
        </div>
      </div>
    </div>
  );
};
