import React from 'react';
import { Printer, ArrowRight, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrencyCr } from '@/utils/formatters';

interface ICReportHeaderProps {
  buyerName: string;
  buyerId: string;
  targetName: string;
  targetId: string;
  isFeasible: boolean;
  isAccretive: boolean;
  unfundedDeficit?: number;
  onPrint?: () => void;
}

export const ICReportHeader: React.FC<ICReportHeaderProps> = ({
  buyerName,
  buyerId,
  targetName,
  targetId,
  isFeasible,
  isAccretive,
  unfundedDeficit,
  onPrint,
}) => {
  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header
      className="ic-report-header"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderTop: '3px solid var(--accent)',
        borderRadius: 'var(--radius-sm)',
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Top Meta Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--accent)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>DEALFORGE M&A WORKSTATION</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-label)' }}>PHASE 1–9 SYNTHESIS</span>
          </div>

          <h1
            style={{
              margin: '6px 0 2px 0',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Investment Committee Report
          </h1>

          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-strong)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
            }}
          >
            <span>{buyerName || buyerId} ({buyerId})</span>
            <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
            <span>{targetName || targetId} ({targetId})</span>
          </div>

          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span>Indian M&A Transaction Analysis</span>
            <span>•</span>
            <span>Analysis Date: <strong style={{ color: 'var(--text-body)', fontWeight: 500 }}>{currentDate}</strong></span>
            <span>•</span>
            <span>Base Currency: <strong style={{ color: 'var(--text-body)', fontWeight: 500 }}>₹ Crores (INR Cr)</strong></span>
          </div>
        </div>

        {/* Action Controls & Print Button */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            alignSelf: 'flex-start',
          }}
        >
          <Button
            variant="secondary"
            onClick={onPrint || (() => window.print())}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid var(--line-strong)',
            }}
          >
            <Printer size={14} />
            <span>Export PDF / Print Report</span>
          </Button>
        </div>
      </div>

      {/* Status Badges Row (Institutional Separation of Feasibility & Accretion) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          paddingTop: '12px',
          borderTop: '1px solid var(--line)',
        }}
      >
        {/* Feasibility Badge */}
        {isFeasible ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid var(--positive)',
              color: 'var(--positive)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            <CheckCircle size={13} />
            <span>EXECUTABLE STRUCTURE</span>
          </div>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid var(--negative)',
              color: 'var(--negative)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            <ShieldAlert size={13} />
            <span>INFEASIBLE</span>
          </div>
        )}

        {/* Infeasible Clarification Warning Pill */}
        {!isFeasible && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid var(--warning)',
              color: 'var(--warning)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={12} />
            <span>Illustrative Structure · Unfunded Cash Deficit{unfundedDeficit && unfundedDeficit > 0 ? ` (${formatCurrencyCr(unfundedDeficit, 0)})` : ''}</span>
          </div>
        )}

        {/* Accretion / Dilution Badge */}
        {!isFeasible ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid var(--warning)',
              color: 'var(--warning)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            <span>{isAccretive ? 'ILLUSTRATIVE ACCRETIVE (FUNDING INFEASIBLE)' : 'ILLUSTRATIVE DILUTIVE (FUNDING INFEASIBLE)'}</span>
          </div>
        ) : isAccretive ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid var(--positive)',
              color: 'var(--positive)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            <span>EXECUTABLE ACCRETIVE</span>
          </div>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid var(--negative)',
              color: 'var(--negative)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            <span>EXECUTABLE DILUTIVE</span>
          </div>
        )}

        <div
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          CONFIDENTIAL · FOR INVESTMENT COMMITTEE USE ONLY
        </div>
      </div>
    </header>
  );
};
