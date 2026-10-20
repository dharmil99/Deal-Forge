import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/api/client';
import type { CompanyListItem } from '@/types/api';
import { useDealContext } from '@/context/DealContext';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import {
  PremiumADBubbleChart,
  TransactionEVChart,
  ValuationMultiplesChart,
  SynergyComparisonChart,
  type DealBubbleData,
  type DealEVItem,
  type DealMultipleItem,
  type DealSynergyItem,
} from '@/components/charts';
import {
  PRESET_DEALS,
  type ComparisonDeal,
} from '@/components/deal-comparison/types';
import { DealMetricStrip } from '@/components/deal-comparison/DealMetricStrip';
import { DealComparisonTable } from '@/components/deal-comparison/DealComparisonTable';
import { DataQualityDisclosure } from '@/components/deal-comparison/DataQualityDisclosure';
import { AddDealModal } from '@/components/deal-comparison/AddDealModal';
import { Plus, Trash2, Layers, Info } from 'lucide-react';

export const DealComparisonPage: React.FC = () => {
  const navigate = useNavigate();
  const { updateDealParams, setCounterparties } = useDealContext();

  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [selectedDeals, setSelectedDeals] = useState<ComparisonDeal[]>(() => {
    // Initialize with first 3 curated pipeline deals
    return PRESET_DEALS.slice(0, 3).map((p) => ({
      ...p,
      dealData: null,
      adData: null,
      loading: true,
      error: null,
    }));
  });

  const [highlightedDealId, setHighlightedDealId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Load companies for the selector modal
  useEffect(() => {
    let active = true;
    apiClient.companies
      .list({ limit: 200 })
      .then((res) => {
        if (active) setCompanies(res.items);
      })
      .catch((err) => console.error('Failed to load companies universe', err));
    return () => {
      active = false;
    };
  }, []);

  // Evaluate a single deal model & accretion-dilution via deterministic backend APIs
  const evaluateDeal = useCallback(async (deal: ComparisonDeal): Promise<ComparisonDeal> => {
    try {
      const dealPayload = {
        buyer_id: deal.buyerId,
        target_id: deal.targetId,
        acquisition_premium: deal.premiumPct / 100,
        cash_pct: deal.cashPct / 100,
        debt_pct: deal.debtPct / 100,
        stock_pct: deal.stockPct / 100,
        transaction_fees: 0,
        expected_annual_synergies: deal.synergiesCr,
      };

      const adPayload = {
        buyer_id: deal.buyerId,
        target_id: deal.targetId,
        acquisition_premium: deal.premiumPct / 100,
        cash_pct: deal.cashPct / 100,
        debt_pct: deal.debtPct / 100,
        stock_pct: deal.stockPct / 100,
        expected_annual_synergies: deal.synergiesCr,
        debt_interest_rate: 0.08,
        foregone_cash_interest_rate: 0.05,
        tax_rate: 0.25,
      };

      const [dealResult, adResult] = await Promise.allSettled([
        apiClient.deals.buildDeal(dealPayload),
        apiClient.deals.accretionDilution(adPayload),
      ]);

      const dealData = dealResult.status === 'fulfilled' ? dealResult.value : null;
      const adData = adResult.status === 'fulfilled' ? adResult.value : null;

      const error =
        dealResult.status === 'rejected'
          ? dealResult.reason?.message || 'Failed to construct deal model'
          : adResult.status === 'rejected'
          ? adResult.reason?.message || 'Failed to evaluate accretion / dilution'
          : null;

      return {
        ...deal,
        dealData,
        adData,
        loading: false,
        error,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Calculation error';
      return {
        ...deal,
        dealData: null,
        adData: null,
        loading: false,
        error: msg,
      };
    }
  }, []);

  // Evaluate deals that need computation
  useEffect(() => {
    const dealsToCompute = selectedDeals.filter((d) => d.loading && !d.dealData && !d.error);
    if (dealsToCompute.length === 0) return;

    let active = true;

    Promise.all(dealsToCompute.map((d) => evaluateDeal(d))).then((evaluated) => {
      if (!active) return;
      setSelectedDeals((prev) =>
        prev.map((existing) => {
          const match = evaluated.find((e) => e.id === existing.id);
          return match || existing;
        })
      );
    });

    return () => {
      active = false;
    };
  }, [selectedDeals, evaluateDeal]);

  // Deal Management Handlers
  const handleAddDeal = (newDeal: Omit<ComparisonDeal, 'dealData' | 'adData' | 'loading' | 'error'>) => {
    if (selectedDeals.length >= 5) return;
    const dealToAdd: ComparisonDeal = {
      ...newDeal,
      dealData: null,
      adData: null,
      loading: true,
      error: null,
    };
    setSelectedDeals((prev) => [...prev, dealToAdd]);
  };

  const handleRemoveDeal = (id: string) => {
    setSelectedDeals((prev) => prev.filter((d) => d.id !== id));
    if (highlightedDealId === id) setHighlightedDealId(null);
  };

  const handleClearAll = () => {
    setSelectedDeals([]);
    setHighlightedDealId(null);
  };

  const handleOpenWorkspace = (deal: ComparisonDeal) => {
    setCounterparties(deal.buyerId, deal.targetId);
    updateDealParams({
      premiumPct: deal.premiumPct,
      cashPct: deal.cashPct,
      debtPct: deal.debtPct,
      stockPct: deal.stockPct,
      synergiesCr: deal.synergiesCr,
    });
    navigate('/deal-builder');
  };

  // Prepare data mappings for Signature Charts
  const bubbleChartData: DealBubbleData[] = useMemo(() => {
    return selectedDeals.map((d) => ({
      id: d.id,
      buyerId: d.buyerId,
      buyerName: d.buyerName,
      targetId: d.targetId,
      targetName: d.targetName,
      premiumPct: d.premiumPct,
      year1ADPct: d.adData?.pro_forma?.years?.year_1?.accretion_dilution_pct ?? null,
      transactionEV: d.dealData?.transaction?.transaction_enterprise_value ?? null,
      synergiesCr: d.synergiesCr,
      isFeasible: d.adData?.is_feasible ?? null,
      isAvailable: d.adData?.is_available ?? null,
    }));
  }, [selectedDeals]);

  const evChartData: DealEVItem[] = useMemo(() => {
    return selectedDeals.map((d) => ({
      id: d.id,
      buyerId: d.buyerId,
      buyerName: d.buyerName,
      targetId: d.targetId,
      targetName: d.targetName,
      transactionEV: d.dealData?.transaction?.transaction_enterprise_value ?? null,
      purchaseEquityValue: d.dealData?.transaction?.purchase_equity_value ?? null,
      targetNetDebt: d.dealData?.transaction?.target_net_debt ?? null,
    }));
  }, [selectedDeals]);

  const multiplesChartData: DealMultipleItem[] = useMemo(() => {
    return selectedDeals.map((d) => {
      const tev = d.dealData?.transaction?.transaction_enterprise_value;
      const rev = d.dealData?.target?.revenue;
      const ebitda = d.dealData?.target?.ebitda;

      const evRevenue = tev && rev && rev > 0 ? tev / rev : null;
      const evEbitda = tev && ebitda && ebitda > 0 ? tev / ebitda : null;

      return {
        id: d.id,
        buyerId: d.buyerId,
        targetId: d.targetId,
        buyerName: d.buyerName,
        targetName: d.targetName,
        evRevenue,
        evEbitda,
        targetRevenue: rev,
        targetEbitda: ebitda,
      };
    });
  }, [selectedDeals]);

  const synergyChartData: DealSynergyItem[] = useMemo(() => {
    return selectedDeals.map((d) => ({
      id: d.id,
      buyerId: d.buyerId,
      targetId: d.targetId,
      buyerName: d.buyerName,
      targetName: d.targetName,
      modeledSynergiesCr: d.synergiesCr,
      breakEvenSynergiesCr: d.adData?.break_even?.year_1?.break_even_gross_synergy ?? null,
      year1ADPct: d.adData?.pro_forma?.years?.year_1?.accretion_dilution_pct ?? null,
    }));
  }, [selectedDeals]);

  const hasEnoughDeals = selectedDeals.length >= 2;

  return (
    <PageContainer>
      {/* A. Page Header */}
      <PageHeader
        title="Deal Comparison"
        description="Compare transaction economics, valuation, financing requirements, synergies, and accretion / dilution across modeled deals."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setIsAddModalOpen(true)}
              disabled={selectedDeals.length >= 5}
            >
              Add Deal ({selectedDeals.length}/5)
            </Button>
            {selectedDeals.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            )}
          </div>
        }
      />

      {/* B. Deal Selection / Comparison Controls Area */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={15} style={{ color: 'var(--accent-line)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Selected Transactions to Compare
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                background: 'var(--bg-surface-2)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-label)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {selectedDeals.length} of 5 Active
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Quick Add Presets:</span>
            {PRESET_DEALS.map((preset) => {
              const isAdded = selectedDeals.some((d) => d.id === preset.id);
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isAdded || selectedDeals.length >= 5}
                  onClick={() => handleAddDeal(preset)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    borderRadius: 'var(--radius-xs)',
                    background: isAdded ? 'var(--bg-surface-2)' : 'var(--bg-elevated)',
                    border: '1px solid var(--line)',
                    color: isAdded ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: isAdded || selectedDeals.length >= 5 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isAdded && selectedDeals.length < 5) {
                      e.currentTarget.style.borderColor = 'var(--accent-line)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isAdded && selectedDeals.length < 5) {
                      e.currentTarget.style.borderColor = 'var(--line)';
                    }
                  }}
                >
                  {isAdded ? `✓ ${preset.label}` : `+ ${preset.label}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Deal Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {selectedDeals.map((deal) => {
            const isHighlighted = highlightedDealId === deal.id;
            return (
              <div
                key={deal.id}
                onClick={() => setHighlightedDealId(deal.id === highlightedDealId ? null : deal.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-xs)',
                  background: isHighlighted ? 'var(--accent-wash)' : 'var(--bg-surface-2)',
                  border: isHighlighted ? '1px solid var(--accent-line)' : '1px solid var(--line)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {deal.buyerId} <span style={{ color: 'var(--text-muted)' }}>→</span> {deal.targetId}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveDeal(deal.id);
                  }}
                  title="Remove Deal"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0 2px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px',
                    lineHeight: '1',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--negative)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  ×
                </button>
              </div>
            );
          })}

          {selectedDeals.length < 5 && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                background: 'transparent',
                border: '1px dashed var(--line-strong)',
                color: 'var(--text-muted)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-line)';
                e.currentTarget.style.color = 'var(--accent-line)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--line-strong)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <Plus size={12} /> Add Deal
            </button>
          )}
        </div>
      </div>

      {/* Empty / Instruction State if < 2 deals selected */}
      {!hasEnoughDeals && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            padding: '36px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <Info size={28} style={{ color: 'var(--accent-line)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '520px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Select at least 2 transactions to compare
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Comparative M&A workstation requires at least 2 modeled deals to evaluate valuation dispersion,
              premium vs accretion profiles, and enterprise value rankings. Add deals using the button below or choose from presets.
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Transaction to Comparison
          </Button>
        </div>
      )}

      {/* C. Executive Comparison Metrics */}
      {selectedDeals.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Executive Metrics Matrix
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Institutional Summary · Tabular Figures
            </span>
          </div>
          <DealMetricStrip
            deals={selectedDeals}
            highlightedDealId={highlightedDealId}
            onHoverDeal={setHighlightedDealId}
            onSelectDeal={(id) => setHighlightedDealId(id === highlightedDealId ? null : id)}
            onRemoveDeal={handleRemoveDeal}
            onOpenWorkspace={handleOpenWorkspace}
          />
        </div>
      )}

      {/* D, E, F, G: Signature Comparison Visualizations (Rendered when >= 2 deals) */}
      {hasEnoughDeals && (
        <>
          {/* Row 1: Signature Chart #1 (Bubble Chart) */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Acquisition Premium vs Year 1 Accretion / Dilution
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                Signature Comparison Chart · Bubble Area Proportional to Transaction EV
              </span>
            </div>
            <PremiumADBubbleChart
              deals={bubbleChartData}
              highlightedDealId={highlightedDealId}
              onHoverDeal={setHighlightedDealId}
              onSelectDeal={(id) => setHighlightedDealId(id === highlightedDealId ? null : id)}
            />
          </div>

          {/* Row 2: Grid of Chart #2 (EV Comparison) & Chart #3 (Valuation Multiples) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            {/* Signature Chart #2: Transaction EV */}
            <div>
              <TransactionEVChart
                deals={evChartData}
                highlightedDealId={highlightedDealId}
                onHoverDeal={setHighlightedDealId}
                onSelectDeal={(id) => setHighlightedDealId(id === highlightedDealId ? null : id)}
              />
            </div>

            {/* Signature Chart #3: Valuation Multiples */}
            <div>
              <ValuationMultiplesChart
                deals={multiplesChartData}
                highlightedDealId={highlightedDealId}
                onHoverDeal={setHighlightedDealId}
                onSelectDeal={(id) => setHighlightedDealId(id === highlightedDealId ? null : id)}
              />
            </div>
          </div>

          {/* Row 3: Signature Chart #4: Synergy Comparison */}
          <div style={{ marginBottom: '20px' }}>
            <SynergyComparisonChart
              deals={synergyChartData}
              highlightedDealId={highlightedDealId}
              onHoverDeal={setHighlightedDealId}
              onSelectDeal={(id) => setHighlightedDealId(id === highlightedDealId ? null : id)}
            />
          </div>
        </>
      )}

      {/* H. Detailed Comparison Table */}
      {selectedDeals.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Comprehensive Deal Comparison Table
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Scroll horizontally for complete consideration and multi-year EPS terms
            </span>
          </div>

          <DealComparisonTable
            deals={selectedDeals}
            highlightedDealId={highlightedDealId}
            onHoverDeal={setHighlightedDealId}
            onSelectDeal={(id) => setHighlightedDealId(id === highlightedDealId ? null : id)}
            onOpenWorkspace={handleOpenWorkspace}
          />
        </div>
      )}

      {/* I. Data-Quality / Methodology Disclosure */}
      <div style={{ marginBottom: '24px' }}>
        <DataQualityDisclosure />
      </div>

      {/* Add Deal Modal */}
      <AddDealModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddDeal={handleAddDeal}
        currentDeals={selectedDeals}
        companies={companies}
      />
    </PageContainer>
  );
};
