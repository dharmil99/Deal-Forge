import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDealContext } from '@/context/DealContext';
import { apiClient } from '@/services/api/client';
import type {
  DealResponse,
  SourcesUsesResponse,
  AccretionDilutionResponse,
  ValuationSummaryResponse,
  ScenarioComparisonResponse,
  Sensitivity1DResponse,
  ScenarioDefinitionSchema,
} from '@/types/api';
import {
  ICReportHeader,
  ICExecutiveSummary,
  ICTransactionOverview,
  ICValuationSection,
  ICFinancingSection,
  ICAccretionSection,
  ICSynergySection,
  ICScenarioSection,
  ICRiskSection,
  ICMethodologySection,
  ICConclusionSection,
  ICReportPrintDocument,
} from '@/components/ic-report';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export const ICReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeDeal, dealParams } = useDealContext();

  const buyerId = activeDeal?.buyerId || 'TCS';
  const targetId = activeDeal?.targetId || 'Infosys';
  const buyerName = activeDeal?.buyerName || buyerId;
  const targetName = activeDeal?.targetName || targetId;

  // Report Data States
  const [dealData, setDealData] = useState<DealResponse | null>(null);
  const [suData, setSuData] = useState<SourcesUsesResponse | null>(null);
  const [adData, setAdData] = useState<AccretionDilutionResponse | null>(null);
  const [valuationData, setValuationData] = useState<ValuationSummaryResponse | null>(null);
  const [scenariosData, setScenariosData] = useState<ScenarioComparisonResponse | null>(null);
  const [sensitivityData, setSensitivityData] = useState<Sensitivity1DResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReportData = useCallback(async () => {
    if (!buyerId || !targetId) return;

    setLoading(true);
    setError(null);

    const premiumRatio = (dealParams.premiumPct != null ? dealParams.premiumPct : 20.0) / 100;
    const cashRatio = (dealParams.cashPct != null ? dealParams.cashPct : 2.0) / 100;
    const debtRatio = (dealParams.debtPct != null ? dealParams.debtPct : 60.0) / 100;
    const stockRatio = (dealParams.stockPct != null ? dealParams.stockPct : 38.0) / 100;
    const synergiesCr = dealParams.synergiesCr ?? 2000.0;
    const feesCr = dealParams.feesCr ?? 500.0;
    const debtInterestRate = (dealParams.debtInterestRate != null ? dealParams.debtInterestRate : 8.0) / 100;
    const foregoneCashRate = (dealParams.foregoneCashRate != null ? dealParams.foregoneCashRate : 5.0) / 100;
    const taxRate = (dealParams.taxRate != null ? dealParams.taxRate : 25.0) / 100;
    const refinanceDebt = dealParams.refinanceDebt ?? true;
    const sweepCash = dealParams.sweepCash ?? true;
    const debtFeePct = (dealParams.debtFeePct != null ? dealParams.debtFeePct : 2.0) / 100;
    const minCashBuffer = dealParams.minCashBuffer ?? 1000.0;

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
    ];

    try {
      const results = await Promise.allSettled([
        // 0: Deal Builder
        apiClient.deals.buildDeal({
          buyer_id: buyerId,
          target_id: targetId,
          acquisition_premium: premiumRatio,
          cash_pct: cashRatio,
          debt_pct: debtRatio,
          stock_pct: stockRatio,
          expected_annual_synergies: synergiesCr,
          transaction_fees: feesCr,
        }),
        // 1: Sources & Uses
        apiClient.deals.sourcesAndUses({
          buyer_id: buyerId,
          target_id: targetId,
          acquisition_premium: premiumRatio,
          cash_pct: cashRatio,
          debt_pct: debtRatio,
          stock_pct: stockRatio,
          transaction_fees: feesCr,
          refinance_target_debt: refinanceDebt,
          use_target_cash: sweepCash,
          debt_issuance_fee_pct: debtFeePct,
          minimum_cash_balance: minCashBuffer,
        }),
        // 2: Accretion / Dilution
        apiClient.deals.accretionDilution({
          buyer_id: buyerId,
          target_id: targetId,
          acquisition_premium: premiumRatio,
          cash_pct: cashRatio,
          debt_pct: debtRatio,
          stock_pct: stockRatio,
          transaction_fees: feesCr,
          refinance_target_debt: refinanceDebt,
          use_target_cash: sweepCash,
          debt_issuance_fee_pct: debtFeePct,
          minimum_cash_balance: minCashBuffer,
          expected_annual_synergies: synergiesCr,
          debt_interest_rate: debtInterestRate,
          foregone_cash_interest_rate: foregoneCashRate,
          tax_rate: taxRate,
        }),
        // 3: Valuation Summary (Target)
        apiClient.companies.getValuation(targetId),
        // 4: Scenarios Suite
        apiClient.deals.compareScenarios({
          buyer_id: buyerId,
          target_id: targetId,
          base_assumptions: {
            acquisition_premium: premiumRatio,
            cash_pct: cashRatio,
            debt_pct: debtRatio,
            stock_pct: stockRatio,
            transaction_fees: feesCr,
            debt_issuance_fee_pct: debtFeePct,
            minimum_cash_balance: minCashBuffer,
            refinance_target_debt: refinanceDebt,
            use_target_cash: sweepCash,
            debt_interest_rate: debtInterestRate,
            foregone_cash_interest_rate: foregoneCashRate,
            tax_rate: taxRate,
            expected_annual_synergies: synergiesCr,
          },
          scenarios: scenariosPayload,
        }),
        // 5: Sensitivity 1D (Acquisition Premium)
        apiClient.deals.sensitivity1D({
          buyer_id: buyerId,
          target_id: targetId,
          base_assumptions: {
            acquisition_premium: premiumRatio,
            cash_pct: cashRatio,
            debt_pct: debtRatio,
            stock_pct: stockRatio,
            transaction_fees: feesCr,
            debt_issuance_fee_pct: debtFeePct,
            minimum_cash_balance: minCashBuffer,
            refinance_target_debt: refinanceDebt,
            use_target_cash: sweepCash,
            debt_interest_rate: debtInterestRate,
            foregone_cash_interest_rate: foregoneCashRate,
            tax_rate: taxRate,
            expected_annual_synergies: synergiesCr,
          },
          axis: {
            variable: 'acquisition_premium',
            values: [0.10, 0.15, 0.20, 0.25, 0.30],
          },
          output_metric: 'year_1_ad_pct',
        }),
      ]);

      // Unpack Core Calculations
      if (results[0].status === 'fulfilled') {
        setDealData(results[0].value);
      } else {
        throw new Error(`Deal Model calculation failed: ${results[0].reason?.message || results[0].reason}`);
      }

      if (results[1].status === 'fulfilled') {
        setSuData(results[1].value);
      } else {
        throw new Error(`Sources & Uses calculation failed: ${results[1].reason?.message || results[1].reason}`);
      }

      if (results[2].status === 'fulfilled') {
        setAdData(results[2].value);
      } else {
        throw new Error(`Accretion / Dilution calculation failed: ${results[2].reason?.message || results[2].reason}`);
      }

      // Optional / Supporting Analytics
      if (results[3].status === 'fulfilled') {
        setValuationData(results[3].value);
      } else {
        console.warn('Valuation Summary unavailable:', results[3].reason);
        setValuationData(null);
      }

      if (results[4].status === 'fulfilled') {
        setScenariosData(results[4].value);
      } else {
        console.warn('Scenarios comparison unavailable:', results[4].reason);
        setScenariosData(null);
      }

      if (results[5].status === 'fulfilled') {
        setSensitivityData(results[5].value);
      } else {
        console.warn('1D Sensitivity unavailable:', results[5].reason);
        setSensitivityData(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to synthesize IC Report data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [buyerId, targetId, dealParams]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  if (loading) {
    return (
      <div style={{ padding: '40px 24px', maxWidth: '1440px', margin: '0 auto' }}>
        <LoadingState message="Synthesizing Investment Committee Report from deterministic Phase 1–9 engines..." />
      </div>
    );
  }

  if (error || !dealData || !suData || !adData) {
    return (
      <div style={{ padding: '40px 24px', maxWidth: '1440px', margin: '0 auto' }}>
        <ErrorState
          error={error || 'Failed to load transaction data'}
          onRetry={fetchReportData}
        />
      </div>
    );
  }

  const isFeasible = suData.reconciliation.is_feasible;
  const y1 = adData.pro_forma.years['year_1'] || adData.pro_forma.years['1'];
  const isAccretive = (y1?.accretion_dilution_pct ?? 0) >= 0;
  const shortfall = suData.reconciliation.funding_shortfall || 0;

  return (
    <div
      className="ic-report-page-container"
      style={{
        padding: '24px 28px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        color: 'var(--text-primary)',
      }}
    >
      {/* 1. INTERACTIVE WEB VIEW (Restrained Investment Committee Workstation View) */}
      <div
        className="ic-report-interactive-view"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* SECTION A: REPORT HEADER */}
        <ICReportHeader
          buyerName={buyerName}
          buyerId={buyerId}
          targetName={targetName}
          targetId={targetId}
          isFeasible={isFeasible}
          isAccretive={isAccretive}
          unfundedDeficit={shortfall}
          onPrint={() => window.print()}
        />

        {/* SECTION B: EXECUTIVE SUMMARY */}
        <ICExecutiveSummary
          dealData={dealData}
          suData={suData}
          adData={adData}
        />

        {/* SECTION C: TRANSACTION OVERVIEW */}
        <ICTransactionOverview
          dealData={dealData}
          suData={suData}
        />

        {/* SECTION D: VALUATION ANALYSIS */}
        <ICValuationSection
          valuationData={valuationData}
          targetName={targetName}
          targetId={targetId}
          currentMarketCap={dealData.target.market_cap}
          onNavigateToValuation={() => navigate('/research/valuation')}
        />

        {/* SECTION E: PURCHASE PRICE & FINANCING */}
        <ICFinancingSection
          suData={suData}
          onNavigateToSourcesUses={() => navigate('/sources-uses')}
        />

        {/* SECTION F: ACCRETION / DILUTION */}
        <ICAccretionSection
          adData={adData}
          buyerId={buyerId}
          onNavigateToAD={() => navigate('/accretion-dilution')}
        />

        {/* SECTION G: SYNERGY ANALYSIS */}
        <ICSynergySection
          dealData={dealData}
          adData={adData}
        />

        {/* SECTION H: SCENARIO & SENSITIVITY */}
        <ICScenarioSection
          scenariosData={scenariosData}
          sensitivityData={sensitivityData}
          onNavigateToScenarios={() => navigate('/scenarios')}
          onNavigateToSensitivity={() => navigate('/sensitivity')}
        />

        {/* SECTION I: KEY RISKS / CONSIDERATIONS */}
        <ICRiskSection
          dealData={dealData}
          suData={suData}
          adData={adData}
          valuationData={valuationData}
        />

        {/* SECTION J: DATA QUALITY & METHODOLOGY */}
        <ICMethodologySection />

        {/* SECTION K: IC CONCLUSION */}
        <ICConclusionSection
          isFeasible={isFeasible}
          isAccretive={isAccretive}
          buyerName={buyerName}
          targetName={targetName}
        />
      </div>

      {/* 2. DEDICATED PRINT / PDF MEMORANDUM DOCUMENT (A4 Portrait, White Institutional Memo) */}
      <ICReportPrintDocument
        buyerName={buyerName}
        buyerId={buyerId}
        targetName={targetName}
        targetId={targetId}
        dealData={dealData}
        suData={suData}
        adData={adData}
        valuationData={valuationData}
        scenariosData={scenariosData}
        sensitivityData={sensitivityData}
      />
    </div>
  );
};
export default ICReportPage;
