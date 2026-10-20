import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShell } from '@/context/ShellContext';
import { Modal } from '@/components/ui/Modal';

interface QuickLink {
  title: string;
  category: string;
  path: string;
}

const QUICK_LINKS: QuickLink[] = [
  { title: 'Tata Consultancy Services (TCS)', category: 'Company', path: '/research/companies?company=TCS' },
  { title: 'Infosys Limited (INFY)', category: 'Company', path: '/research/companies?company=Infosys' },
  { title: 'Reliance Industries', category: 'Company', path: '/research/companies?company=Reliance%20Industries' },
  { title: 'Target Screening (113 Universe)', category: 'Screening', path: '/research/screening' },
  { title: 'Valuation Football Field', category: 'Valuation', path: '/research/valuation' },
  { title: 'Deal Builder', category: 'Deal Workspace', path: '/deal-builder' },
  { title: 'Sources & Uses Schedule', category: 'Deal Workspace', path: '/sources-uses' },
  { title: 'Accretion / Dilution Model', category: 'Deal Workspace', path: '/accretion-dilution' },
  { title: 'Scenario Analysis', category: 'Deal Workspace', path: '/scenarios' },
  { title: 'Sensitivity Matrix', category: 'Deal Workspace', path: '/sensitivity' },
  { title: 'Data Quality & Methodology', category: 'System', path: '/data-methodology' },
];

export const SearchEntry: React.FC = () => {
  const { searchOpen, openSearch, closeSearch } = useShell();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const filteredLinks = QUICK_LINKS.filter(
    (item) =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSelect = (path: string) => {
    navigate(path);
    closeSearch();
    setSearchTerm('');
  };

  return (
    <>
      <button
        onClick={openSearch}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          height: '32px',
          padding: '0 12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-base)',
          cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          transition: 'border-color var(--transition-fast)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--line-strong)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
        aria-label="Search companies and models"
      >
        <Search size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="search-entry-text">Search universe, models...</span>
        <kbd
          className="search-entry-kbd"
          style={{
            marginLeft: '12px',
            padding: '2px 5px',
            fontSize: '10px',
            fontWeight: 600,
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--text-label)',
            fontFamily: 'var(--font-family)',
          }}
        >
          Ctrl K
        </kbd>
      </button>

      <Modal isOpen={searchOpen} onClose={closeSearch} maxWidth="600px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type to search companies, screening, models, methodology..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-base)',
                fontFamily: 'var(--font-family)',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto' }}>
            {filteredLinks.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                No matching results in current dataset.
              </div>
            ) : (
              filteredLinks.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(item.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-strong)',
                    fontSize: 'var(--font-size-base)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ fontWeight: 500 }}>{item.title}</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {item.category}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};
