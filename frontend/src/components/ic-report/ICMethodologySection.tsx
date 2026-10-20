import React from 'react';
import { Database, ShieldCheck, AlertCircle } from 'lucide-react';

export const ICMethodologySection: React.FC = () => {
  return (
    <section
      className="ic-methodology-section"
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
            SECTION J
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Data Quality & Methodology Disclosures
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          System Data Audit & Calculation Boundaries
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Coverage Box */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={15} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Coverage Universe & Dataset Breadth
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              textAlign: 'center',
              marginTop: '4px',
            }}
          >
            <div style={{ background: 'var(--bg-surface-2)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--line-rule)' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                113
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Companies Covered
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-2)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--line-rule)' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                Up to 10 Yrs
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Audited Financials
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface-2)', padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--line-rule)' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                4 Sourced
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Precedent Deals
              </div>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-body)', lineHeight: 1.5 }}>
            Dataset encompasses major Indian listed corporates across IT Services, Banking & Financials, Industrials, Infrastructure, and Consumer sectors with standardized financial reporting under Ind AS.
          </p>
        </div>

        {/* Known Limitations Box */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Known Dataset Limitations & Audited Boundaries
            </span>
          </div>

          <ul
            style={{
              margin: 0,
              paddingLeft: '18px',
              fontSize: '11px',
              color: 'var(--text-body)',
              lineHeight: 1.6,
            }}
          >
            <li>
              <strong>Small Precedent Sample:</strong> The historical precedent M&A repository currently tracks 4 curated Indian transactions; statistics reflect directional indications rather than statistically wide peer sets.
            </li>
            <li>
              <strong>Undisclosed Precedent Target EBITDA:</strong> Historical acquisition filings did not disclose audited target EBITDA; consequently, EV/EBITDA precedent multiples are suppressed (N/A) to prevent artificial fabrication.
            </li>
            <li>
              <strong>Standalone Audited Baselines:</strong> Accretion/dilution modeling employs standalone earnings baselines as reported; post-closing accounting adjustments (purchase price allocation, D&A step-up) are excluded.
            </li>
            <li>
              <strong>Standardized Tax Benchmark:</strong> A statutory corporate income tax rate of 25.0% is applied uniformly to debt interest deductions, foregone interest, and operational synergy flows.
            </li>
          </ul>
        </div>
      </div>

      {/* Compliance / Institutional Integrity Footer */}
      <div
        style={{
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-xs)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        <ShieldCheck size={16} style={{ color: 'var(--positive)', flexShrink: 0 }} />
        <span>
          <strong>Institutional Integrity Guarantee:</strong> All financial values, valuation football fields, capital structures, and multi-year EPS projections are derived strictly from deterministic Phase 1–9 calculation engines. No generative AI approximation or probabilistic hallucination is utilized in financial truth calculations.
        </span>
      </div>
    </section>
  );
};
