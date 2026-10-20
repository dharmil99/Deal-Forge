import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MarketTicker } from '@/components/shell/MarketTicker';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ArrowRight, Lock, Database, FileText } from 'lucide-react';

export const HomePagePlaceholder: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-body)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Global Market Ticker */}
      <MarketTicker />

      {/* Public Navigation Header */}
      <header
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            DealForge
          </span>
          <StatusBadge label="v2.0 Shell Active" variant="neutral" size="sm" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            to="/methodology"
            style={{
              color: 'var(--text-label)',
              fontSize: 'var(--font-size-base)',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-label)')}
          >
            Methodology
          </Link>
          <Link
            to="/sign-in"
            style={{
              color: 'var(--text-label)',
              fontSize: 'var(--font-size-base)',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-label)')}
          >
            Sign in
          </Link>
          <Button
            variant="primary"
            size="sm"
            icon={<ArrowRight size={14} />}
            onClick={() => navigate('/overview')}
          >
            Enter Workstation
          </Button>
        </div>
      </header>

      {/* Hero Container */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          maxWidth: '840px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--line)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '24px',
          }}
        >
          <Lock size={12} style={{ color: 'var(--warning)' }} />
          <span>Stage 2C Infrastructure Foundation · Marketing Home Page Locked</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(32px, 4vw, 52px)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            lineHeight: 1.15,
            margin: '0 0 16px 0',
          }}
        >
          Evaluate targets. Model deals. Decide with evidence.
        </h1>

        <p
          style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--text-body)',
            lineHeight: 1.5,
            maxWidth: '640px',
            margin: '0 0 32px 0',
          }}
        >
          Institutional financial workstation for screening acquisition targets, benchmarking valuations, and modeling M&A accretion/dilution across 113 sourced Indian corporate financials.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="primary"
            size="md"
            icon={<ArrowRight size={16} />}
            onClick={() => navigate('/overview')}
          >
            Launch Workstation (/overview)
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<FileText size={16} />}
            onClick={() => navigate('/methodology')}
          >
            Read Methodology
          </Button>
        </div>

        {/* Notice of Stage 2C Scope */}
        <div
          style={{
            marginTop: '48px',
            padding: '16px 20px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            maxWidth: '600px',
          }}
        >
          <Database size={16} style={{ color: 'var(--accent-line)', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: 'var(--text-label)', lineHeight: 1.5 }}>
            <strong>Implementation Hand-off Note:</strong> Per project governance, the full visual marketing home page from <code style={{ color: 'var(--text-primary)' }}>DealForge home page.html</code> is locked and will be assembled in <strong>Stage 2C</strong>. Stages 2A & 2B establish the full workstation shell, tokens, and navigation.
          </div>
        </div>
      </main>

      {/* Public Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--line)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-muted)',
          background: 'var(--bg-base)',
        }}
      >
        <div>DealForge Institutional M&A Workstation · All analytics deterministic</div>
        <div style={{ fontVariantNumeric: 'tabular-nums' }}>Coverage: 113 Companies · 16 Sectors</div>
      </footer>
    </div>
  );
};
