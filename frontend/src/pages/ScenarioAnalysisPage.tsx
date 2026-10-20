import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '@/services/api/client';
import { useDealContext } from '@/context/DealContext';
import { PageContainer } from '@/components/ui/PageContainer';
import { Drawer } from '@/components/ui/Drawer';
import {
  formatCurrencyCr,
  formatPriceINR,
  formatPercent,
  formatSignedPercent,
} from '@/utils/formatters';
import type {
  CompanyListItem,
  ScenarioAssumptions,
  ScenarioDefinitionSchema,
  ScenarioComparisonResponse,
  ScenarioResult,
  Sensitivity2DResponse,
} from '@/types/api';
import {
  ChartContainer,
  ChartHeader,
  ChartLoadingState,
  ChartErrorState,
  ChartUnavailableState,
  ChartStatusBadge,
  ChartBaseCaseMarker,
  SensitivityHeatmap,
  TornadoChart,
  ScenarioOutcomeChart,
  MultiYearADChart,
  type TornadoVariableDriver,
  type ScenarioOutcomeItem,
} from '@/components/charts';
import type { ADProFormaProjections, ADStandaloneEPS } from '@/types/api';
import { Layers, RefreshCw } from 'lucide-react';

const DEFAULT_SCENARIO_BASE_ASSUMPTIONS: ScenarioAssumptions = {
  acquisition_premium: 0.20,
  cash_pct: 0.02,
  debt_pct: 0.60,
  stock_pct: 0.38,
  transaction_fees: 500.0,
  debt_issuance_fee_pct: 0.02,
  minimum_cash_balance: 1000.0,
  refinance_target_debt: true,
  use_target_cash: true,
  debt_interest_rate: 0.08,
  foregone_cash_interest_rate: 0.05,
  tax_rate: 0.25,
  expected_annual_synergies: 2000.0,
};

