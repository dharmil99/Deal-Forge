import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Database, LogOut, ChevronDown, CheckCircle2 } from 'lucide-react';

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          height: '32px',
          padding: '0 8px',
          background: 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-strong)',
          fontSize: 'var(--font-size-base)',
          cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--line-strong)';
          e.currentTarget.style.background = 'var(--bg-surface-2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--line)';
          e.currentTarget.style.background = 'transparent';
        }}
        aria-label="User profile and workstation options"
        aria-expanded={isOpen}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-wash)',
            border: '1px solid var(--accent-line)',
            color: 'var(--accent-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 600,
          }}
        >
          IB
        </div>
        <span
          style={{
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 500,
          }}
        >
          Analyst
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            width: '240px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-dropdown)',
            zIndex: 1000,
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {/* User Profile Header */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--line)',
              marginBottom: '4px',
            }}
          >
            <div
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Institutional User
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-muted)',
                marginTop: '2px',
              }}
            >
              M&A Advisory Desk
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '6px',
                fontSize: '11px',
                color: 'var(--positive)',
              }}
            >
              <CheckCircle2 size={11} />
              <span>Workspace Connected</span>
            </div>
          </div>

          {/* Action Links */}
          <button
            onClick={() => {
              navigate('/settings');
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '7px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-body)',
              fontSize: 'var(--font-size-base)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface-2)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-body)';
            }}
          >
            <Settings size={14} style={{ color: 'var(--text-muted)' }} />
            <span>Settings</span>
          </button>

          <button
            onClick={() => {
              navigate('/data-methodology');
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '7px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-body)',
              fontSize: 'var(--font-size-base)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface-2)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-body)';
            }}
          >
            <Database size={14} style={{ color: 'var(--text-muted)' }} />
            <span>Data & Methodology</span>
          </button>

          <div
            style={{
              height: '1px',
              background: 'var(--line)',
              margin: '4px 0',
            }}
          />

          <button
            onClick={() => {
              navigate('/sign-in');
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '7px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              fontSize: 'var(--font-size-base)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface-2)';
              e.currentTarget.style.color = 'var(--negative)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
};
