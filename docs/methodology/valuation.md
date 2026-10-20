# DealForge Valuation Methodology

## Overview

DealForge provides an institutional-grade valuation triangulation engine for Indian corporate M&A. Valuation ranges are established across three primary methodologies:
1. **Comparable Companies Analysis (Trading Comps)**
2. **Precedent Transactions Analysis (Deal Comps)**
3. **Discounted Cash Flow (DCF) Analysis**

The consolidated output is synthesized in the **Valuation Summary & Football Field Benchmark**, which establishes the low, reference (midpoint), and high equity value ranges for the target company.

---

## 1. Comparable Companies Analysis (Comps)

### Peer Group Selection & Multiples
- Peer groups are established dynamically based on `sector` and `industry` mapped in `sector_mapping.csv`.
- Supported trading multiples:
  - **EV / EBITDA**: Enterprise Value to derived EBITDA (Primary multiple for Industrial sector companies).
  - **P / E (Price to Earnings)**: Market Capitalization to Latest Net Income.
  - **P / B (Price to Book)**: Market Capitalization to Net Book Value (Equity).
  - **EV / Sales**: Enterprise Value to Annual Revenue.

### Metric Aggregation
- Peer group multiples are computed across:
  - **25th Percentile (Low)**
  - **Median / 50th Percentile (Mid / Reference)**
  - **75th Percentile (High)**
- Implied target equity value is derived by applying peer group benchmark multiples to target's latest financial metrics:
  ```
  Implied Target EV = Peer Multiple × Target Financial Metric
  Implied Target Equity Value = Implied Target EV − Target Net Debt
  ```
- If derived target EBITDA is non-positive or unavailable, EV/EBITDA is marked as unavailable and excluded from summary triangulation.

---

## 2. Precedent Transactions Analysis

### Transaction Universe & Limitations
- DealForge maintains a curated database of verified historical M&A transactions in the Indian corporate market (`data/transactions.csv`).
- Each transaction record captures:
  - `acquirer_name`, `target_name`, `announcement_date`, `sector`, `deal_size_cr`
  - `ev_sales_multiple`, `ev_ebitda_multiple`, `pe_multiple`, `control_premium`

### Important Analytical Limitation: Precedent EV/EBITDA
> [!IMPORTANT]
> In historical Indian public M&A filings, target companies frequently do not disclose audited EBITDA specifically for the acquisition perimeter at announcement date. Consequently, the **EV/EBITDA multiple is unavailable** for certain precedent transactions.
> 
> When target EBITDA is undisclosed:
> 1. DealForge explicitly flags `ev_ebitda_available = False`.
> 2. The precedent EV/EBITDA multiple returns `N/A — DATA UNAVAILABLE`.
> 3. Triangulation safely falls back to Precedent EV/Sales, Precedent P/E, Trading Comps, and DCF without inventing or approximating missing financial metrics.

---

## 3. Discounted Cash Flow (DCF) Valuation

### Core Methodology
DealForge implements a deterministic 5-year discrete projection DCF model followed by a terminal value calculation:
```
Enterprise Value = PV(Discrete Unlevered Free Cash Flows, Years 1–5) + PV(Terminal Value)
Equity Value = Enterprise Value − Target Net Debt
```

### Key DCF Assumptions
- **Weighted Average Cost of Capital (WACC)**: Derived via Capital Asset Pricing Model (CAPM):
  ```
  Cost of Equity (Ke) = Risk-Free Rate + Beta × Equity Risk Premium
  WACC = (E/V × Ke) + (D/V × Kd × (1 − Tax Rate))
  ```
  - Standard baseline WACC for Indian Tier-1 IT / Large-cap Industrials: ~11.0% – 13.0% (Reference: 12.8%).
- **Terminal Growth Rate (g)**: Perpetual growth rate benchmarked to long-term Indian GDP growth and sector maturity (Baseline range: 4.0% – 6.0%; Reference: 5.0%).
- **Projection Free Cash Flow (FCF)**:
  ```
  UFCF = EBIT × (1 − Tax Rate) + D&A − Capex − Change in Working Capital
  ```

---

## 4. Valuation Triangulation & Football Field

- The Valuation Summary aggregates ranges across:
  - 52-Week Trading Range (Low / High / Current Price)
  - Comparable Companies EV/EBITDA
  - Comparable Companies P/E
  - Precedent Transactions EV/Sales & P/E
  - DCF Valuation (Low WACC / High Growth to High WACC / Low Growth)
- Offer price and acquisition premium are benchmarked against this range to establish control premium fairness.
