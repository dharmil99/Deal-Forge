import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Tooltip } from '@/components/ui/Tooltip';

export interface SidebarItemDef {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  badge?: string | number;
}

interface SidebarSectionProps {
  title: string;
  items: SidebarItemDef[];
  collapsed: boolean;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({ title, items, collapsed }) => {
  const location = useLocation();

  return (
    <div style={{ marginBottom: collapsed ? '8px' : '16px' }}>
      {!collapsed ? (
        <div
          style={{
            padding: '8px 16px 4px 16px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          {title}
        </div>
      ) : (
        <div
          style={{
            height: '1px',
            background: 'var(--line)',
            margin: '8px 12px',
          }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path) && item.path !== '/overview');

          const linkContent = (
            <NavLink
              key={item.id}
              to={item.path}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                height: '34px',
                padding: collapsed ? '0' : '0 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: isActive ? 'var(--text-primary)' : 'var(--text-nav)',
                background: isActive ? 'var(--accent-wash)' : 'transparent',
                textDecoration: 'none',
                fontSize: 'var(--font-size-base)',
                fontWeight: isActive ? 500 : 400,
                transition: 'all var(--transition-fast)',
                width: '100%',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-surface-2)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-nav)';
                }
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: 'var(--accent-line)',
                  }}
                />
              )}

              {/* Icon */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? 'var(--accent-line)' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                <Icon size={16} />
              </div>

              {/* Label */}
              {!collapsed && (
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
              )}

              {/* Optional Badge */}
              {!collapsed && item.badge && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-2)',
                    color: 'var(--text-label)',
                    border: '1px solid var(--line)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id} content={`${title} · ${item.label}`} position="right" fullWidth>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{linkContent}</div>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </div>
    </div>
  );
};
