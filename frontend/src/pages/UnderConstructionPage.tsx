import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { useDealContext } from '@/context/DealContext';
import { AlertCircle, ArrowRight, ArrowLeft, Database } from 'lucide-react';

interface UnderConstructionPageProps {
  title: string;
  category: 'Research' | 'Deal Workspace' | 'Portfolio' | 'Output' | 'System';
  plannedPhase: string;
  description: string;
  backendEndpoint?: string;
  isDealContextSensitive?: boolean;
}

export const UnderConstructionPage: React.FC<UnderConstructionPageProps> = ({
  title,
  category,
  plannedPhase,
  description,
  backendEndpoint,
  isDealContextSensitive = false,
}) => {
  const navigate = useNavigate();
  const { activeDeal } = useDealContext();

  return (
    <PageContainer>
      <PageHeader
        title={title}
        description={description}
        badge={
          <StatusBadge
            label={plannedPhase}
            variant="warning"
            size="sm"
          />
        }
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => navigate('/overview')}
            >
              Overview
            </Button>
            {isDealContextSensitive && (
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowRight size={14} />}
                onClick={() => navigate('/deal-builder')}
              >
                Deal Builder
              </Button>
            )}
          </div>
        }
      />

      {/* Institutional Notice Card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div
            style={{
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={22} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Workstation Module Status
            </div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Screen under construction
            </h2>
            <p
              style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--text-body)',
                margin: 0,
                lineHeight: 1.5,
                maxWidth: '680px',
              }}
            >
              The frontend interface for <strong>{title}</strong> is scheduled for full module assembly in upcoming stages. The institutional application shell, centralized tokens, navigation hierarchy, and API client contracts have been successfully established in Stage 2A & 2B.
            </p>
          </div>
        </div>

        {/* Technical Specification Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            padding: '20px',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Navigation Group
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {category}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Implementation Phase
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-strong)' }}>
              {plannedPhase}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Backend Engine Status
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--positive)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--positive)' }} />
              Tested & Ready
            </div>
          </div>

          {backendEndpoint && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                API Endpoint Contract
              </div>
              <code
                style={{
                  fontSize: '12px',
                  color: 'var(--accent-line)',
                  fontFamily: 'monospace',
                }}
              >
                {backendEndpoint}
              </code>
            </div>
          )}

          {isDealContextSensitive && activeDeal && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Active Deal Context
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {activeDeal.buyerName} → {activeDeal.targetName}
              </div>
            </div>
          )}
        </div>

        {/* Institutional Integrity Guidelines Note */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-base)',
          }}
        >
          <Database size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--text-label)', lineHeight: 1.4 }}>
            In accordance with DealForge design guidelines, no simulated or placeholder financial calculations are rendered. Screen content will only bind to verified backend analytics.
          </span>
        </div>
      </div>
    </PageContainer>
  );
};
