import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  overview: 'Overview',
  research: 'Research',
  screening: 'Target Screening',
  companies: 'Companies',
  comps: 'Comparable Companies',
  precedents: 'Precedent Transactions',
  valuation: 'Valuation Summary',
  'deal-builder': 'Deal Builder',
  'sources-uses': 'Sources & Uses',
  'accretion-dilution': 'Accretion / Dilution',
  scenarios: 'Scenario Analysis',
  sensitivity: 'Sensitivity Analysis',
  'deal-comparison': 'Deal Comparison',
  'ic-report': 'IC Report',
  'data-methodology': 'Data & Methodology',
  settings: 'Settings',
  methodology: 'Methodology',
  'sign-in': 'Sign In',
};

export const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-base)' }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Overview</span>
      </div>
    );
  }

  let accumulatedPath = '';
  const breadcrumbItems = segments.map((seg, index) => {
    accumulatedPath += `/${seg}`;
    const isLast = index === segments.length - 1;
    const label = ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
    return {
      label,
      path: accumulatedPath,
      isLast,
    };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: 'var(--font-size-base)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <Link
        to="/overview"
        style={{
          color: 'var(--text-muted)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'color var(--transition-fast)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-nav)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        DealForge
      </Link>

      {breadcrumbItems.map((item) => (
        <React.Fragment key={item.path}>
          <ChevronRight size={13} style={{ color: 'var(--line-strong)', flexShrink: 0 }} />
          {item.isLast ? (
            <span
              style={{
                color: 'var(--text-primary)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.label}
            </span>
          ) : (
            <Link
              to={item.path}
              style={{
                color: 'var(--text-muted)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-nav)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
