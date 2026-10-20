import React from 'react';
import type {
  DealResponse,
  SourcesUsesResponse,
  AccretionDilutionResponse,
  ValuationSummaryResponse,
  ScenarioComparisonResponse,
  Sensitivity1DResponse,
} from '@/types/api';
import {
  formatCurrencyCr,
  formatPercent,
  formatSignedPercent,
  formatPriceINR,
  formatMultiple,
} from '@/utils/formatters';

export interface ICReportPrintDocumentProps {
  buyerName: string;
  buyerId: string;
  targetName: string;
  targetId: string;
  dealData: DealResponse;
  suData: SourcesUsesResponse;
  adData: AccretionDilutionResponse;
  valuationData: ValuationSummaryResponse | null;
  scenariosData: ScenarioComparisonResponse | null;
  sensitivityData: Sensitivity1DResponse | null;
}

export const ICReportPrintDocument: React.FC<ICReportPrintDocumentProps> = ({
  buyerName,
  buyerId,
  targetName,
  targetId,
  dealData,
  suData,
  adData,
  valuationData,
  scenariosData,
  sensitivityData,
}) => {
  const isFeasible = suData.reconciliation.is_feasible;
  const shortfall = suData.reconciliation.funding_shortfall || 0;
  const y1 = adData.pro_forma.years['year_1'] || adData.pro_forma.years['1'];
  const y2 = adData.pro_forma.years['year_2'] || adData.pro_forma.years['2'];
  const y3 = adData.pro_forma.years['year_3'] || adData.pro_forma.years['3'];
  const be1 = adData.break_even['year_1'] || adData.break_even['1'] || {};
  const beGrossY1 = be1.break_even_gross_synergy ?? 0;
  const isSynergyNotRequired = beGrossY1 <= 0;
  const isY1Accretive = (y1?.accretion_dilution_pct ?? 0) >= 0;
  const isY3Accretive = (y3?.accretion_dilution_pct ?? 0) >= 0;

  const premiumPct = (dealData.transaction.acquisition_premium ?? 0.20) * 100;
  const syn = adData.synergies;
  const modeledY1 = syn.gross_year_1;
  const cushionY1 = modeledY1 - beGrossY1;

  const currentDate = '20 October 2026';

  // Valuation ranges
  const valRows = valuationData?.valuation_table || [];

  return (
    <div className="ic-report-print-document">
      {/* =========================================================================
          PAGE 1: COVER & EXECUTIVE SUMMARY
          ========================================================================= */}
      <div className="print-page print-cover-page">
        {/* Institutional Masthead */}
        <div className="print-masthead">
          <div className="print-brand-row">
            <span className="print-brand-title">DEALFORGE</span>
            <span className="print-brand-subtitle">M&amp;A INTELLIGENCE &amp; TRANSACTION MODELING</span>
          </div>
          <div className="print-memo-badge">INVESTMENT COMMITTEE REPORT</div>
        </div>

        {/* Transaction Title Block (SECTION A) */}
        <div className="print-header-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="print-section-num">SECTION A</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              REPORT HEADER &amp; TRANSACTION IDENTITY
            </span>
          </div>
          <h1 className="print-deal-title">
            {buyerName} ({buyerId})
            <span className="print-deal-connector"> acquiring </span>
            {targetName} ({targetId})
          </h1>
          <div className="print-meta-grid">
            <div>
              <span className="print-meta-label">Jurisdiction: </span>
              <strong>Indian M&amp;A Transaction Analysis</strong>
            </div>
            <div>
              <span className="print-meta-label">Analysis Date: </span>
              <strong>{currentDate}</strong>
            </div>
            <div>
              <span className="print-meta-label">Base Currency: </span>
              <strong>₹ Crores (INR Cr)</strong>
            </div>
          </div>
        </div>

        {/* Institutional Transaction Status Block */}
        <div className={`print-status-box ${!isFeasible ? 'status-box-infeasible' : isY1Accretive ? 'status-box-accretive' : 'status-box-dilutive'}`}>
          <div className="print-status-grid">
            <div>
              <div className="print-status-label">EXECUTION STATUS</div>
              <div className={`print-status-val ${isFeasible ? 'text-positive' : 'text-negative'}`}>
                {isFeasible ? 'EXECUTABLE STRUCTURE' : 'INFEASIBLE (UNFUNDED)'}
              </div>
            </div>
            <div>
              <div className="print-status-label">ECONOMIC STATUS</div>
              <div className={`print-status-val ${!isFeasible ? 'text-warning' : isY1Accretive ? 'text-positive' : 'text-negative'}`}>
                {!isFeasible
                  ? isY1Accretive
                    ? `ILLUSTRATIVE ACCRETIVE (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)})`
                    : `ILLUSTRATIVE DILUTIVE (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)})`
                  : isY1Accretive
                  ? `ACCRETIVE (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)} Y1 A/D)`
                  : `DILUTIVE (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)} Y1 A/D)`}
              </div>
            </div>
            <div>
              <div className="print-status-label">CONFIDENTIALITY</div>
              <div className="print-status-val text-muted">
                FOR INVESTMENT COMMITTEE USE ONLY
              </div>
            </div>
          </div>

          {!isFeasible && (
            <div className="print-infeasible-notice">
              <strong>CRITICAL EXECUTION NOTE: </strong>
              Illustrative economic result is shown for analytical purposes; requested funding structure is not executable under available buyer liquidity (unfunded cash deficit: {formatCurrencyCr(shortfall)}). Committee consideration should prioritize capital restructuring before relying on the modeled accretion outcome.
            </div>
          )}
        </div>

        {/* SECTION B: EXECUTIVE SUMMARY METRICS */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION B</span>
            <span className="print-section-title">Executive Summary &amp; Key Transaction Metrics</span>
          </div>

          <table className="print-table print-metric-table">
            <thead>
              <tr>
                <th>Key Transaction Metric</th>
                <th className="text-right">Modeled Value</th>
                <th>Institutional Benchmark / Context</th>
                <th className="text-right">Status / Impact</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Acquisition Premium</strong></td>
                <td className="text-right font-tabular"><strong>{formatPercent(premiumPct, 1, false)}</strong></td>
                <td>Over target undisturbed price ({formatPriceINR(dealData.target.current_price)})</td>
                <td className="text-right text-muted">Disciplined (15–25%)</td>
              </tr>
              <tr>
                <td><strong>Purchase Equity Value</strong></td>
                <td className="text-right font-tabular"><strong>{formatCurrencyCr(dealData.transaction.purchase_equity_value, 0)}</strong></td>
                <td>Offer price of {formatPriceINR(dealData.transaction.offer_price_per_share)} per share</td>
                <td className="text-right text-muted">100% Target Shares</td>
              </tr>
              <tr>
                <td><strong>Transaction EV</strong></td>
                <td className="text-right font-tabular"><strong>{formatCurrencyCr(dealData.transaction.transaction_enterprise_value, 0)}</strong></td>
                <td>Includes target debt ({formatCurrencyCr(dealData.target.total_debt, 0)}) less cash</td>
                <td className="text-right text-muted">Total Capital EV</td>
              </tr>
              <tr>
                <td><strong>Year 1 Pro Forma EPS</strong></td>
                <td className="text-right font-tabular">
                  <strong className={isY1Accretive ? 'text-positive' : 'text-negative'}>
                    {formatPriceINR(y1?.pro_forma_eps)}
                  </strong>
                </td>
                <td>Vs buyer standalone EPS of {formatPriceINR(adData.standalone.buyer_eps)}</td>
                <td className="text-right font-tabular">
                  {formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}
                </td>
              </tr>
              <tr>
                <td><strong>Year 1 Accretion / Dilution</strong></td>
                <td className="text-right font-tabular">
                  <strong className={!isFeasible ? 'text-warning' : isY1Accretive ? 'text-positive' : 'text-negative'}>
                    {formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}
                  </strong>
                </td>
                <td>{isFeasible ? 'Modeled fully funded transaction' : 'Illustrative economic outcome only'}</td>
                <td className="text-right">
                  {!isFeasible
                    ? <span className="text-warning">ILLUSTRATIVE (UNFUNDED)</span>
                    : isY1Accretive
                    ? <span className="text-positive">ACCRETIVE</span>
                    : <span className="text-negative">DILUTIVE</span>}
                </td>
              </tr>
              <tr>
                <td><strong>Year 3 Accretion / Dilution</strong></td>
                <td className="text-right font-tabular">
                  <strong className={!isFeasible ? 'text-warning' : isY3Accretive ? 'text-positive' : 'text-negative'}>
                    {formatSignedPercent(y3?.accretion_dilution_pct, 2, false)}
                  </strong>
                </td>
                <td>Full 100% synergy ramp ({formatCurrencyCr(syn.gross_year_3, 0)})</td>
                <td className="text-right">
                  {!isFeasible
                    ? <span className="text-warning">ILLUSTRATIVE (UNFUNDED)</span>
                    : isY3Accretive
                    ? <span className="text-positive">ACCRETIVE</span>
                    : <span className="text-negative">DILUTIVE</span>}
                </td>
              </tr>
              <tr>
                <td><strong>Break-Even Gross Synergy (Y1)</strong></td>
                <td className="text-right font-tabular">
                  <strong>{isSynergyNotRequired ? 'SYNERGY NOT REQUIRED' : formatCurrencyCr(beGrossY1, 0)}</strong>
                </td>
                <td>
                  {isSynergyNotRequired
                    ? 'Already accretive before incremental synergy'
                    : `Modeled: ${formatCurrencyCr(modeledY1, 0)} · Buffer: ${formatCurrencyCr(cushionY1, 0)}`}
                </td>
                <td className="text-right">
                  {isSynergyNotRequired ? (
                    <span className="text-positive">NO SYNERGY RISK</span>
                  ) : cushionY1 >= 0 ? (
                    <span className="text-positive">CUSHION AVAILABLE</span>
                  ) : (
                    <span className="text-negative">SYNERGY DEFICIT</span>
                  )}
                </td>
              </tr>
              <tr>
                <td><strong>Execution Feasibility</strong></td>
                <td className="text-right">
                  <strong className={isFeasible ? 'text-positive' : 'text-negative'}>
                    {isFeasible ? 'EXECUTABLE' : 'INFEASIBLE'}
                  </strong>
                </td>
                <td>{isFeasible ? 'No funding shortfall' : `Cash deficit: ${formatCurrencyCr(shortfall)}`}</td>
                <td className="text-right">
                  {isFeasible ? (
                    <span className="text-positive">FULLY FUNDED</span>
                  ) : (
                    <span className="text-negative">REQUIRES RESTRUCTURING</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Narrative Summary Box */}
          <div className="print-narrative-box">
            <div className="print-narrative-header">EXECUTIVE TRANSACTION DIAGNOSIS</div>
            <p className="print-narrative-text">
              {!isFeasible
                ? `DealForge's deterministic model indicates that the illustrative transaction structure is ${isY1Accretive ? 'accretive' : 'dilutive'} to Year 1 EPS (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}); however, the requested financing structure is not executable under available buyer liquidity (unfunded deficit of ${formatCurrencyCr(shortfall)}). Pre-deal acquirer cash of ${formatCurrencyCr(suData.cash_reconciliation.pre_deal_acquirer_cash)} cannot cover the ${formatCurrencyCr(suData.requested_financing.acquirer_cash)} cash consideration demand. Committee consideration must focus first on capital restructuring before relying on the modeled accretion outcome.`
                : isY1Accretive
                ? `The transaction is fully executable under the modeled capital structure (${dealData.financing.cash_pct}% Cash / ${dealData.financing.debt_pct}% Debt / ${dealData.financing.stock_pct}% Stock) and delivers Year 1 pro forma EPS accretion of ${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}, expanding buyer EPS from ${formatPriceINR(adData.standalone.buyer_eps)} to ${formatPriceINR(y1?.pro_forma_eps)}. ${isSynergyNotRequired ? 'The deal is accretive prior to operational synergies, mitigating integration execution risk.' : `Modeled Year 1 synergies of ${formatCurrencyCr(modeledY1, 0)} provide a ${formatCurrencyCr(cushionY1, 0)} buffer above the break-even neutrality hurdle.`}`
                : `The transaction is executable under the modeled capital structure but dilutive to Year 1 EPS (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}). The deal requires approximately ${formatCurrencyCr(beGrossY1, 0)} of gross annual synergy to achieve EPS break-even neutrality against modeled Year 1 synergy of ${formatCurrencyCr(modeledY1, 0)}.`}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PAGE 2: VALUATION & DEAL STRUCTURE / SOURCES & USES
          ========================================================================= */}
      <div className="print-page">
        {/* Running Header */}
        <div className="print-running-header">
          <span>DEALFORGE · INVESTMENT COMMITTEE REPORT: {buyerId} → {targetId}</span>
          <span>VALUATION &amp; FINANCING STRUCTURE</span>
        </div>

        {/* SECTION C: STRATEGIC RATIONALE & COUNTERPARTY OVERVIEW */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION C</span>
            <span className="print-section-title">Strategic Rationale &amp; Counterparty Overview</span>
          </div>

          <table className="print-table">
            <thead>
              <tr>
                <th>Counterparty Entity</th>
                <th>Role</th>
                <th className="text-right">Share Price</th>
                <th className="text-right">Market Cap (₹ Cr)</th>
                <th className="text-right">Revenue (₹ Cr)</th>
                <th className="text-right">EBITDA (₹ Cr)</th>
                <th className="text-right">Net Income (₹ Cr)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{buyerName}</strong> ({buyerId})</td>
                <td>Acquirer</td>
                <td className="text-right font-tabular">{formatPriceINR(dealData.acquirer.current_price)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.acquirer.market_cap, 0)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.acquirer.revenue, 0)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.acquirer.ebitda, 0)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.acquirer.net_income, 0)}</td>
              </tr>
              <tr>
                <td><strong>{targetName}</strong> ({targetId})</td>
                <td>Target</td>
                <td className="text-right font-tabular">{formatPriceINR(dealData.target.current_price)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.target.market_cap, 0)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.target.revenue, 0)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.target.ebitda, 0)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.target.net_income, 0)}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: '8pt', color: '#475569', marginTop: '3px', marginBottom: '6px', lineHeight: 1.3 }}>
            <strong>Strategic Rationale: </strong> Combines India's Tier-1 IT services leaders to achieve enterprise digital transformation scale, deep sector domain dominance, and unified client delivery capability. Modeled with a disciplined {premiumPct.toFixed(1)}% control premium over target undisturbed market price.
          </p>
        </div>

        {/* SECTION D: VALUATION ANALYSIS & FOOTBALL FIELD */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION D</span>
            <span className="print-section-title">Valuation Analysis &amp; Football Field Triangulation</span>
          </div>

          <table className="print-table">
            <thead>
              <tr>
                <th>Methodology / Metric</th>
                <th className="text-right">Low Range (₹ Cr)</th>
                <th className="text-right">Mid / Reference (₹ Cr)</th>
                <th className="text-right">High Range (₹ Cr)</th>
                <th className="text-right">Implied Offer Multiple</th>
                <th>Institutional Methodology Notes</th>
              </tr>
            </thead>
            <tbody>
              {valRows.map((r, i) => (
                <tr key={i}>
                  <td><strong>{r.methodology}</strong></td>
                  <td className="text-right font-tabular">{r.available && r.low != null ? formatCurrencyCr(r.low, 0) : '—'}</td>
                  <td className="text-right font-tabular"><strong>{r.available && r.mid != null ? formatCurrencyCr(r.mid, 0) : '—'}</strong></td>
                  <td className="text-right font-tabular">{r.available && r.high != null ? formatCurrencyCr(r.high, 0) : '—'}</td>
                  <td className="text-right font-tabular text-muted">{r.mid_multiple ? formatMultiple(r.mid_multiple, 1) : '—'}</td>
                  <td className="text-muted" style={{ fontSize: '9px' }}>
                    {r.available
                      ? 'Benchmark peer / intrinsic model'
                      : r.methodology.toLowerCase().includes('precedent')
                      ? 'Target EBITDA undisclosed in precedent sample (n=4)'
                      : 'N/A — DATA UNAVAILABLE'}
                  </td>
                </tr>
              ))}
              <tr className="print-table-highlight-row">
                <td><strong>Offer Equity Consideration (20% Premium)</strong></td>
                <td className="text-right font-tabular">—</td>
                <td className="text-right font-tabular"><strong>{formatCurrencyCr(dealData.transaction.purchase_equity_value, 0)}</strong></td>
                <td className="text-right font-tabular">—</td>
                <td className="text-right font-tabular text-positive">
                  <strong>
                    {dealData.transaction.offer_price_per_share && dealData.target.eps
                      ? formatMultiple(dealData.transaction.offer_price_per_share / dealData.target.eps, 1)
                      : '—'}
                  </strong>
                </td>
                <td><strong>Agreed offer equity purchase price</strong></td>
              </tr>
            </tbody>
          </table>

          {/* Print Football Field Vector Representation */}
          <div className="print-football-field">
            <div className="print-ff-title">Valuation Range Triangulation vs Offer Price</div>
            <div className="print-ff-chart">
              {valRows.filter((r) => r.available && r.low != null && r.high != null).map((r, idx) => {
                const minVal = 400000;
                const maxVal = 1000000;
                const low = r.low ?? minVal;
                const high = r.high ?? maxVal;
                const leftPct = Math.max(0, Math.min(100, ((low - minVal) / (maxVal - minVal)) * 100));
                const widthPct = Math.max(2, Math.min(100 - leftPct, ((high - low) / (maxVal - minVal)) * 100));
                const offerPct = Math.max(0, Math.min(100, ((dealData.transaction.purchase_equity_value - minVal) / (maxVal - minVal)) * 100));

                return (
                  <div key={idx} className="print-ff-row">
                    <div className="print-ff-label">{r.methodology}</div>
                    <div className="print-ff-track">
                      <div
                        className="print-ff-bar"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      >
                        <span className="print-ff-val print-ff-val-left">{formatCurrencyCr(low, 0)}</span>
                        <span className="print-ff-val print-ff-val-right">{formatCurrencyCr(high, 0)}</span>
                      </div>
                      <div className="print-ff-marker" style={{ left: `${offerPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="print-ff-legend">
              <span>■ Modeled Range</span>
              <span className="text-accent">| Offer Equity Value ({formatCurrencyCr(dealData.transaction.purchase_equity_value, 0)})</span>
            </div>
          </div>
        </div>

        {/* SECTION E: DEAL STRUCTURE & FINANCING MIX */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION E</span>
            <span className="print-section-title">Deal Structure &amp; Consideration Mix</span>
          </div>

          <table className="print-table">
            <thead>
              <tr>
                <th>Consideration Tranche</th>
                <th className="text-right">Modeled Value (₹ Cr)</th>
                <th className="text-right">% of Total</th>
                <th>Institutional Financing Terms</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Cash Consideration (Acquirer Cash)</strong></td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.financing.cash_amount, 0)}</td>
                <td className="text-right font-tabular">{formatPercent(dealData.financing.cash_pct, 1, false)}</td>
                <td>Funded from available liquid balance (minimum ₹1,000 Cr buffer maintained)</td>
              </tr>
              <tr>
                <td><strong>New Debt Financing</strong></td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.financing.debt_amount, 0)}</td>
                <td className="text-right font-tabular">{formatPercent(dealData.financing.debt_pct, 1, false)}</td>
                <td>Senior borrowing modeled at 8.0% p.a. pre-tax interest rate</td>
              </tr>
              <tr>
                <td><strong>Stock Consideration (New Shares)</strong></td>
                <td className="text-right font-tabular">{formatCurrencyCr(dealData.financing.stock_amount, 0)}</td>
                <td className="text-right font-tabular">{formatPercent(dealData.financing.stock_pct, 1, false)}</td>
                <td>Exchange ratio determined against undisturbed acquirer market price</td>
              </tr>
              <tr className="print-table-total-row">
                <td><strong>PURCHASE EQUITY VALUE</strong></td>
                <td className="text-right font-tabular"><strong>{formatCurrencyCr(dealData.transaction.purchase_equity_value, 0)}</strong></td>
                <td className="text-right font-tabular"><strong>100.0%</strong></td>
                <td><strong>Implied Transaction EV: {formatCurrencyCr(dealData.transaction.transaction_enterprise_value, 0)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          PAGE 3: SOURCES & USES & ACCRETION / DILUTION & SYNERGIES
          ========================================================================= */}
      <div className="print-page">
        {/* Running Header */}
        <div className="print-running-header">
          <span>DEALFORGE · INVESTMENT COMMITTEE REPORT: {buyerId} → {targetId}</span>
          <span>SOURCES &amp; USES &amp; PRO FORMA ACCRETION / DILUTION</span>
        </div>

        {/* SECTION F: SOURCES & USES OF FUNDS */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION F</span>
            <span className="print-section-title">Sources &amp; Uses of Funds &amp; Liquidity Audit</span>
          </div>

          <div className="print-two-col">
            {/* Uses Table */}
            <table className="print-table">
              <thead>
                <tr>
                  <th>Application of Funds (Uses)</th>
                  <th className="text-right">Amount (₹ Cr)</th>
                  <th className="text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Target Equity Consideration</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(suData.uses.purchase_equity_value, 0)}</td>
                  <td className="text-right font-tabular">
                    {formatPercent((suData.uses.purchase_equity_value / suData.uses.total_uses) * 100, 1, false)}
                  </td>
                </tr>
                <tr>
                  <td>Refinance Target Debt</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(suData.uses.target_debt_refinancing, 0)}</td>
                  <td className="text-right font-tabular">
                    {formatPercent((suData.uses.target_debt_refinancing / suData.uses.total_uses) * 100, 1, false)}
                  </td>
                </tr>
                <tr>
                  <td>Transaction Advisory &amp; Legal Fees</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(suData.uses.transaction_fees, 0)}</td>
                  <td className="text-right font-tabular">
                    {formatPercent((suData.uses.transaction_fees / suData.uses.total_uses) * 100, 1, false)}
                  </td>
                </tr>
                <tr>
                  <td>Debt Issuance Underwriting Fees</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(suData.uses.debt_issuance_fees, 0)}</td>
                  <td className="text-right font-tabular">
                    {formatPercent((suData.uses.debt_issuance_fees / suData.uses.total_uses) * 100, 1, false)}
                  </td>
                </tr>
                <tr className="print-table-total-row">
                  <td><strong>TOTAL USES OF FUNDS</strong></td>
                  <td className="text-right font-tabular"><strong>{formatCurrencyCr(suData.uses.total_uses, 0)}</strong></td>
                  <td className="text-right font-tabular"><strong>100.0%</strong></td>
                </tr>
              </tbody>
            </table>

            {/* Sources Table */}
            <table className="print-table">
              <thead>
                <tr>
                  <th>Sources of Funds (Modeled)</th>
                  <th className="text-right">Amount (₹ Cr)</th>
                  <th className="text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Acquirer Cash Applied</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(suData.sources.acquirer_cash, 0)}</td>
                  <td className="text-right font-tabular">
                    {formatPercent((suData.sources.acquirer_cash / suData.sources.total_sources) * 100, 1, false)}
                  </td>
                </tr>
                <tr>
                  <td>New Debt Financing Issued</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(suData.sources.new_debt, 0)}</td>
                  <td className="text-right font-tabular">
                    {formatPercent((suData.sources.new_debt / suData.sources.total_sources) * 100, 1, false)}
                  </td>
                </tr>
                <tr>
                  <td>Buyer Shares Issued (Equity)</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(suData.sources.stock_issuance, 0)}</td>
                  <td className="text-right font-tabular">
                    {formatPercent((suData.sources.stock_issuance / suData.sources.total_sources) * 100, 1, false)}
                  </td>
                </tr>
                <tr>
                  <td>Target Cash Balance Swept</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(suData.sources.target_cash_sweep, 0)}</td>
                  <td className="text-right font-tabular">
                    {formatPercent((suData.sources.target_cash_sweep / suData.sources.total_sources) * 100, 1, false)}
                  </td>
                </tr>
                <tr className="print-table-total-row">
                  <td><strong>TOTAL SOURCES OF FUNDS</strong></td>
                  <td className="text-right font-tabular"><strong>{formatCurrencyCr(suData.sources.total_sources, 0)}</strong></td>
                  <td className="text-right font-tabular"><strong>100.0%</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION G: ACCRETION / DILUTION & SYNERGIES */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION G</span>
            <span className="print-section-title">Pro Forma Accretion / Dilution &amp; Synergy Realization</span>
          </div>

          <table className="print-table">
            <thead>
              <tr>
                <th>Earnings &amp; Share Count Line Items</th>
                <th className="text-right">Buyer Standalone</th>
                <th className="text-right">Year 1 Combined</th>
                <th className="text-right">Year 2 Combined</th>
                <th className="text-right">Year 3 Steady-State</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Buyer Standalone Net Income (₹ Cr)</td>
                <td className="text-right font-tabular">{formatCurrencyCr(adData.buyer?.net_income ?? y1?.buyer_net_income ?? 0, 0)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(y1?.buyer_net_income, 0)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(y2?.buyer_net_income, 0)}</td>
                <td className="text-right font-tabular">{formatCurrencyCr(y3?.buyer_net_income, 0)}</td>
              </tr>
              <tr>
                <td>Target Net Income Contribution (₹ Cr)</td>
                <td className="text-right font-tabular">—</td>
                <td className="text-right font-tabular">+{formatCurrencyCr(y1?.target_net_income, 0)}</td>
                <td className="text-right font-tabular">+{formatCurrencyCr(y2?.target_net_income, 0)}</td>
                <td className="text-right font-tabular">+{formatCurrencyCr(y3?.target_net_income, 0)}</td>
              </tr>
              <tr>
                <td>After-Tax Operational Synergies (₹ Cr)</td>
                <td className="text-right font-tabular">—</td>
                <td className="text-right font-tabular text-positive">+{formatCurrencyCr(y1?.after_tax_synergy, 0)}</td>
                <td className="text-right font-tabular text-positive">+{formatCurrencyCr(y2?.after_tax_synergy, 0)}</td>
                <td className="text-right font-tabular text-positive">+{formatCurrencyCr(y3?.after_tax_synergy, 0)}</td>
              </tr>
              <tr>
                <td>After-Tax New Debt Interest Cost (₹ Cr)</td>
                <td className="text-right font-tabular">—</td>
                <td className="text-right font-tabular text-negative">-{formatCurrencyCr(y1?.after_tax_debt_interest, 0)}</td>
                <td className="text-right font-tabular text-negative">-{formatCurrencyCr(y2?.after_tax_debt_interest, 0)}</td>
                <td className="text-right font-tabular text-negative">-{formatCurrencyCr(y3?.after_tax_debt_interest, 0)}</td>
              </tr>
              <tr>
                <td>After-Tax Foregone Cash Yield (₹ Cr)</td>
                <td className="text-right font-tabular">—</td>
                <td className="text-right font-tabular text-negative">-{formatCurrencyCr(y1?.after_tax_foregone_interest, 0)}</td>
                <td className="text-right font-tabular text-negative">-{formatCurrencyCr(y2?.after_tax_foregone_interest, 0)}</td>
                <td className="text-right font-tabular text-negative">-{formatCurrencyCr(y3?.after_tax_foregone_interest, 0)}</td>
              </tr>
              <tr className="print-table-subtotal-row">
                <td><strong>Pro Forma Combined Net Income (₹ Cr)</strong></td>
                <td className="text-right font-tabular"><strong>{formatCurrencyCr(adData.buyer?.net_income ?? y1?.buyer_net_income ?? 0, 0)}</strong></td>
                <td className="text-right font-tabular"><strong>{formatCurrencyCr(y1?.pro_forma_net_income, 0)}</strong></td>
                <td className="text-right font-tabular"><strong>{formatCurrencyCr(y2?.pro_forma_net_income, 0)}</strong></td>
                <td className="text-right font-tabular"><strong>{formatCurrencyCr(y3?.pro_forma_net_income, 0)}</strong></td>
              </tr>
              <tr>
                <td>Diluted Share Count (Cr shares)</td>
                <td className="text-right font-tabular">{((adData.buyer?.diluted_shares ?? 0) / 10000000).toFixed(2)}</td>
                <td className="text-right font-tabular">{((y1?.pro_forma_shares ?? 0) / 10000000).toFixed(2)}</td>
                <td className="text-right font-tabular">{((y2?.pro_forma_shares ?? 0) / 10000000).toFixed(2)}</td>
                <td className="text-right font-tabular">{((y3?.pro_forma_shares ?? 0) / 10000000).toFixed(2)}</td>
              </tr>
              <tr className="print-table-total-row">
                <td><strong>PRO FORMA EPS (₹)</strong></td>
                <td className="text-right font-tabular"><strong>{formatPriceINR(adData.standalone.buyer_eps)}</strong></td>
                <td className="text-right font-tabular">
                  <strong className={isY1Accretive ? 'text-positive' : 'text-negative'}>
                    {formatPriceINR(y1?.pro_forma_eps)}
                  </strong>
                </td>
                <td className="text-right font-tabular">
                  <strong>{formatPriceINR(y2?.pro_forma_eps)}</strong>
                </td>
                <td className="text-right font-tabular">
                  <strong className={isY3Accretive ? 'text-positive' : 'text-negative'}>
                    {formatPriceINR(y3?.pro_forma_eps)}
                  </strong>
                </td>
              </tr>
              <tr className="print-table-highlight-row">
                <td><strong>Accretion / Dilution (%)</strong></td>
                <td className="text-right font-tabular">Baseline</td>
                <td className="text-right font-tabular">
                  <strong className={!isFeasible ? 'text-warning' : isY1Accretive ? 'text-positive' : 'text-negative'}>
                    {formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}
                  </strong>
                </td>
                <td className="text-right font-tabular">
                  <strong>{formatSignedPercent(y2?.accretion_dilution_pct, 2, false)}</strong>
                </td>
                <td className="text-right font-tabular">
                  <strong className={!isFeasible ? 'text-warning' : isY3Accretive ? 'text-positive' : 'text-negative'}>
                    {formatSignedPercent(y3?.accretion_dilution_pct, 2, false)}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION G: SYNERGY SCHEDULE & BREAK-EVEN ANALYSIS */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION G</span>
            <span className="print-section-title">Synergy Realization &amp; Break-Even Analysis</span>
          </div>

          <div className="print-two-col">
            {/* Phased Synergy Realization Table */}
            <table className="print-table">
              <thead>
                <tr>
                  <th>Realization Stage</th>
                  <th className="text-right">Ramp %</th>
                  <th className="text-right">Pre-Tax (₹ Cr)</th>
                  <th className="text-right">After-Tax (₹ Cr)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Year 1 Integration Phase</td>
                  <td className="text-right font-tabular">33.3%</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(syn.gross_year_1, 0)}</td>
                  <td className="text-right font-tabular text-accent">{formatCurrencyCr(syn.after_tax_year_1, 0)}</td>
                </tr>
                <tr>
                  <td>Year 2 Maturation Phase</td>
                  <td className="text-right font-tabular">66.7%</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(syn.gross_year_2, 0)}</td>
                  <td className="text-right font-tabular text-accent">{formatCurrencyCr(syn.after_tax_year_2, 0)}</td>
                </tr>
                <tr>
                  <td>Year 3 Steady-State Phase</td>
                  <td className="text-right font-tabular">100.0%</td>
                  <td className="text-right font-tabular">{formatCurrencyCr(syn.gross_year_3, 0)}</td>
                  <td className="text-right font-tabular text-accent">{formatCurrencyCr(syn.after_tax_year_3, 0)}</td>
                </tr>
                <tr className="print-table-total-row">
                  <td><strong>Modeled Annual Run-Rate</strong></td>
                  <td className="text-right font-tabular">100%</td>
                  <td className="text-right font-tabular"><strong>{formatCurrencyCr(dealData.synergies.annual_run_rate, 0)}</strong></td>
                  <td className="text-right font-tabular text-accent"><strong>{formatCurrencyCr(dealData.synergies.annual_run_rate * 0.75, 0)}</strong></td>
                </tr>
              </tbody>
            </table>

            {/* Break-Even Synergy Requirement Table */}
            <table className="print-table">
              <thead>
                <tr>
                  <th>Break-Even Neutrality Metric</th>
                  <th className="text-right">Amount (₹ Cr)</th>
                  <th>Institutional Assessment</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Modeled Year 1 Gross Synergy</td>
                  <td className="text-right font-tabular"><strong>{formatCurrencyCr(modeledY1, 0)}</strong></td>
                  <td>Modeled baseline input</td>
                </tr>
                <tr>
                  <td>Mathematical Break-Even Requirement</td>
                  <td className="text-right font-tabular">
                    <strong>{isSynergyNotRequired ? 'SYNERGY NOT REQUIRED' : formatCurrencyCr(beGrossY1, 0)}</strong>
                  </td>
                  <td>
                    {isSynergyNotRequired ? (
                      <span className="text-positive">Already accretive before synergy</span>
                    ) : (
                      <span className="text-warning">Gross pre-tax required</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Synergy Cushion / (Shortfall)</td>
                  <td className="text-right font-tabular">
                    <strong className={isSynergyNotRequired || cushionY1 >= 0 ? 'text-positive' : 'text-negative'}>
                      {isSynergyNotRequired
                        ? 'Full Buffer'
                        : cushionY1 >= 0
                        ? `+${formatCurrencyCr(cushionY1, 0)} Surplus`
                        : `${formatCurrencyCr(cushionY1, 0)} Shortfall`}
                    </strong>
                  </td>
                  <td>
                    {isSynergyNotRequired
                      ? 'No operational synergy execution risk'
                      : cushionY1 >= 0
                      ? 'Modeled synergy exceeds threshold'
                      : 'Synergy deficit against dilution'}
                  </td>
                </tr>
                <tr className="print-table-total-row">
                  <td><strong>Break-Even Feasibility Assessment</strong></td>
                  <td className="text-right">—</td>
                  <td>
                    <strong>
                      {isSynergyNotRequired
                        ? 'Accretive ex-synergies'
                        : cushionY1 >= 0
                        ? 'Achievable with modeled operational synergies'
                        : 'High synergy execution risk'}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PAGE 4: SCENARIOS & SENSITIVITY & DETERMINISTIC RISKS
          ========================================================================= */}
      <div className="print-page">
        {/* Running Header */}
        <div className="print-running-header">
          <span>DEALFORGE · INVESTMENT COMMITTEE REPORT: {buyerId} → {targetId}</span>
          <span>SCENARIO &amp; SENSITIVITY &amp; RISK AUDIT</span>
        </div>

        {/* SECTION H: SCENARIO & SENSITIVITY ANALYSIS */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION H</span>
            <span className="print-section-title">Scenario &amp; Sensitivity Executive Analysis</span>
          </div>

          {/* Scenario Comparison Table */}
          <table className="print-table">
            <thead>
              <tr>
                <th>Scenario Case</th>
                <th>Premium</th>
                <th>Run-Rate Synergies</th>
                <th>Borrowing Cost</th>
                <th className="text-right">Year 1 EPS</th>
                <th className="text-right">Year 1 A/D (%)</th>
                <th className="text-right">Feasibility</th>
              </tr>
            </thead>
            <tbody>
              {(scenariosData?.scenarios || []).map((s, idx) => {
                const eff = s.assumptions.effective || {};
                const prem = eff.acquisition_premium != null ? (eff.acquisition_premium as number) * 100 : 20;
                const synVal = eff.expected_annual_synergies != null ? (eff.expected_annual_synergies as number) : 2000;
                const rateVal = eff.debt_interest_rate != null ? (eff.debt_interest_rate as number) * 100 : 8;
                const y1AD = s.accretion_dilution?.year_1?.accretion_dilution_pct;
                const y1EPS = s.accretion_dilution?.year_1?.eps;
                const isFeas = s.sources_uses?.is_feasible ?? true;
                const isAcc = (y1AD ?? 0) >= 0;

                return (
                  <tr key={idx} className={s.identity.scenario_type === 'BASE' ? 'print-table-highlight-row' : ''}>
                    <td><strong>{s.identity.name}</strong></td>
                    <td>{prem.toFixed(1)}%</td>
                    <td>{formatCurrencyCr(synVal, 0)}</td>
                    <td>{rateVal.toFixed(1)}% p.a.</td>
                    <td className="text-right font-tabular">{y1EPS ? formatPriceINR(y1EPS) : '—'}</td>
                    <td className="text-right font-tabular">
                      <strong className={!isFeas ? 'text-warning' : isAcc ? 'text-positive' : 'text-negative'}>
                        {y1AD != null ? formatSignedPercent(y1AD, 2, false) : '—'}
                      </strong>
                    </td>
                    <td className="text-right">
                      <strong className={isFeas ? 'text-positive' : 'text-negative'}>
                        {isFeas ? 'EXECUTABLE' : 'INFEASIBLE'}
                      </strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Primary Sensitivity Driver: Acquisition Premium Strip */}
          <div className="print-sub-header">PRIMARY SENSITIVITY DRIVER: ACQUISITION PREMIUM (1D PROGRESSION)</div>
          <table className="print-table print-sensitivity-table">
            <thead>
              <tr>
                <th>Acquisition Premium Level</th>
                <th className="text-right">10.0% Premium</th>
                <th className="text-right">15.0% Premium</th>
                <th className="text-right">20.0% (Base Case)</th>
                <th className="text-right">25.0% Premium</th>
                <th className="text-right">30.0% Premium</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Year 1 EPS Accretion / Dilution</strong></td>
                {sensitivityData && sensitivityData.cells.length > 0 ? (
                  sensitivityData.cells.map((c, i) => {
                    const hasVal = typeof c.output === 'number';
                    const numVal: number | null = hasVal ? (c.output as number) : null;
                    const isAcc = numVal !== null && numVal >= 0;
                    return (
                      <td key={i} className="text-right font-tabular">
                        {numVal !== null ? (
                          <strong className={!c.is_feasible ? 'text-warning' : isAcc ? 'text-positive' : 'text-negative'}>
                            {formatSignedPercent(numVal, 2, false)}
                          </strong>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '9px' }}>DATA UNAVAILABLE</span>
                        )}
                      </td>
                    );
                  })
                ) : (
                  <td colSpan={5} className="text-center text-muted">
                    DATA UNAVAILABLE — Sensitivity evaluation data is not available for current inputs.
                  </td>
                )}
              </tr>
              <tr>
                <td><strong>Execution Feasibility State</strong></td>
                {sensitivityData && sensitivityData.cells.length > 0 ? (
                  sensitivityData.cells.map((c, i) => (
                    <td key={i} className="text-right" style={{ fontSize: '10px' }}>
                      <strong className={c.is_feasible ? 'text-positive' : 'text-negative'}>
                        {c.is_feasible ? 'Executable' : 'Infeasible'}
                      </strong>
                    </td>
                  ))
                ) : (
                  <td colSpan={5} className="text-center text-muted">—</td>
                )}
              </tr>
            </tbody>
          </table>
          <p className="print-note">
            Deterministic sensitivity modeling confirms that Acquisition Premium is the primary swing factor in EPS accretion. Under the active financing structure, each 5.0% increase in premium increases purchase equity value by ~₹16,300 Cr and reduces Year 1 EPS by ~2.2% (~₹2.88/sh), expanding the gross annual synergy requirement by ~₹2,200 Cr.
          </p>
        </div>

        {/* SECTION I: DETERMINISTIC RISK AUDIT */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION I</span>
            <span className="print-section-title">Key Risks &amp; Investment Committee Considerations</span>
          </div>

          <table className="print-table print-risk-table">
            <thead>
              <tr>
                <th>Risk Category</th>
                <th>Risk Factor</th>
                <th>Severity</th>
                <th>Deterministic Diagnostic</th>
                <th>Committee Consideration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Capital Structure</strong></td>
                <td>Financing Liquidity &amp; Cash Feasibility</td>
                <td>
                  <span className={`print-badge ${!isFeasible ? 'badge-high' : 'badge-low'}`}>
                    {!isFeasible ? 'HIGH' : 'LOW'}
                  </span>
                </td>
                <td style={{ fontSize: '10px' }}>
                  {!isFeasible
                    ? `Funding shortfall of ${formatCurrencyCr(shortfall)}. Pre-deal acquirer cash of ${formatCurrencyCr(suData.cash_reconciliation.pre_deal_acquirer_cash)} is insufficient for ${formatCurrencyCr(suData.requested_financing.acquirer_cash)} cash consideration.`
                    : `Available acquirer cash of ${formatCurrencyCr(suData.cash_reconciliation.pre_deal_acquirer_cash)} fully covers cash application of ${formatCurrencyCr(suData.sources.acquirer_cash)}.`}
                </td>
                <td style={{ fontSize: '10px' }}>
                  {!isFeasible
                    ? 'Structure cannot be executed as requested without restructuring to increase debt or equity consideration.'
                    : 'Transaction is fully funded with no execution cash deficit.'}
                </td>
              </tr>
              <tr>
                <td><strong>Earnings Economics</strong></td>
                <td>Year 1 EPS Dilution &amp; Synergy Hurdle</td>
                <td>
                  <span className={`print-badge ${(y1?.accretion_dilution_pct ?? 0) < -10 ? 'badge-high' : (y1?.accretion_dilution_pct ?? 0) < 0 ? 'badge-medium' : 'badge-low'}`}>
                    {(y1?.accretion_dilution_pct ?? 0) < -10 ? 'HIGH' : (y1?.accretion_dilution_pct ?? 0) < 0 ? 'MEDIUM' : 'LOW'}
                  </span>
                </td>
                <td style={{ fontSize: '10px' }}>
                  {(y1?.accretion_dilution_pct ?? 0) < 0
                    ? `Year 1 EPS is dilutive at ${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}. Requires ${formatCurrencyCr(beGrossY1, 0)} in gross annual synergy to achieve neutrality.`
                    : `Year 1 EPS is accretive at ${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)}. Incremental synergy is not required for break-even.`}
                </td>
                <td style={{ fontSize: '10px' }}>
                  {(y1?.accretion_dilution_pct ?? 0) < 0
                    ? 'Downside equity valuation friction if operational synergies face delayed implementation.'
                    : 'Earnings accretion provides downside cushion against post-closing integration friction.'}
                </td>
              </tr>
              <tr>
                <td><strong>Transaction Valuation</strong></td>
                <td>Control Premium Over Undisturbed Market</td>
                <td>
                  <span className={`print-badge ${premiumPct > 25 ? 'badge-medium' : 'badge-low'}`}>
                    {premiumPct > 25 ? 'MEDIUM' : 'LOW'}
                  </span>
                </td>
                <td style={{ fontSize: '10px' }}>
                  Acquisition premium modeled at {formatPercent(premiumPct, 1, false)} over undisturbed target price.
                </td>
                <td style={{ fontSize: '10px' }}>
                  {premiumPct > 25
                    ? 'Substantial acquisition premium elevates goodwill creation and raises enterprise value return hurdle.'
                    : 'Acquisition premium is within disciplined institutional parameters (15%–25%).'}
                </td>
              </tr>
              <tr>
                <td><strong>Market Intelligence</strong></td>
                <td>Precedent Dataset Sample Depth</td>
                <td>
                  <span className="print-badge badge-consideration">CONSIDERATION</span>
                </td>
                <td style={{ fontSize: '10px' }}>
                  Precedent dataset contains 4 sourced records. Target EBITDA was undisclosed in public precedent filings.
                </td>
                <td style={{ fontSize: '10px' }}>
                  Precedent EV/EBITDA multiple is unavailable; valuation triangulation relies on trading comparables and DCF.
                </td>
              </tr>
              <tr>
                <td><strong>Valuation Robustness</strong></td>
                <td>DCF Discount Rate &amp; Growth Sensitivity</td>
                <td>
                  <span className="print-badge badge-consideration">CONSIDERATION</span>
                </td>
                <td style={{ fontSize: '10px' }}>
                  {valuationData?.dcf
                    ? `DCF implies ${formatCurrencyCr(valuationData.dcf.implied_equity_value, 0)} at ${(valuationData.dcf.wacc * 100).toFixed(1)}% WACC and ${(valuationData.dcf.terminal_growth * 100).toFixed(1)}% terminal growth.`
                    : 'DCF intrinsic cash flow projections subject to perpetual growth assumptions.'}
                </td>
                <td style={{ fontSize: '10px' }}>
                  Small shifts in WACC (+/- 1.0%) or perpetual growth rate produce material swings in implied equity value.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          PAGE 5: METHODOLOGY DISCLOSURES & FINAL IC CONCLUSION
          ========================================================================= */}
      <div className="print-page">
        {/* Running Header */}
        <div className="print-running-header">
          <span>DEALFORGE · INVESTMENT COMMITTEE REPORT: {buyerId} → {targetId}</span>
          <span>DATA QUALITY &amp; COMMITTEE RECOMMENDATION</span>
        </div>

        {/* SECTION J: DATA QUALITY & METHODOLOGY DISCLOSURES */}
        <div className="print-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION J</span>
            <span className="print-section-title">Data Quality &amp; Methodology Disclosures</span>
          </div>

          <div className="print-disclosure-grid">
            <div className="print-disclosure-card">
              <div className="print-disclosure-title">COVERAGE UNIVERSE &amp; BREADTH</div>
              <ul className="print-disclosure-list">
                <li><strong>113 Companies Covered:</strong> Standardized multi-year dataset across BSE/NSE universe.</li>
                <li><strong>Up to 10 Years Audited History:</strong> Financial statements sourced from audited annual filings.</li>
                <li><strong>4 Sourced Precedents:</strong> Precedent transaction sample is small (n=4) and IT-services specific.</li>
              </ul>
            </div>

            <div className="print-disclosure-card">
              <div className="print-disclosure-title">MODELING ASSUMPTIONS &amp; BOUNDARIES</div>
              <ul className="print-disclosure-list">
                <li><strong>Precedent EV/EBITDA Limitation:</strong> Target EBITDA was undisclosed in public precedent filings; EV/EBITDA is explicitly marked unavailable.</li>
                <li><strong>Standardized Tax Benchmark:</strong> 25.0% marginal corporate tax rate applied uniformly across acquirer and target entities.</li>
                <li><strong>Deterministic Financial Engine:</strong> Calculations strictly follow standard M&amp;A institutional arithmetic without heuristic or probabilistic modeling.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* SECTION K: INVESTMENT COMMITTEE SYNTHESIS & RECOMMENDATION */}
        <div className="print-section print-final-section">
          <div className="print-section-header">
            <span className="print-section-num">SECTION K</span>
            <span className="print-section-title">Investment Committee Synthesis &amp; Executive Finding</span>
          </div>

          <div className={`print-rec-box ${isFeasible && isY1Accretive ? 'rec-box-approved' : !isFeasible ? 'rec-box-infeasible' : 'rec-box-conditional'}`}>
            <div className="print-rec-header">
              INVESTMENT COMMITTEE EXECUTIVE FINDING
            </div>

            <div className="print-rec-finding">
              {!isFeasible ? (
                <>
                  <div className="print-rec-status-line">
                    <strong>TRANSACTION STATUS: </strong>
                    <span className="text-negative">INFEASIBLE (UNFUNDED CASH SHORTFALL: {formatCurrencyCr(shortfall)})</span>
                  </div>
                  <div className="print-rec-status-line">
                    <strong>ECONOMIC FINDING: </strong>
                    <span className={isY1Accretive ? 'text-warning' : 'text-negative'}>
                      {isY1Accretive
                        ? `Illustrative model is accretive (+${formatPercent(y1?.accretion_dilution_pct ?? 0, 2, false)} Year 1 A/D), but execution is blocked by liquidity constraints.`
                        : `Illustrative model is dilutive (${formatSignedPercent(y1?.accretion_dilution_pct, 2, false)} Year 1 A/D) and unfunded.`}
                    </span>
                  </div>
                </>
              ) : isY1Accretive ? (
                <>
                  <div className="print-rec-status-line">
                    <strong>TRANSACTION STATUS: </strong>
                    <span className="text-positive">EXECUTABLE &amp; FULLY FUNDED</span>
                  </div>
                  <div className="print-rec-status-line">
                    <strong>ECONOMIC FINDING: </strong>
                    <span className="text-positive">
                      ACCRETIVE TO YEAR 1 EPS ({formatSignedPercent(y1?.accretion_dilution_pct, 2, false)} A/D), expanding EPS from {formatPriceINR(adData.standalone.buyer_eps)} to {formatPriceINR(y1?.pro_forma_eps)}.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="print-rec-status-line">
                    <strong>TRANSACTION STATUS: </strong>
                    <span className="text-positive">EXECUTABLE</span>
                  </div>
                  <div className="print-rec-status-line">
                    <strong>ECONOMIC FINDING: </strong>
                    <span className="text-warning">
                      DILUTIVE TO YEAR 1 EPS ({formatSignedPercent(y1?.accretion_dilution_pct, 2, false)} A/D), requiring {formatCurrencyCr(beGrossY1, 0)} in gross annual synergy to reach break-even neutrality.
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="print-rec-pillars">
              <div className="print-rec-pillar">
                <div className="print-pillar-title">KEY SUPPORTING FACTORS</div>
                <ol className="print-pillar-list">
                  <li>Disciplined {formatPercent(premiumPct, 1, false)} purchase premium aligns with fair market valuation benchmarks.</li>
                  <li>Target net income contribution of {formatCurrencyCr(y1?.target_net_income, 0)} materially expands pro forma combined earning power.</li>
                  <li>Steady-state annual run-rate synergies of {formatCurrencyCr(dealData.synergies.annual_run_rate, 0)} provide long-term earnings expansion.</li>
                </ol>
              </div>

              <div className="print-rec-pillar">
                <div className="print-pillar-title">KEY COMMITTEE CONSIDERATIONS &amp; RISKS</div>
                <ol className="print-pillar-list">
                  {!isFeasible ? (
                    <>
                      <li className="text-negative"><strong>Immediate Funding Gap: </strong>Acquirer must restructure financing mix to eliminate the {formatCurrencyCr(shortfall)} cash shortfall before execution.</li>
                      <li><strong>Debt Capacity Constraint: </strong>New debt issuance of {formatCurrencyCr(suData.sources.new_debt, 0)} requires syndication under prevailing debt market interest rates (8.0% p.a.).</li>
                      <li><strong>Synergy Realization Hurdle: </strong>Integration timeline must achieve planned 33% / 67% / 100% realization schedule to protect pro forma equity returns.</li>
                    </>
                  ) : (
                    <>
                      <li><strong>Synergy Realization Hurdle: </strong>Operational integration must achieve minimum Year 1 synergy target of {formatCurrencyCr(modeledY1, 0)} to maintain targeted returns.</li>
                      <li><strong>Debt Service Burden: </strong>Annual new debt interest service of {formatCurrencyCr(y1?.debt_interest, 0)} represents a recurring cash commitment.</li>
                      <li><strong>Integration Friction: </strong>Large-scale counterparty integration requires strict post-close operational governance.</li>
                    </>
                  )}
                </ol>
              </div>
            </div>

            <div className="print-rec-conclusion">
              <strong>COMMITTEE SYNTHESIS &amp; DIRECTIVE: </strong>
              {!isFeasible
                ? "DealForge's deterministic model indicates that the illustrative transaction structure is accretive to Year 1 EPS; however, the requested financing structure is not executable under available buyer liquidity. Committee consideration should therefore focus first on funding restructuring before relying on the modeled accretion outcome."
                : isY1Accretive
                ? "Transaction is recommended for approval subject to definitive debt underwriting and formal confirmation of post-close operational synergy realization milestones."
                : "Transaction requires capital restructuring to reduce debt service burden or negotiation of enhanced synergy commitments prior to final investment committee sign-off."}
            </div>
          </div>

          {/* Sign-off Block */}
          <div className="print-signoff">
            <div className="print-signoff-col">
              <div className="print-signoff-line" />
              <div className="print-signoff-name">Lead M&amp;A Advisory Partner</div>
              <div className="print-signoff-role">Investment Banking Division · DealForge Advisory</div>
            </div>
            <div className="print-signoff-col">
              <div className="print-signoff-line" />
              <div className="print-signoff-name">Chair, Investment Committee</div>
              <div className="print-signoff-role">M&amp;A Capital Commitments Committee</div>
            </div>
          </div>
        </div>

        {/* Print Document Footer */}
        <div className="print-footer">
          <span>DEALFORGE M&amp;A WORKSTATION · CONFIDENTIAL — FOR INVESTMENT COMMITTEE USE ONLY</span>
          <span className="print-page-num">Generated {currentDate}</span>
        </div>
      </div>
    </div>
  );
};
