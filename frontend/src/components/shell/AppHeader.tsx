import React from 'react';
import { Link } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useShellContext } from '@/context/ShellContext';
import { Breadcrumb } from './Breadcrumb';
import { DealSwitcher } from './DealSwitcher';
import { SearchEntry } from './SearchEntry';
import { ResearchCopilotButton } from './ResearchCopilotButton';
import { UserMenu } from './UserMenu';

export const AppHeader: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useShellContext();

  return (
    <header
      style={{
        height: 'var(--header-height, 56px)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        gap: '16px',
        zIndex: 40,
        width: '100%',
        boxSizing: 'border-box',
      }}
      aria-label="Application Header"
      className="app-header no-print"
    >
      {/* Left: Brand Wordmark, Sidebar Toggle, Divider, Breadcrumb Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          overflow: 'hidden',
          minWidth: 0,
          flex: 1,
        }}
      >
        <Link
          to="/overview"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            outline: 'none',
            flexShrink: 0,
          }}
          aria-label="DealForge Home"
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-family)',
            }}
          >
            DealForge
          </span>
        </Link>

        <button
          onClick={toggleSidebar}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            padding: 0,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--line-strong)';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.background = 'var(--bg-surface-2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--line)';
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.background = 'transparent';
          }}
          aria-label={sidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>

        <div
          style={{
            width: '1px',
            height: '16px',
            background: 'var(--line)',
            flexShrink: 0,
          }}
        />

        <div
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
          }}
        >
          <Breadcrumb />
        </div>
      </div>

      {/* Right: Deal Workspace Context, Search, Copilot Entry, User Menu */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        {/* Deal Context Switcher */}
        <DealSwitcher />

        {/* Global Search (Ctrl/Cmd+K) */}
        <SearchEntry />

        {/* AI/RAG Research Copilot Entry Point (Architectural Placeholder) */}
        <ResearchCopilotButton />

        <div
          style={{
            width: '1px',
            height: '20px',
            background: 'var(--line)',
            margin: '0 2px',
          }}
        />

        {/* Institutional User Profile Menu */}
        <UserMenu />
      </div>
    </header>
  );
};
