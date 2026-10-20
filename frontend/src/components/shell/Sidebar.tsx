import React from 'react';
import {
  Compass,
  Filter,
  Building2,
  Scale,
  History,
  TrendingUp,
  Briefcase,
  Coins,
  PieChart,
  GitBranch,
  Sliders,
  Layers,
  FileText,
  Database,
  Settings,
} from 'lucide-react';
import { useShellContext } from '@/context/ShellContext';
import { SidebarSection, SidebarItemDef } from './SidebarSection';
import { Tooltip } from '@/components/ui/Tooltip';

const OVERVIEW_ITEMS: SidebarItemDef[] = [
  { id: 'overview', label: 'Overview', path: '/overview', icon: Compass },
];

const RESEARCH_ITEMS: SidebarItemDef[] = [
  { id: 'screening', label: 'Screening', path: '/research/screening', icon: Filter },
  { id: 'companies', label: 'Companies', path: '/research/companies', icon: Building2 },
  { id: 'comps', label: 'Comparable Companies', path: '/research/comps', icon: Scale },
  { id: 'precedents', label: 'Precedent Transactions', path: '/research/precedents', icon: History },
  { id: 'valuation', label: 'Valuation Summary', path: '/research/valuation', icon: TrendingUp },
];

const DEAL_WORKSPACE_ITEMS: SidebarItemDef[] = [
  { id: 'deal-builder', label: 'Deal Builder', path: '/deal-builder', icon: Briefcase },
  { id: 'sources-uses', label: 'Sources & Uses', path: '/sources-uses', icon: Coins },
  { id: 'accretion-dilution', label: 'Accretion / Dilution', path: '/accretion-dilution', icon: PieChart },
  { id: 'scenarios', label: 'Scenarios', path: '/scenarios', icon: GitBranch },
  { id: 'sensitivity', label: 'Sensitivity Analysis', path: '/sensitivity', icon: Sliders },
];

const PORTFOLIO_ITEMS: SidebarItemDef[] = [
  { id: 'deal-comparison', label: 'Deal Comparison', path: '/portfolio/deal-comparison', icon: Layers },
];

const OUTPUT_ITEMS: SidebarItemDef[] = [
  { id: 'ic-report', label: 'IC Report', path: '/output/ic-report', icon: FileText },
];

const SYSTEM_ITEMS: SidebarItemDef[] = [
  { id: 'data-methodology', label: 'Data & Methodology', path: '/data-methodology', icon: Database },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed } = useShellContext();

  const width = sidebarCollapsed
    ? 'var(--sidebar-width-collapsed, 64px)'
    : 'var(--sidebar-width-expanded, 240px)';

  return (
    <aside
      className="no-print"
      style={{
        width: width,
        minWidth: width,
        maxWidth: width,
        flexBasis: width,
        flexShrink: 0,
        height: '100%',
        background: 'var(--bg-base)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal), min-width var(--transition-normal), max-width var(--transition-normal), flex-basis var(--transition-normal)',
        zIndex: 30,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
      aria-label="Application Sidebar Navigation"
    >
      {/* Navigation Scrollable Body */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 0',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <SidebarSection
          title="Overview"
          items={OVERVIEW_ITEMS}
          collapsed={sidebarCollapsed}
        />

        <SidebarSection
          title="Research"
          items={RESEARCH_ITEMS}
          collapsed={sidebarCollapsed}
        />

        <SidebarSection
          title="Deal Workspace"
          items={DEAL_WORKSPACE_ITEMS}
          collapsed={sidebarCollapsed}
        />

        <SidebarSection
          title="Portfolio"
          items={PORTFOLIO_ITEMS}
          collapsed={sidebarCollapsed}
        />

        <SidebarSection
          title="Output"
          items={OUTPUT_ITEMS}
          collapsed={sidebarCollapsed}
        />

        <SidebarSection
          title="System"
          items={SYSTEM_ITEMS}
          collapsed={sidebarCollapsed}
        />
      </nav>

      {/* Workstation Environment Status Footer */}
      <div
        style={{
          padding: sidebarCollapsed ? '10px 0' : '10px 16px',
          borderTop: '1px solid var(--line)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {!sidebarCollapsed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--positive)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Universe: 113 Cos
              </span>
            </div>
            <span
              style={{
                fontSize: '10px',
                color: 'var(--text-label)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              v2.0
            </span>
          </>
        ) : (
          <Tooltip content="Dataset Active: 113 Indian Companies" position="right">
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--positive)',
              }}
            />
          </Tooltip>
        )}
      </div>
    </aside>
  );
};
