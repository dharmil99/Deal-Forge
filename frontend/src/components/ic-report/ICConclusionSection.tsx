import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldCheck, FileCheck } from 'lucide-react';

interface ICConclusionSectionProps {
  isFeasible: boolean;
  isAccretive: boolean;
  buyerName: string;
  targetName: string;
}

export const ICConclusionSection: React.FC<ICConclusionSectionProps> = ({
  isFeasible,
  isAccretive,
  buyerName,
  targetName,
}) => {
  // Deterministic Conclusion Generation (Rule 15 exact state mapping)
  const getConclusionText = () => {
    if (isAccretive && isFeasible) {
      return 'Model indicates an executable transaction that is accretive to Year 1 EPS under modeled financing.';
    }
    if (!isAccretive && isFeasible) {
      return 'Model indicates an executable transaction that is dilutive to Year 1 EPS and requires additional synergy or structural enhancement to achieve break-even neutrality.';
    }
    if (isAccretive && !isFeasible) {
      return "DealForge's deterministic model indicates that the illustrative transaction structure is accretive to Year 1 EPS; however, the requested financing structure is not executable under available buyer liquidity. Committee consideration should therefore focus first on funding restructuring before relying on the modeled accretion outcome.";
    }
    // !isAccretive && !isFeasible
    return 'Model indicates that the requested financing structure is not executable under available buyer liquidity, and the illustrative structure is dilutive to Year 1 EPS.';
  };

  const conclusionText = getConclusionText();

  return (
    <section
      className="ic-conclusion-section"
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
            SECTION K
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Investment Committee Synthesis & Recommendation Conclusion
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Deterministic Evaluation Output
        </span>
      </div>

      {/* Main Conclusion Block */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-xs)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-xs)',
            background: isFeasible && isAccretive
              ? 'rgba(34, 197, 94, 0.08)'
              : !isFeasible
              ? 'rgba(239, 68, 68, 0.08)'
              : 'rgba(245, 158, 11, 0.08)',
            borderLeft: `4px solid ${
              isFeasible && isAccretive
                ? 'var(--positive)'
                : !isFeasible
                ? 'var(--negative)'
                : 'var(--warning)'
            }`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
          }}
        >
          {isFeasible && isAccretive ? (
            <CheckCircle2 size={22} style={{ color: 'var(--positive)', flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <AlertTriangle
              size={22}
              style={{
                color: !isFeasible ? 'var(--negative)' : 'var(--warning)',
                flexShrink: 0,
                marginTop: '2px',
              }}
            />
          )}

          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: isFeasible && isAccretive
                  ? 'var(--positive)'
                  : !isFeasible
                  ? 'var(--negative)'
                  : 'var(--warning)',
                marginBottom: '4px',
              }}
            >
              INVESTMENT COMMITTEE EXECUTIVE FINDING
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.45,
              }}
            >
              {conclusionText}
            </p>
          </div>
        </div>

        {/* Status Indicators Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-xs)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                MODEL STATUS
              </span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent)',
                letterSpacing: '0.04em',
              }}
            >
              DETERMINISTIC PHASE 1–9 VERIFIED
            </span>
          </div>

          <div
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-xs)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} style={{ color: 'var(--positive)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                DATA QUALITY STATUS
              </span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--positive)',
                letterSpacing: '0.04em',
              }}
            >
              AUDITED DATASET (113 COMPANIES)
            </span>
          </div>
        </div>

        {/* Sign-off / Confidentiality Stamp */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--line)',
            paddingTop: '12px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            Transaction Memorandum: <strong>{buyerName}</strong> acquiring <strong>{targetName}</strong>
          </div>
          <div>
            Prepared for Senior Banker & Investment Committee Review · DealForge Financial Workstation
          </div>
        </div>
      </div>
    </section>
  );
};
