import React from 'react';
import { Outlet } from 'react-router-dom';
import { MarketTicker } from '@/components/shell/MarketTicker';
import { Sidebar } from '@/components/shell/Sidebar';
import { AppHeader } from '@/components/shell/AppHeader';
import { useShellContext } from '@/context/ShellContext';

export const AppShell: React.FC = () => {
  const { sidebarCollapsed } = useShellContext();
  const currentSidebarWidth = sidebarCollapsed
    ? 'var(--sidebar-width-collapsed, 64px)'
    : 'var(--sidebar-width-expanded, 240px)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--bg-base)',
        color: 'var(--text-body)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* 1. Global Market Ticker (36px, full width across all authenticated routes) */}
      <MarketTicker />

      {/* 2. Global Application Header (56px, full width directly below ticker) */}
      <AppHeader />

      {/* 3. Application Content: Sidebar + Main Workspace */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          width: '100%',
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left: Collapsible Institutional Navigation (240px expanded / 64px collapsed) */}
        <Sidebar />

        {/* Right: Scrollable Main Content Workspace (calc(100% - 240px) or calc(100% - 64px)) */}
        <main
          id="main-content"
          style={{
            flex: 1,
            minWidth: 0,
            width: `calc(100% - ${currentSidebarWidth})`,
            maxWidth: `calc(100% - ${currentSidebarWidth})`,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-base)',
            boxSizing: 'border-box',
            transition: 'width var(--transition-normal), max-width var(--transition-normal)',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
