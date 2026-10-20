import React, { useState, useMemo } from 'react';
import type { CompanyListItem } from '@/types/api';
import { PRESET_DEALS, type ComparisonDeal, type PresetDealDef } from './types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Plus, Check } from 'lucide-react';

export interface AddDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDeal: (deal: Omit<ComparisonDeal, 'dealData' | 'adData' | 'loading' | 'error'>) => void;
  currentDeals: ComparisonDeal[];
  companies: CompanyListItem[];
}

export const AddDealModal: React.FC<AddDealModalProps> = ({
  isOpen,
  onClose,
  onAddDeal,
  currentDeals,
  companies,
}) => {
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');

  // Custom Deal form state
  const [buyerId, setBuyerId] = useState<string>('TCS');
  const [targetId, setTargetId] = useState<string>('Infosys');
  const [premiumPct, setPremiumPct] = useState<number>(20);
  const [cashPct, setCashPct] = useState<number>(50);
  const [debtPct, setDebtPct] = useState<number>(30);
  const [stockPct, setStockPct] = useState<number>(20);
  const [synergiesCr, setSynergiesCr] = useState<number>(1500);
  const [customError, setCustomError] = useState<string | null>(null);

  const isFull = currentDeals.length >= 5;

  const currentDealIds = useMemo(() => new Set(currentDeals.map((d) => d.id)), [currentDeals]);

  const handleAddPreset = (preset: PresetDealDef) => {
    if (isFull || currentDealIds.has(preset.id)) return;
    onAddDeal({
      id: preset.id,
      buyerId: preset.buyerId,
      buyerName: preset.buyerName,
      targetId: preset.targetId,
      targetName: preset.targetName,
      premiumPct: preset.premiumPct,
      cashPct: preset.cashPct,
      debtPct: preset.debtPct,
      stockPct: preset.stockPct,
      synergiesCr: preset.synergiesCr,
    });
    onClose();
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);

    if (buyerId === targetId) {
      setCustomError('Acquirer and Target cannot be the same entity.');
      return;
    }

    const mixSum = cashPct + debtPct + stockPct;
    if (Math.abs(mixSum - 100) > 0.01) {
      setCustomError(`Financing mix must sum to 100%. Current sum: ${mixSum.toFixed(1)}%`);
      return;
    }

    const newId = `${buyerId.toLowerCase()}-${targetId.toLowerCase()}-${Date.now().toString().slice(-4)}`;

    const buyerObj = companies.find((c) => c.company_id === buyerId);
    const targetObj = companies.find((c) => c.company_id === targetId);

    onAddDeal({
      id: newId,
      buyerId,
      buyerName: buyerObj?.company_name || buyerId,
      targetId,
      targetName: targetObj?.company_name || targetId,
      premiumPct,
      cashPct,
      debtPct,
      stockPct,
      synergiesCr,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Transaction to Comparison" maxWidth={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--line)',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setTab('presets')}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === 'presets' ? '2px solid var(--accent-line)' : '2px solid transparent',
              color: tab === 'presets' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Curated Pipeline Deals
          </button>
          <button
            type="button"
            onClick={() => setTab('custom')}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === 'custom' ? '2px solid var(--accent-line)' : '2px solid transparent',
              color: tab === 'custom' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Custom Deal Modeling
          </button>
        </div>

        {isFull && (
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--warning-bg)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '11px',
              color: 'var(--warning)',
            }}
          >
            Maximum comparison limit reached (5 deals). Please remove a deal before adding another.
          </div>
        )}

        {/* Tab 1: Presets */}
        {tab === 'presets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
            {PRESET_DEALS.map((preset) => {
              const isAlreadyAdded = currentDealIds.has(preset.id);

              return (
                <div
                  key={preset.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-xs)',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {preset.label}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{preset.description}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-label)', fontVariantNumeric: 'tabular-nums' }}>
                      Premium: {preset.premiumPct}% · Mix: {preset.cashPct}C/{preset.debtPct}D/{preset.stockPct}S · Syn: ₹{preset.synergiesCr} Cr
                    </span>
                  </div>

                  {isAlreadyAdded ? (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--positive)',
                        fontWeight: 500,
                      }}
                    >
                      <Check size={14} /> Added
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isFull}
                      onClick={() => handleAddPreset(preset)}
                      icon={<Plus size={12} />}
                    >
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Custom Deal Creator */}
        {tab === 'custom' && (
          <form onSubmit={handleAddCustom} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {customError && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--negative-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
                  color: 'var(--negative)',
                }}
              >
                {customError}
              </div>
            )}

            {/* Buyer Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
                Acquiring Company (Buyer)
              </label>
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              >
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id}>
                    {c.company_name ? `${c.company_name} (${c.company_id})` : c.company_id}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
                Target Acquisition Company
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              >
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id}>
                    {c.company_name ? `${c.company_name} (${c.company_id})` : c.company_id}
                  </option>
                ))}
              </select>
            </div>

            {/* Deal Parameters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Acquisition Premium (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={premiumPct}
                  onChange={(e) => setPremiumPct(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Annual Cost Synergies (₹ Cr)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={synergiesCr}
                  onChange={(e) => setSynergiesCr(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Financing Mix Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
                Financing Structure (Must sum to 100%)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-label)' }}>Cash %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={cashPct}
                    onChange={(e) => setCashPct(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-label)' }}>Debt %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={debtPct}
                    onChange={(e) => setDebtPct(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-label)' }}>Stock %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={stockPct}
                    onChange={(e) => setStockPct(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isFull}>
                Add to Comparison
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
