# DealForge Deal Structuring Methodology

## Overview

The Deal Builder module provides the foundation for M&A transaction evaluation. It converts an acquirer-target pair and deal terms into purchase price, enterprise value, and initial financing amounts.

---

## 1. Purchase Price & Enterprise Value Formulas

### Offer Price per Share
The offer price per share applies the requested acquisition control premium over the target's undisturbed closing share price:
```
Offer Price per Share = Undisturbed Share Price × (1 + Acquisition Premium)
```
- Example: Target undisturbed price of ₹1,132.50 with a 20.0% premium results in an offer price of ₹1,362.46.

### Purchase Equity Value
```
Purchase Equity Value = Offer Price per Share × Target Diluted Shares Outstanding
```
This represents the total equity consideration required to acquire 100% of target shares.

### Transaction Enterprise Value (EV)
Transaction EV reflects the implied total capitalization of the target enterprise:
```
Transaction Enterprise Value = Purchase Equity Value + Target Total Debt − Target Cash & Equivalents
```

---

## 2. Consideration Financing Mix

The banker specifies the requested financing consideration mix across three tranches:
1. **Cash Consideration (%)**: Funded from acquirer cash reserves or external liquidity.
2. **Debt Consideration (%)**: Funded through new senior debt issuance.
3. **Stock Consideration (%)**: Funded through newly issued acquirer common equity.

### Mathematical Invariants
- The sum of consideration percentages must strictly equal 100%:
  ```
  Cash % + Debt % + Stock % = 100.0%
  ```
- Component consideration values:
  ```
  Cash Amount = Purchase Equity Value × Cash %
  Debt Amount = Purchase Equity Value × Debt %
  Stock Amount = Purchase Equity Value × Stock %
  ```

### New Acquirer Shares Issued
When stock consideration is utilized:
```
New Shares Issued = Stock Consideration Amount / Acquirer Undisturbed Share Price
Pro Forma Diluted Shares = Acquirer Standalone Shares + New Shares Issued
```
- The exchange ratio is defined as:
  ```
  Exchange Ratio = Offer Price per Share × Stock % / Acquirer Share Price
  ```
