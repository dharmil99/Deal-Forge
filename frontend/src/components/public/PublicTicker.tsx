import React from 'react';
import { useNavigate } from 'react-router-dom';

interface TickerItem {
  symbol: string;
  value: string;
  change: string;
  isPositive: boolean;
  companyId?: string;
}

const TICKER_DATA: TickerItem[] = [
  { symbol: 'SENSEX', value: '82,456', change: '▲ 0.42%', isPositive: true },
  { symbol: 'NIFTY 50', value: '25,112', change: '▲ 0.38%', isPositive: true },
  { symbol: 'RELIANCE', value: '2,945', change: '▲ 1.21%', isPositive: true, companyId: 'Reliance Industries' },
  { symbol: 'TCS', value: '4,180', change: '▼ 0.31%', isPositive: false, companyId: 'TCS' },
  { symbol: 'HDFCBANK', value: '1,720', change: '▲ 0.64%', isPositive: true, companyId: 'HDFC Bank' },
  { symbol: 'ULTRACEMCO', value: '11,489', change: '▲ 0.89%', isPositive: true, companyId: 'UltraTech Cement' },
  { symbol: 'INFY', value: '1,842', change: '▼ 0.18%', isPositive: false, companyId: 'Infosys' },
];

export const PublicTicker: React.FC = () => {
  const navigate = useNavigate();

  const handleTickerClick = (item: TickerItem) => {
    if (item.companyId) {
      navigate(`/research/companies?company=${encodeURIComponent(item.companyId)}`);
    } else {
      navigate('/overview');
    }
  };

  const renderGroup = (ariaHidden: boolean = false) => (
    <div className="grp" aria-hidden={ariaHidden ? 'true' : undefined}>
      {TICKER_DATA.map((item, idx) => (
        <span
          key={`${item.symbol}-${idx}`}
          onClick={() => handleTickerClick(item)}
          style={{ cursor: item.companyId ? 'pointer' : 'default', userSelect: 'none' }}
          title={item.companyId ? `View ${item.companyId} in DealForge` : undefined}
        >
          <span className="sym">{item.symbol}</span>
          {item.value} <span className={item.isPositive ? 'up' : 'dn'}>{item.change}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="dealforge-public-ticker ticker"
      aria-label="Live Market Quotes (Sample Data)"
      style={{
        height: '36px',
        minHeight: '36px',
        maxHeight: '36px',
        flexShrink: 0,
        width: '100%',
        zIndex: 20,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--line, #243040)',
        background: 'rgba(8, 11, 16, 0.95)',
        fontSize: '12px',
        fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div className="tlabel">
        Markets <i>sample data</i>
      </div>
      <div className="twin">
        <div className="track">
          {renderGroup(false)}
          {renderGroup(true)}
        </div>
      </div>
    </div>
  );
};
