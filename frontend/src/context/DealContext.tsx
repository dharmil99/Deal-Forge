import React, { createContext, useContext, useState, useMemo } from 'react';
import type { ActiveDealContext, DealContextState, DealParameters } from '@/types/deal';

const DEFAULT_DEALS: ActiveDealContext[] = [
  {
    id: 'tcs-infosys',
    buyerId: 'TCS',
    buyerName: 'Tata Consultancy Services',
    targetId: 'Infosys',
    targetName: 'Infosys Limited',
    status: 'active',
    basePremium: 0.20,
  },
  {
    id: 'reliance-ultratech',
    buyerId: 'Reliance Industries',
    buyerName: 'Reliance Industries Ltd',
    targetId: 'UltraTech Cement',
    targetName: 'UltraTech Cement Ltd',
    status: 'draft',
    basePremium: 0.15,
  },
  {
    id: 'hdfc-icici',
    buyerId: 'HDFC Bank',
    buyerName: 'HDFC Bank Ltd',
    targetId: 'ICICI Bank',
    targetName: 'ICICI Bank Ltd',
    status: 'draft',
    basePremium: 0.25,
  },
];

const DEFAULT_DEAL_PARAMS: DealParameters = {
  premiumPct: 20,
  cashPct: 2,
  debtPct: 60,
  stockPct: 38,
  synergiesCr: 2000,
  feesCr: 500,
  debtInterestRate: 8.0,
  foregoneCashRate: 5.0,
  taxRate: 25.0,
  refinanceDebt: true,
  sweepCash: true,
  debtFeePct: 2.0,
  minCashBuffer: 1000.0,
};

const DealContext = createContext<DealContextState | undefined>(undefined);

export const DealProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDeal, setActiveDeal] = useState<ActiveDealContext | null>(DEFAULT_DEALS[0]);
  const [availableDeals] = useState<ActiveDealContext[]>(DEFAULT_DEALS);
  const [dealParams, setDealParams] = useState<DealParameters>(DEFAULT_DEAL_PARAMS);

  const selectDealById = (id: string) => {
    const found = availableDeals.find((d) => d.id === id);
    if (found) {
      setActiveDeal(found);
      setDealParams((prev) => ({
        ...prev,
        premiumPct: Math.round(found.basePremium * 100),
      }));
    }
  };

  const updateDealParams = (params: Partial<DealParameters>) => {
    setDealParams((prev) => ({
      ...prev,
      ...params,
    }));
  };

  const setCounterparties = (buyerId: string, targetId: string) => {
    setActiveDeal((prev) => ({
      id: `${buyerId.toLowerCase()}-${targetId.toLowerCase()}`,
      buyerId,
      buyerName: prev?.buyerId === buyerId ? prev.buyerName : buyerId,
      targetId,
      targetName: prev?.targetId === targetId ? prev.targetName : targetId,
      status: prev?.status || 'active',
      basePremium: (dealParams.premiumPct || 20) / 100,
    }));
  };

  const value = useMemo(
    () => ({
      activeDeal,
      availableDeals,
      dealParams,
      setActiveDeal,
      selectDealById,
      updateDealParams,
      setCounterparties,
    }),
    [activeDeal, availableDeals, dealParams],
  );

  return <DealContext.Provider value={value}>{children}</DealContext.Provider>;
};

export function useDealContext(): DealContextState {
  const context = useContext(DealContext);
  if (!context) {
    throw new Error('useDealContext must be used within a DealProvider');
  }
  return context;
}

