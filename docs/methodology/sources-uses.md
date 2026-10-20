# DealForge Sources & Uses Methodology & Funding Feasibility

## Overview

The Sources & Uses module establishes the complete closing balance of funds for an M&A transaction. It balances total capital required (Uses) with capital committed (Sources) and verifies executable liquidity.

---

## 1. Application of Funds (Uses)

The total capital required to close the transaction consists of:
1. **Target Equity Consideration**:
   ```
   Purchase Equity Value = Offer Price per Share × Target Diluted Shares
   ```
2. **Target Debt Refinancing**:
   - If `refinance_target_debt = True`, all existing target borrowings must be paid off at closing.
   - If `refinance_target_debt = False`, target debt is assumed by the combined company.
3. **Transaction Advisory & Legal Fees**:
   - M&A advisory, legal, accounting, and due diligence expenses (specified in ₹ Cr).
4. **Debt Issuance Underwriting Fees**:
   - Financing fees incurred on newly raised debt:
     ```
     Debt Issuance Fees = New Debt Raised × Debt Issuance Fee %
     ```

### Total Uses Formula
```
Total Uses = Purchase Equity Value + Target Debt Refinancing + Transaction Fees + Debt Issuance Fees
```

---

## 2. Financing Commitments (Sources)

The sources of capital funding the transaction consist of:
1. **Acquirer Cash Applied**: Liquid cash contributed from acquirer's pre-deal balance sheet.
2. **New Debt Financing**: Gross term borrowing raised to fund the acquisition.
3. **Stock Consideration**: Dollar value of new acquirer equity issued to target shareholders.
4. **Target Cash Swept**:
   - If `use_target_cash = True`, available target cash and bank balances are swept to reduce external funding requirements.

### Balance Invariant
By institutional convention:
```
Total Sources = Total Uses
```

---

## 3. Cash Reconciliation & Funding Feasibility

A transaction may appear mathematically balanced on paper while remaining physically unexecutable due to insufficient balance-sheet cash. DealForge performs a strict liquidity audit:

### Available Acquirer Liquidity
```
Maximum Usable Acquirer Cash = Pre-Deal Acquirer Cash − Minimum Cash Balance Buffer
```
The minimum cash buffer (typically ₹500 Cr – ₹1,000 Cr) represents non-negotiable operational working capital that cannot be spent on deal consideration.

### Feasibility Determination
```
Cash Required = Acquirer Cash Applied + (Transaction Fees funded with cash)
Funding Shortfall = max(0, Cash Required − Maximum Usable Acquirer Cash)
```

- **EXECUTABLE**: `Funding Shortfall == 0`. Acquirer possesses sufficient liquid reserves to cover all cash demands while maintaining the mandatory buffer.
- **INFEASIBLE**: `Funding Shortfall > 0`. Acquirer cash is insufficient. The deal cannot close without:
  1. Raising additional third-party debt.
  2. Increasing the stock consideration percentage.
  3. Securing an equity rights issuance or sponsor equity infusion.

> [!CAUTION]
> If a transaction is infeasible, DealForge never conceals the deficit with a fictional plug. The report explicitly flags `EXECUTION STATUS: INFEASIBLE` and segregates illustrative economic outcomes from executable transaction structures.
