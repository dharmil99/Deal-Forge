import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  badge?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        borderBottom: '1px solid var(--line)',
        width: '100%',
        boxSizing: 'border-box',
      }}
      className={`dealforge-tabs ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent-line)' : '2px solid transparent',
              padding: '10px 0',
              marginBottom: '-1px',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family)',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color var(--transition-fast)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-nav)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ({tab.count})
              </span>
            )}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
};