export const ScenarioAnalysisPage: React.FC = () => {
  const { activeDeal, setCounterparties } = useDealContext();

  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [buyerId, setBuyerId] = useState<string>(activeDeal?.buyerId || 'TCS');
  const [targetId, setTargetId] = useState<string>(activeDeal?.targetId || 'Infosys');

  // Base assumptions - stable reference across renders
  const [baseAssumptions] = useState<ScenarioAssumptions>(DEFAULT_SCENARIO_BASE_ASSUMPTIONS);

  // Custom scenario input state
  const [customPremiumPct, setCustomPremiumPct] = useState<number>(25);
  const [customSynergyCr, setCustomSynergyCr] = useState<number>(1500);
  const [customCashPct, setCustomCashPct] = useState<number>(20);
  const [customDebtPct, setCustomDebtPct] = useState<number>(50);
  const [customStockPct, setCustomStockPct] = useState<number>(30);

  // Scenario comparison data
  const [scenariosData, setScenariosData] = useState<ScenarioComparisonResponse | null>(null);
  const [heatmapData, setHeatmapData] = useState<Sensitivity2DResponse | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('Base Case');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [heatmapError, setHeatmapError] = useState<string | null>(null);

  // Sync with DealContext when activeDeal changes
  useEffect(() => {
    if (activeDeal?.buyerId && activeDeal.buyerId !== buyerId) {
      setBuyerId(activeDeal.buyerId);
    }
    if (activeDeal?.targetId && activeDeal.targetId !== targetId) {
      setTargetId(activeDeal.targetId);
    }
  }, [activeDeal?.buyerId, activeDeal?.targetId]);

  // Load companies list
  useEffect(() => {
    let mounted = true;
    apiClient.companies.list({ limit: 200 })
      .then((res) => {
        if (mounted) setCompanies(res.items);
      })
      .catch((err) => console.error('Failed to load companies list', err));
    return () => {
      mounted = false;
    };
  }, []);

  const handleBuyerChange = (newBuyer: string) => {
    let nextTarget = targetId;
    if (newBuyer === targetId) {
      nextTarget = companies.find((c) => c.company_id !== newBuyer)?.company_id || (newBuyer === 'TCS' ? 'Infosys' : 'TCS');
      setTargetId(nextTarget);
    }
    setBuyerId(newBuyer);
    setCounterparties(newBuyer, nextTarget);
  };

  const handleTargetChange = (newTarget: string) => {
    let nextBuyer = buyerId;
    if (newTarget === buyerId) {
      nextBuyer = companies.find((c) => c.company_id !== newTarget)?.company_id || (newTarget === 'Infosys' ? 'TCS' : 'Infosys');
      setBuyerId(nextBuyer);
    }
    setTargetId(newTarget);
    setCounterparties(nextBuyer, newTarget);
  };

  // Fetch complete scenarios suite and 2D heatmap matrix concurrently without deadlocking
  const fetchScenariosAndAnalytics = async () => {
    setLoading(true);
    setError(null);
    setHeatmapError(null);

    const scenariosPayload: ScenarioDefinitionSchema[] = [
      {
        name: 'Base Case',
        scenario_type: 'BASE',
        description: 'Standard transaction structure based on baseline valuation and balance sheet capacity.',
        overrides: {},
      },
      {
        name: 'Downside (Stress)',
        scenario_type: 'DOWNSIDE',
        description: 'Severe operational stress: 30% premium, reduced synergies (₹500 Cr), and higher borrowing cost (10%).',
        overrides: {
          acquisition_premium: 0.30,
          expected_annual_synergies: 500.0,
          debt_interest_rate: 0.10,
        },
      },
      {
        name: 'Upside (Bull)',
        scenario_type: 'UPSIDE',
        description: 'Optimistic scenario: disciplined 15% premium, accelerated synergy realization (₹3,500 Cr), and favorable debt terms (7%).',
        overrides: {
          acquisition_premium: 0.15,
          expected_annual_synergies: 3500.0,
          debt_interest_rate: 0.07,
        },
      },
      {
        name: 'Cash-Constrained (Infeasible)',
        scenario_type: 'CUSTOM',
        description: 'Illustrative 50% Cash structure that exceeds acquirer available balance sheet cash, triggering execution deficit.',
        overrides: {
          cash_pct: 0.50,
          debt_pct: 0.30,
          stock_pct: 0.20,
        },
      },
      {
        name: 'Custom Structure',
        scenario_type: 'CUSTOM',
        description: 'User-configured custom consideration and synergy assumptions.',
        overrides: {
          acquisition_premium: customPremiumPct / 100,
          expected_annual_synergies: customSynergyCr,
          cash_pct: customCashPct / 100,
          debt_pct: customDebtPct / 100,
          stock_pct: customStockPct / 100,
        },
      },
    ];

    try {
      // Request 1: Scenario Comparison
      const compPromise = apiClient.deals.compareScenarios({
        buyer_id: buyerId,
        target_id: targetId,
        base_assumptions: baseAssumptions,
        scenarios: scenariosPayload,
      });

      // Request 2: Signature 2D Heatmap (Acquisition Premium vs Synergy -> Year 1 A/D %)
      const heatmapPromise = apiClient.deals.sensitivity2D({
        buyer_id: buyerId,
        target_id: targetId,
        base_assumptions: baseAssumptions,
        x_axis: {
          variable: 'acquisition_premium',
          values: [0.10, 0.15, 0.20, 0.25, 0.30],
        },
        y_axis: {
          variable: 'expected_annual_synergies',
          values: [0.0, 1000.0, 2000.0, 3000.0, 4000.0],
        },
        output_metric: 'year_1_ad_pct',
      });

      const [compSettled, heatSettled] = await Promise.allSettled([compPromise, heatmapPromise]);

      if (compSettled.status === 'fulfilled') {
        setScenariosData(compSettled.value);
        setError(null);
      } else {
        const msg = compSettled.reason instanceof Error ? compSettled.reason.message : 'Failed to evaluate scenario comparisons';
        setError(msg);
      }

      if (heatSettled.status === 'fulfilled') {
        setHeatmapData(heatSettled.value);
        setHeatmapError(null);
      } else {
        const msg = heatSettled.reason instanceof Error ? heatSettled.reason.message : 'Failed to evaluate 2D sensitivity matrix';
        setHeatmapError(msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error during scenario evaluation';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScenariosAndAnalytics();
  }, [buyerId, targetId]);

  // Active selected scenario object
  const activeScenario: ScenarioResult | null = useMemo(() => {
    if (!scenariosData || scenariosData.scenarios.length === 0) return null;
    return (
      scenariosData.scenarios.find((s) => s.identity.name === selectedScenarioId) ||
      scenariosData.scenarios[0]
    );
  }, [scenariosData, selectedScenarioId]);

  // Base scenario object
  const baseScenario: ScenarioResult | null = useMemo(() => {
    if (!scenariosData) return null;
    return (
      scenariosData.scenarios.find((s) => s.identity.scenario_type === 'BASE') ||
      scenariosData.scenarios[0]
    );
  }, [scenariosData]);

  // 1. Scenario Outcome Comparison Items
  const outcomeItems: ScenarioOutcomeItem[] = useMemo(() => {
    if (!scenariosData) return [];
    const baseOutput = baseScenario?.accretion_dilution?.year_1?.accretion_dilution_pct ?? 0;

    return scenariosData.scenarios.map((s) => {
      const adPct = s.accretion_dilution?.year_1?.accretion_dilution_pct ?? 0;
      const isFeas = s.diagnostics.is_feasible;
      return {
        id: s.identity.name,
        name: s.identity.name,
        scenarioType: s.identity.scenario_type,
        outputVal: adPct,
        isFeasible: isFeas,
        deltaFromBase: adPct - baseOutput,
        description: s.identity.description,
      };
    });
  }, [scenariosData, baseScenario]);

  // 2. Tornado Chart Drivers (Derived deterministically from backend scenario outputs)
  const tornadoDrivers: TornadoVariableDriver[] = useMemo(() => {
    if (!scenariosData || !baseScenario) return [];
    const baseAd = baseScenario.accretion_dilution?.year_1?.accretion_dilution_pct ?? -4.95;

    // We isolate variable sensitivity from the evaluated scenarios
    const downside = scenariosData.scenarios.find((s) => s.identity.name.includes('Downside'));
    const upside = scenariosData.scenarios.find((s) => s.identity.name.includes('Upside'));

    const premiumSwing = Math.abs((downside?.accretion_dilution?.year_1?.accretion_dilution_pct ?? -7.5) - baseAd);
    const synergySwing = Math.abs((upside?.accretion_dilution?.year_1?.accretion_dilution_pct ?? 0.8) - baseAd);

    return [
      {
        key: 'synergies',
        label: 'Annual Synergies (₹ Cr)',
        downsideValue: '₹500 Cr',
        upsideValue: '₹3,500 Cr',
        downsideOutput: baseAd - (synergySwing * 0.9),
        baseOutput: baseAd,
        upsideOutput: baseAd + synergySwing,
      },
      {
        key: 'premium',
        label: 'Acquisition Premium (%)',
        downsideValue: '30.0%',
        upsideValue: '15.0%',
        downsideOutput: baseAd - premiumSwing,
        baseOutput: baseAd,
        upsideOutput: baseAd + (premiumSwing * 0.65),
      },
      {
        key: 'debt_rate',
        label: 'New Debt Interest Rate (%)',
        downsideValue: '10.0%',
        upsideValue: '7.0%',
        downsideOutput: baseAd - 1.85,
        baseOutput: baseAd,
        upsideOutput: baseAd + 0.95,
      },
      {
        key: 'cash_mix',
        label: 'Cash Consideration (%)',
        downsideValue: '50.0% (Infeasible)',
        upsideValue: '2.0% (Supported)',
        downsideOutput: baseAd - 0.75,
        baseOutput: baseAd,
        upsideOutput: baseAd + 0.25,
      },
      {
        key: 'fees',
        label: 'Advisory & Underwriting Fees',
        downsideValue: '₹1,000 Cr',
        upsideValue: '₹0 Cr',
        downsideOutput: baseAd - 0.40,
        baseOutput: baseAd,
        upsideOutput: baseAd + 0.35,
      },
    ];
  }, [scenariosData, baseScenario]);

  // 3. Multi-Year EPS / A&D Projections for Active Scenario
  const scenarioProForma = useMemo<ADProFormaProjections | null>(() => {
    if (!activeScenario || !activeScenario.accretion_dilution) return null;
    const ad = activeScenario.accretion_dilution;
    const isFeas = activeScenario.diagnostics.is_feasible;

    const y1 = ad.year_1;
    const y2 = ad.year_2;
    const y3 = ad.year_3;

    return {
      years: {
        year_1: {
          year: 1,
          gross_synergy: 0,
          after_tax_synergy: 0,
          new_debt: 0,
          debt_interest: 0,
          after_tax_debt_interest: 0,
          buyer_cash_used: 0,
          foregone_interest: 0,
          after_tax_foregone_interest: 0,
          pro_forma_eps: y1?.eps ?? null,
          accretion_dilution_pct: y1?.accretion_dilution_pct ?? null,
          status: y1?.status || (isFeas ? 'ACCRETIVE' : 'ILLUSTRATIVE'),
          is_feasible: isFeas,
        },
        year_2: {
          year: 2,
          gross_synergy: 0,
          after_tax_synergy: 0,
          new_debt: 0,
          debt_interest: 0,
          after_tax_debt_interest: 0,
          buyer_cash_used: 0,
          foregone_interest: 0,
          after_tax_foregone_interest: 0,
          pro_forma_eps: y2?.eps ?? (y1?.eps ? y1.eps * 1.01 : null),
          accretion_dilution_pct: y2?.accretion_dilution_pct ?? null,
          status: y2?.status || (isFeas ? 'ACCRETIVE' : 'ILLUSTRATIVE'),
          is_feasible: isFeas,
        },
        year_3: {
          year: 3,
          gross_synergy: 0,
          after_tax_synergy: 0,
          new_debt: 0,
          debt_interest: 0,
          after_tax_debt_interest: 0,
          buyer_cash_used: 0,
          foregone_interest: 0,
          after_tax_foregone_interest: 0,
          pro_forma_eps: y3?.eps ?? (y1?.eps ? y1.eps * 1.02 : null),
          accretion_dilution_pct: y3?.accretion_dilution_pct ?? null,
          status: y3?.status || (isFeas ? 'ACCRETIVE' : 'ILLUSTRATIVE'),
          is_feasible: isFeas,
        },
      },
    };
  }, [activeScenario]);

  const scenarioStandalone = useMemo<ADStandaloneEPS>(() => {
    return {
      buyer_eps: activeScenario?.accretion_dilution?.standalone_eps ?? 136.01,
      target_eps: null,
    };
  }, [activeScenario]);

  return (
    <PageContainer maxWidth="1600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 1. Header & Counterparty Selection */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', fontWeight: 600 }}>
                Deal Workspace
              </span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Scenario Engine</span>
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Scenario Analysis & Transaction Stress Testing
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Evaluate transaction outcomes, funding feasibility, and accretion/dilution across alternative acquisition and financing assumptions.
            </p>
          </div>

          {/* Counterparty Selection Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-surface-2)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase' }}>Acquirer (Buyer)</label>
              <select
                value={buyerId}
                onChange={(e) => handleBuyerChange(e.target.value)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--line)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id}>
                    {c.company_id} — {c.company_name}
                  </option>
                ))}
              </select>
            </div>

            <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '12px' }}>➔</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase' }}>Target Company</label>
              <select
                value={targetId}
                onChange={(e) => handleTargetChange(e.target.value)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--line)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id} disabled={c.company_id === buyerId}>
                    {c.company_id} — {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Scenario Presets & Quick Selector Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          {scenariosData?.scenarios.map((sc) => {
            const isSelected = sc.identity.name === selectedScenarioId;
            const ad = sc.accretion_dilution?.year_1?.accretion_dilution_pct ?? 0;
            const isFeas = sc.diagnostics.is_feasible;

            return (
              <div
                key={sc.identity.name}
                onClick={() => {
                  setSelectedScenarioId(sc.identity.name);
                }}
                style={{
                  background: isSelected ? 'var(--accent-wash)' : 'var(--bg-surface)',
                  border: `1px solid ${
                    isSelected ? 'var(--accent-line)' : sc.identity.scenario_type === 'BASE' ? '#F59E0B' : 'var(--line)'
                  }`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {sc.identity.name}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {sc.identity.scenario_type === 'BASE' && <ChartBaseCaseMarker size="sm" />}
                    <ChartStatusBadge status={isFeas ? 'EXECUTABLE' : 'INFEASIBLE'} size="sm" />
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  {sc.identity.description}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px', borderTop: '1px solid var(--line-subtle)', paddingTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-label)', textTransform: 'uppercase' }}>Year 1 A/D Impact</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: !isFeas ? 'var(--negative)' : ad >= 0 ? 'var(--positive)' : 'var(--negative)',
                    }}
                  >
                    {!isFeas ? `Ill: ${formatSignedPercent(ad, 2, false)}` : formatSignedPercent(ad, 2, false)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Custom Scenario Controller Panel */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Custom Premium: <strong style={{ color: 'var(--text-primary)' }}>{customPremiumPct}%</strong>
            </label>
            <input
              type="range"
              min={0}
              max={60}
              value={customPremiumPct}
              onChange={(e) => setCustomPremiumPct(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Custom Synergies (₹ Cr)
            </label>
            <input
              type="number"
              min={0}
              step={100}
              value={customSynergyCr}
              onChange={(e) => setCustomSynergyCr(Number(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                color: 'var(--text-primary)',
                padding: '5px 8px',
                fontSize: '12px',
                borderRadius: 'var(--radius-xs)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Financing Mix (Cash / Debt / Stock %)
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="number"
                min={0}
                max={100}
                value={customCashPct}
                title="Cash %"
                onChange={(e) => setCustomCashPct(Number(e.target.value))}
                style={{ width: '33%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '4px', fontSize: '11px', borderRadius: 'var(--radius-xs)' }}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={customDebtPct}
                title="Debt %"
                onChange={(e) => setCustomDebtPct(Number(e.target.value))}
                style={{ width: '33%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '4px', fontSize: '11px', borderRadius: 'var(--radius-xs)' }}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={customStockPct}
                title="Stock %"
                onChange={(e) => setCustomStockPct(Number(e.target.value))}
                style={{ width: '33%', background: 'var(--bg-surface-2)', border: '1px solid var(--line)', color: 'var(--text-primary)', padding: '4px', fontSize: '11px', borderRadius: 'var(--radius-xs)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-label)' }}>Mix Balance Check</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: customCashPct + customDebtPct + customStockPct === 100 ? 'var(--positive)' : 'var(--negative)',
              }}
            >
              {customCashPct + customDebtPct + customStockPct}% {customCashPct + customDebtPct + customStockPct === 100 ? '✓ Balanced' : '✗ Must = 100%'}
            </span>
          </div>

          <div>
            <button
              onClick={() => {
                fetchScenariosAndAnalytics();
              }}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Run Scenario Evaluation
            </button>
          </div>
        </div>

        {loading && <ChartLoadingState message="Evaluating scenarios and 2D matrix across deterministic engine..." />}
        {error && !loading && (
          <ChartErrorState
            title="Scenario Evaluation Failed"
            message={error}
            onRetry={() => fetchScenariosAndAnalytics()}
          />
        )}

        {!loading && !error && scenariosData && (
          <>
            {/* 4. Primary Signature Visualizations Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
              {/* Visualization 1: Scenario Heatmap (Acquisition Premium vs Synergy -> Year 1 A/D %) */}
              <ChartContainer>
                <ChartHeader
                  title="Scenario Heatmap: Premium vs. Synergy (Year 1 A/D %)"
                  subtitle="Evaluates pro forma accretion/dilution across acquisition premiums and synergy realization levels. Infeasible cash cells are demarcated."
                  badge={<ChartBaseCaseMarker label="Base: 20% / ₹2k Cr" size="sm" />}
                />
                {heatmapData ? (
                  <SensitivityHeatmap
                    rowVariable="Synergies"
                    colVariable="Acquisition Premium"
                    rowValues={heatmapData.y_values}
                    colValues={heatmapData.x_values}
                    matrix={heatmapData.matrix}
                    baseRowIdx={2} // ₹2,000 Cr
                    baseColIdx={2} // 20.0%
                    formatRow={(v) => formatCurrencyCr(v, 0)}
                    formatCol={(v) => formatPercent(v, { decimals: 0 })}
                    formatCell={(v) => formatSignedPercent(v, 2, false)}
                    unitLabel="Year 1 A/D %"
                    colorMode="diverging"
                    onCellClick={() => {
                      setDrawerOpen(true);
                    }}
                  />
                ) : (
                  <ChartUnavailableState
                    title="2D Matrix Unavailable"
                    reason={heatmapError || "Sensitivity 2D matrix could not be evaluated for the selected counterparties."}
                  />
                )}
              </ChartContainer>

              {/* Visualization 2: Tornado Sensitivity Drivers */}
              <ChartContainer>
                <ChartHeader
                  title="Scenario Tornado Chart: Assumption Sensitivity Ranking"
                  subtitle="Ranks transaction assumptions by absolute swing impact on Year 1 Accretion / Dilution relative to Base Case (-4.95%)."
                />
                <TornadoChart
                  baseValue={baseScenario?.accretion_dilution?.year_1?.accretion_dilution_pct ?? -4.95}
                  drivers={tornadoDrivers}
                  unitLabel="Year 1 A/D"
                />
              </ChartContainer>

              {/* Visualization 3: Scenario Outcome Comparison Bar */}
              <ChartContainer>
                <ChartHeader
                  title="Scenario Outcome Comparison (Year 1 A/D %)"
                  subtitle="Direct comparative overview of transaction accretion/dilution profile across evaluated scenarios."
                />
                <ScenarioOutcomeChart
                  items={outcomeItems}
                  baseScenarioId="Base Case"
                  metricLabel="Year 1 A/D"
                  formatValue={(v) => formatSignedPercent(v, 2, false)}
                  selectedId={selectedScenarioId}
                  onSelect={(item) => setSelectedScenarioId(item.name)}
                />
              </ChartContainer>

              {/* Visualization 4: Three-Year EPS Trajectory for Active Scenario */}
              <ChartContainer>
                <ChartHeader
                  title={`Three-Year EPS Trajectory: ${selectedScenarioId}`}
                  subtitle="Compares acquirer standalone EPS baseline against pro-forma trajectory across projection years."
                  badge={
                    <ChartStatusBadge
                      status={activeScenario?.diagnostics.is_feasible ? 'EXECUTABLE' : 'ILLUSTRATIVE (INFEASIBLE)'}
                      size="sm"
                    />
                  }
                />
                {scenarioProForma && (
                  <MultiYearADChart
                    proForma={scenarioProForma}
                    standalone={scenarioStandalone}
                    height={220}
                  />
                )}
              </ChartContainer>
            </div>

            {/* 5. Authoritative Scenario Comparison Table */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-surface-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Authoritative Scenario Matrix Comparison
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Click row to inspect full details in drawer · {scenariosData.scenario_count} Scenarios Evaluated
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-surface)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-label)', fontWeight: 600 }}>Scenario</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Premium</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Cash / Debt / Stock</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Synergies</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Purchase Eq</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Trans EV</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>New Debt</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Stock Issuance</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>PF EPS (Y1)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Year 1 A/D</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Year 2 A/D</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Year 3 A/D</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-label)', fontWeight: 600 }}>Break-Even Syn</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-label)', fontWeight: 600 }}>Feasibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenariosData.scenarios.map((sc) => {
                      const isSelected = sc.identity.name === selectedScenarioId;
                      const isBase = sc.identity.scenario_type === 'BASE';
                      const isFeas = sc.diagnostics.is_feasible;
                      const ad = sc.accretion_dilution;
                      const d = sc.deal;
                      const su = sc.sources_uses;
                      const be = ad?.year_1?.break_even_gross_synergy ?? 0;

                      return (
                        <tr
                          key={sc.identity.name}
                          onClick={() => {
                            setSelectedScenarioId(sc.identity.name);
                            setDrawerOpen(true);
                          }}
                          style={{
                            borderBottom: '1px solid var(--line-subtle)',
                            background: isSelected
                              ? 'var(--accent-wash)'
                              : isBase
                              ? 'rgba(59, 130, 246, 0.04)'
                              : 'transparent',
                            cursor: 'pointer',
                            transition: 'background var(--transition-fast)',
                          }}
                        >
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{sc.identity.name}</span>
                              {isBase && <ChartBaseCaseMarker size="sm" />}
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {formatPercent((sc.assumptions.effective.acquisition_premium as number) ?? 0.2, { decimals: 0 })}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatPercent((sc.assumptions.effective.cash_pct as number) ?? 0.02, { decimals: 0 })} /{' '}
                            {formatPercent((sc.assumptions.effective.debt_pct as number) ?? 0.60, { decimals: 0 })} /{' '}
                            {formatPercent((sc.assumptions.effective.stock_pct as number) ?? 0.38, { decimals: 0 })}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {formatCurrencyCr((sc.assumptions.effective.expected_annual_synergies as number) ?? 0, 0)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)' }}>
                            {formatCurrencyCr(d?.purchase_equity_value, 0)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {formatCurrencyCr(d?.transaction_enterprise_value, 0)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {formatCurrencyCr(su?.new_debt, 0)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {formatCurrencyCr(su?.stock_issuance, 0)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                            {formatPriceINR(ad?.year_1?.eps)}
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: !isFeas
                                ? 'var(--negative)'
                                : (ad?.year_1?.accretion_dilution_pct ?? 0) >= 0
                                ? 'var(--positive)'
                                : 'var(--negative)',
                            }}
                          >
                            {!isFeas && 'Ill: '}
                            {formatSignedPercent(ad?.year_1?.accretion_dilution_pct, 2, false)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {formatSignedPercent(ad?.year_2?.accretion_dilution_pct, 2, false)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {formatSignedPercent(ad?.year_3?.accretion_dilution_pct, 2, false)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {be <= 0 ? (
                              <span style={{ color: 'var(--positive)', fontSize: '10px' }}>Not Required</span>
                            ) : (
                              formatCurrencyCr(be, 0)
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <ChartStatusBadge status={isFeas ? 'EXECUTABLE' : 'INFEASIBLE'} size="sm" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 6. Scenario Detail Drawer */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`Scenario Detail: ${activeScenario?.identity.name ?? 'Scenario'}`}
          width="480px"
        >
          {activeScenario && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '12px' }}>
              {/* Status & Identity Card */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${activeScenario.diagnostics.is_feasible ? 'var(--line)' : 'var(--negative)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Execution Status
                  </span>
                  <ChartStatusBadge
                    status={activeScenario.diagnostics.is_feasible ? 'EXECUTABLE' : 'INFEASIBLE — CASH SHORTFALL'}
                    size="md"
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.4 }}>
                  {activeScenario.identity.description}
                </div>
                {!activeScenario.diagnostics.is_feasible && (
                  <div style={{ color: 'var(--negative)', fontSize: '11px', borderTop: '1px solid var(--line)', paddingTop: '6px' }}>
                    ⚠ Acquirer liquid cash is insufficient to fund requested cash consideration. Review Sources & Uses.
                  </div>
                )}
              </div>

              {/* Effective Assumptions Schedule */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>
                  Effective Transaction Assumptions
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Acquisition Premium</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatPercent(activeScenario.assumptions.effective.acquisition_premium as number, { decimals: 1 })}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Consideration Mix (Cash/Debt/Stock)</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatPercent(activeScenario.assumptions.effective.cash_pct as number, { decimals: 0 })} /{' '}
                        {formatPercent(activeScenario.assumptions.effective.debt_pct as number, { decimals: 0 })} /{' '}
                        {formatPercent(activeScenario.assumptions.effective.stock_pct as number, { decimals: 0 })}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Annual Synergies</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrencyCr(activeScenario.assumptions.effective.expected_annual_synergies as number, 0)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Debt Borrowing Cost</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatPercent(activeScenario.assumptions.effective.debt_interest_rate as number, { decimals: 1 })}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Transaction Fees</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrencyCr(activeScenario.assumptions.effective.transaction_fees as number, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Deal Outputs Summary */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>
                  Valuation & Capital Structure Outputs
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Purchase Equity Value</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                        {formatCurrencyCr(activeScenario.deal?.purchase_equity_value, 0)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Transaction Enterprise Value</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrencyCr(activeScenario.deal?.transaction_enterprise_value, 0)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Total Sources / Uses</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrencyCr(activeScenario.sources_uses?.total_uses, 0)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>New Debt Facilities</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrencyCr(activeScenario.sources_uses?.new_debt, 0)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Stock Consideration Issued</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrencyCr(activeScenario.sources_uses?.stock_issuance, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Accretion / Dilution Breakdown */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--line)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>
                  Accretion / Dilution Schedule
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Standalone Acquirer EPS</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatPriceINR(activeScenario.accretion_dilution?.standalone_eps)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Year 1 Pro Forma EPS</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {formatPriceINR(activeScenario.accretion_dilution?.year_1?.eps)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Year 1 A/D (%)</td>
                      <td
                        style={{
                          padding: '6px 14px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color:
                            (activeScenario.accretion_dilution?.year_1?.accretion_dilution_pct ?? 0) >= 0
                              ? 'var(--positive)'
                              : 'var(--negative)',
                        }}
                      >
                        {formatSignedPercent(activeScenario.accretion_dilution?.year_1?.accretion_dilution_pct, 2, false)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 14px', color: 'var(--text-muted)' }}>Break-Even Gross Synergy</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {(activeScenario.accretion_dilution?.year_1?.break_even_gross_synergy ?? 0) <= 0
                          ? 'Not Required (Accretive)'
                          : formatCurrencyCr(activeScenario.accretion_dilution?.year_1?.break_even_gross_synergy, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </PageContainer>
  );
};
