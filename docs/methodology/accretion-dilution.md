# DealForge Accretion / Dilution & Synergy Methodology

## Overview

Accretion / Dilution analysis measures the financial impact of a proposed M&A transaction on the acquirer's standalone Earnings Per Share (EPS). Projections are generated across a 3-year horizon incorporating capital structure costs and synergy phase-in.

---

## 1. Pro Forma Earnings Per Share (EPS) Formula

### Pro Forma Net Income Calculation
For each projection year `t` (Years 1, 2, and 3):
```
Pro Forma Net Income = 
    Acquirer Standalone Net Income
  + Target Net Income Contribution
  + After-Tax Operational Synergies
  − After-Tax Interest on New Debt
  − After-Tax Foregone Interest on Cash
```

Where:
- **After-Tax Operational Synergies**:
  ```
  After-Tax Synergies = Annual Pre-Tax Synergies × (1 − Tax Rate)
  ```
  - Standard realization ramp: Year 1 = 33.0%, Year 2 = 66.7%, Year 3 = 100.0% of steady-state run-rate synergies.
- **After-Tax New Debt Interest**:
  ```
  New Debt Interest = New Debt Issued × Debt Interest Rate
  After-Tax Debt Cost = New Debt Interest × (1 − Tax Rate)
  ```
- **After-Tax Foregone Cash Interest**:
  ```
  Foregone Interest = (Acquirer Cash Applied + Target Cash Swept) × Foregone Cash Rate
  After-Tax Foregone Cash Cost = Foregone Interest × (1 − Tax Rate)
  ```

### Pro Forma Share Count
```
Pro Forma Diluted Shares = Acquirer Standalone Shares + (Stock Consideration Amount / Acquirer Share Price)
```

### Pro Forma EPS
```
Pro Forma EPS = Pro Forma Net Income / Pro Forma Diluted Shares
```

### Accretion / Dilution Percentage
```
Accretion / Dilution % = ((Pro Forma EPS − Acquirer Standalone EPS) / Acquirer Standalone EPS) × 100
```
- **ACCRETIVE**: Accretion / Dilution % > 0.0%
- **NEUTRAL**: Accretion / Dilution % == 0.0%
- **DILUTIVE**: Accretion / Dilution % < 0.0%

---

## 2. Break-Even Gross Synergy Analysis

The break-even synergy represents the annual pre-tax operational synergy required to offset all financing friction, new share dilution, and interest drag so that Pro Forma EPS exactly equals Standalone Acquirer EPS:

### Formula
```
Target Net Income Required = (Acquirer Standalone EPS × Pro Forma Diluted Shares) − Acquirer Standalone Net Income
Pre-Tax Gap = (Target Net Income Required − Target Net Income + After-Tax Financing Costs) / (1 − Tax Rate)
Break-Even Gross Synergy = Pre-Tax Gap
```

### Interpretation & Institutional Labeling
1. **Positive Break-Even Synergy (`Break-Even > 0`)**:
   - The deal is naturally dilutive without operational synergy.
   - The target must deliver at least the break-even amount in annual pre-tax cost or revenue synergies to prevent earnings dilution.
   - **Synergy Cushion**:
     ```
     Synergy Cushion = Modeled Annual Synergy − Break-Even Gross Synergy
     ```
     - Positive cushion: Surplus buffer mitigating execution risk.
     - Negative cushion: Synergy shortfall exposing acquirer to earnings compression.

2. **Zero or Negative Break-Even Synergy (`Break-Even <= 0`)**:
   - The transaction is **already accretive before any operational synergies** due to favorable valuation multiples or low-cost financing.
   - Institutional label:
     `"SYNERGY NOT REQUIRED — Already accretive before incremental synergy"`
   - No operational integration synergies are required to justify the transaction from an EPS perspective.
