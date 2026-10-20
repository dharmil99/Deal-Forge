import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MarketTicker } from '@/components/shell/MarketTicker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowRight, KeyRound, CheckCircle2 } from 'lucide-react';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('analyst@dealforge.internal');
  const [desk, setDesk] = useState('m-and-a-advisory');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/overview');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-body)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <MarketTicker />

      {/* Top Header */}
      <header
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-surface)',
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          DealForge
        </Link>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          Return to Home
        </Button>
      </header>

      {/* Center Sign In Box */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: 'var(--accent-line)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '8px',
                fontWeight: 600,
              }}
            >
              <KeyRound size={12} />
              <span>Institutional Terminal Access</span>
            </div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Sign in to Workstation
            </h1>
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-muted)',
                margin: '6px 0 0 0',
              }}
            >
              Enter credentials for verified corporate finance access.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="Workstation ID / Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@dealforge.internal"
              required
            />

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  color: 'var(--text-label)',
                  marginBottom: '6px',
                }}
              >
                Advisory Desk / Partition
              </label>
              <select
                value={desk}
                onChange={(e) => setDesk(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '0 12px',
                  fontSize: 'var(--font-size-base)',
                  outline: 'none',
                  fontFamily: 'var(--font-family)',
                }}
              >
                <option value="m-and-a-advisory">M&A Advisory & Execution</option>
                <option value="private-equity">Private Equity / Sponsor</option>
                <option value="corp-dev">Corporate Development</option>
                <option value="research">Equity Research & Valuation</option>
              </select>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={<ArrowRight size={16} />}
              style={{ width: '100%', marginTop: '8px' }}
            >
              Open Workstation
            </Button>
          </form>

          <div
            style={{
              padding: '12px',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <CheckCircle2 size={13} style={{ color: 'var(--positive)' }} />
            <span>Pre-authenticated internal test environment active. Click to proceed.</span>
          </div>
        </div>
      </main>
    </div>
  );
};
