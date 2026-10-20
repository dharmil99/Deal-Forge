import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, ChevronDown, Check, Briefcase } from 'lucide-react';
import { useDealContext } from '@/context/DealContext';

export const DealSwitcher: React.FC = () => {
  const { activeDeal, availableDeals, selectDealById } = useDealContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeDeal) return null;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          height: '32px',
          padding: '0 10px',
          background: 'var(--bg-surface-2)',
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
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--line)';
        }}
        aria-label="Active Transaction Context"
        aria-expanded={isOpen}
      >
        <span style={{ color: 'var(--accent-line)', display: 'inline-flex' }}>
          <Briefcase size={14} />
        </span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {activeDeal.buyerId}
        </span>
        <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {activeDeal.targetId}
        </span>
        <ChevronDown
          size={12}
          style={{
            color: 'var(--text-muted)',
            marginLeft: '2px',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform var(--transition-fast)',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '280px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-popover)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
          role="menu"
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--line)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
              color: 'var(--text-muted)',
            }}
          >
            Active Transaction Projects
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {availableDeals.map((deal) => {
              const isSelected = deal.id === activeDeal.id;
              return (
                <button
                  key={deal.id}
                  onClick={() => {
                    selectDealById(deal.id);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: isSelected ? 'var(--accent-wash)' : 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--text-strong)',
                    fontSize: 'var(--font-size-base)',
                    fontFamily: 'var(--font-family)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  role="menuitem"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {deal.buyerId}
                      </span>
                      <ArrowRight size={11} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {deal.targetId}
                      </span>
                    </div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      Premium: {(deal.basePremium * 100).toFixed(0)}%
                    </span>
                  </div>
                  {isSelected && (
                    <Check size={14} style={{ color: 'var(--accent-line)', flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
