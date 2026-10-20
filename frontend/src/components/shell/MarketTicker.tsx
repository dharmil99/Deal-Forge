import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { TickerItem } from '@/types/navigation';

const SAMPLE_TICKERS: TickerItem[] = [
  { symbol: 'SENSEX', value: '82,456', change: '▲ 0.42%', isPositive: true },
  { symbol: 'NIFTY 50', value: '25,112', change: '▲ 0.38%', isPositive: true },
  { symbol: 'RELIANCE', value: '2,945', change: '▲ 1.21%', isPositive: true, companyId: 'Reliance Industries' },
  { symbol: 'TCS', value: '4,180', change: '▼ 0.31%', isPositive: false, companyId: 'TCS' },
  { symbol: 'HDFCBANK', value: '1,720', change: '▲ 0.64%', isPositive: true, companyId: 'HDFC Bank' },
  { symbol: 'ULTRACEMCO', value: '11,489', change: '▲ 0.89%', isPositive: true, companyId: 'UltraTech Cement' },
  { symbol: 'INFY', value: '1,842', change: '▼ 0.18%', isPositive: false, companyId: 'Infosys' },
];

export const MarketTicker: React.FC = () => {
  const navigate = useNavigate();

  const handleTickerClick = (item: TickerItem) => {
    if (item.companyId) {
      navigate(`/research/companies?company=${encodeURIComponent(item.companyId)}`);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 'var(--ticker-height)',
        borderBottom: '1px solid var(--line)',
        backgroundColor: 'var(--bg-ticker)',
        fontSize: 'var(--font-size-sm)',
        fontVariantNumeric: 'tabular-nums',
        width: '100%',
        overflow: 'hidden',
        zIndex: 50,
      }}
      className="dealforge-ticker no-print"
    >
      {/* Institutional Honesty Badge */}
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '100%',
          padding: '0 16px',
          borderRight: '1px solid var(--line)',
          color: 'var(--text-nav)',
          whiteSpace: 'nowrap',
          backgroundColor: 'var(--bg-ticker)',
          zIndex: 2,
        }}
      >
        <span>Markets</span>
        <span
          style={{
            fontStyle: 'normal',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          sample data
        </span>
      </div>

      {/* Marquee Ticker Track */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          position: 'relative',
        }}
        className="ticker-window"
      >
        <div
          style={{
            display: 'flex',
            width: 'max-content',
            animation: 'ticker-scroll 45s linear infinite',
          }}
          className="ticker-track"
        >
          {/* Loop twice for seamless infinite marquee scroll */}
          {[0, 1].map((copyIndex) => (
            <div
              key={copyIndex}
              aria-hidden={copyIndex === 1}
              style={{
                display: 'flex',
                gap: '36px',
                paddingRight: '36px',
                whiteSpace: 'nowrap',
              }}
            >
              {SAMPLE_TICKERS.map((item, idx) => (
                <span
                  key={`${copyIndex}-${idx}`}
                  onClick={() => handleTickerClick(item)}
                  style={{
                    cursor: item.companyId ? 'pointer' : 'default',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title={item.companyId ? `View ${item.companyId}` : undefined}
                >
                  <span style={{ color: 'var(--text-ticker)', fontWeight: 500 }}>
                    {item.symbol}
                  </span>
                  <span style={{ color: 'var(--text-strong)' }}>
                    {item.value}
                  </span>
                  <span
                    style={{
                      color: item.isPositive ? 'var(--positive)' : 'var(--negative)',
                      fontWeight: 500,
                    }}
                  >
                    {item.change}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation: none !important;
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
};
