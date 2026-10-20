import React from 'react';
import { Cpu, ShieldCheck } from 'lucide-react';
import { useShell } from '@/context/ShellContext';
import { Drawer } from '@/components/ui/Drawer';
import { StatusBadge } from '@/components/ui/StatusBadge';

export const ResearchCopilotButton: React.FC = () => {
  const { copilotOpen, setCopilotOpen } = useShell();

  return (
    <>
      <button
        onClick={() => setCopilotOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '32px',
          padding: '0 10px',
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-body)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--line-strong)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--line)';
          e.currentTarget.style.color = 'var(--text-body)';
        }}
        title="Research Copilot (Phase 10 Placeholder)"
        aria-label="Open Research Copilot Placeholder"
      >
        <Cpu size={14} style={{ color: 'var(--accent-line)' }} />
        <span className="copilot-entry-text" style={{ fontWeight: 500 }}>Copilot</span>
        <span className="copilot-entry-badge">
          <StatusBadge label="Phase 10" variant="neutral" size="sm" />
        </span>
      </button>

      <Drawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        title="Research Copilot (Architectural Placeholder)"
        width="460px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', lineHeight: 1.5 }}>
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <ShieldCheck size={20} style={{ color: 'var(--accent-line)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: 'var(--font-size-sm)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                Deterministic Model Precedence
              </div>
              <div style={{ color: 'var(--text-body)' }}>
                DealForge numbers are strictly computed by Python analytics. The future Copilot
                retrieves regulatory filings and synthesizes narrative evidence without altering financial calculations.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Planned Capabilities (Phase 10 / Stage 3)
            </span>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-body)', fontSize: 'var(--font-size-sm)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Context-aware financial queries mapped to current deal models.</li>
              <li>Sourced retrieval from MCA filings, annual reports, and investor transcripts.</li>
              <li>Drafting Investment Committee (IC) deal rationale memos.</li>
              <li>Data-quality discrepancy explanations.</li>
            </ul>
          </div>

          <div
            style={{
              padding: '12px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--warning)',
            }}
          >
            Status: Architecture entry point established. AI/LLM execution and RAG vector store are disabled in Stages 1 &amp; 2.
          </div>
        </div>
      </Drawer>
    </>
  );
};
