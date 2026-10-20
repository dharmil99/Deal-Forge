export interface ActiveDealContext {
  id: string;
  buyerId: string;
  buyerName: string;
  targetId: string;
  targetName: string;
  status: 'active' | 'draft' | 'archived';
  basePremium: number;
}

export interface DealParameters {
  premiumPct: number;
  cashPct: number;
  debtPct: number;
  stockPct: number;
  synergiesCr: number;
  feesCr: number;
  debtInterestRate: number;
  foregoneCashRate: number;
  taxRate: number;
  refinanceDebt: boolean;
  sweepCash: boolean;
  debtFeePct: number;
  minCashBuffer: number;
}

export interface DealContextState {
  activeDeal: ActiveDealContext | null;
  availableDeals: ActiveDealContext[];
  dealParams: DealParameters;
  setActiveDeal: (deal: ActiveDealContext) => void;
  selectDealById: (id: string) => void;
  updateDealParams: (params: Partial<DealParameters>) => void;
  setCounterparties: (buyerId: string, targetId: string) => void;
}

