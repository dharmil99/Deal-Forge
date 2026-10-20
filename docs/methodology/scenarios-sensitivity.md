# DealForge Scenario & Sensitivity Analysis Methodology

## Overview

The Scenario and Sensitivity Analysis engines evaluate transaction robustness against operational, market, and capital-structure volatility. They identify key swing drivers and quantify risk boundaries.

---

## 1. Scenario Analysis Engine

### Standard Scenarios
DealForge evaluates transactions across three standardized institutional scenarios:
1. **Base Case (Management Baseline)**:
   - Reflects the active deal structuring assumptions, baseline acquisition premium (typically 20%), modeled run-rate synergies (e.g. ₹2,000 Cr), and prevailing corporate borrowing costs (e.g. 8.0% p.a.).
2. **Downside (Operational Stress Case)**:
   - Evaluates simultaneous friction:
     - Elevated acquisition control premium (e.g. 30.0%).
     - Compressed synergy realization (e.g. ₹500 Cr, representing 75% execution impairment).
     - Elevated borrowing costs (e.g. 10.0% p.a., reflecting credit tightening).
3. **Upside (Bull Integration Case)**:
   - Evaluates favorable deal dynamics:
     - Disciplined control premium (e.g. 15.0%).
     - Accelerated synergy realization (e.g. ₹3,500 Cr).
     - Tight credit spreads on financing (e.g. 7.0% p.a.).

### Scenario Processing Pipeline
For each scenario:
```
Base Request + Overrides → Deal Model → Sources & Uses → Accretion / Dilution → Feasibility & Financial Metrics
```
Each scenario explicitly reports `year_1_eps`, `year_1_ad_pct`, and `is_feasible`.

---

## 2. Sensitivity Analysis Engine (1D & 2D)

### Supported Sensitivity Variables
The sensitivity engine supports dynamic variation across 7 core transaction inputs:
1. `acquisition_premium`: Offer premium over target undisturbed price (e.g. 10% to 30%).
2. `expected_annual_synergies`: Run-rate pre-tax operational synergies (₹ Cr).
3. `debt_pct`: Debt financing fraction of purchase equity consideration.
4. `cash_pct`: Cash consideration fraction.
5. `stock_pct`: Stock consideration fraction.
6. `debt_interest_rate`: Pre-tax borrowing cost on newly raised term debt.
7. `transaction_fees`: Total advisory, legal, and structuring transaction fees (₹ Cr).

### Supported Output Metrics
- `year_1_ad_pct`: Year 1 EPS accretion / dilution percentage.
- `year_1_eps`: Year 1 pro forma earnings per share in ₹ INR.
- `transaction_ev`: Implied transaction enterprise value in ₹ Cr.
- `purchase_equity_value`: Implied target purchase equity consideration in ₹ Cr.
- `break_even_gross_synergy`: Pre-tax annual synergy required for 0.00% EPS dilution.
- `is_feasible`: Boolean indicating whether acquirer cash covers the cash consideration.

### Infeasible Cell Preservation
> [!IMPORTANT]
> If a specific variable combination creates an unexecutable funding structure (e.g. cash required exceeds available acquirer liquidity), DealForge **never returns 0.00% as a fallback**.
> 
> The sensitivity cell explicitly preserves:
> - `output`: Illustrative metric value or `null` if calculation cannot complete.
> - `is_feasible`: `False`.
> - UI/API status: Explicitly labeled `INFEASIBLE (UNFUNDED)` or `DATA UNAVAILABLE`.
