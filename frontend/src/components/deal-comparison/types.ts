import type { AccretionDilutionResponse, DealResponse } from '@/types/api';

export interface ComparisonDeal {
  id: string;
  buyerId: string;
  buyerName: string;
  targetId: string;
  targetName: string;
  premiumPct: number; // e.g. 20 (meaning 20%)
  cashPct: number; // e.g. 50 (meaning 50%)
  debtPct: number; // e.g. 30 (meaning 30%)
  stockPct: number; // e.g. 20 (meaning 20%)
  synergiesCr: number; // e.g. 1500
  dealData: DealResponse | null;
  adData: AccretionDilutionResponse | null;
  loading: boolean;
  error: string | null;
}

export interface PresetDealDef {
  id: string;
  label: string;
  description: string;
  buyerId: string;
  buyerName: string;
  targetId: string;
  targetName: string;
  premiumPct: number;
  cashPct: number;
  debtPct: number;
  stockPct: number;
  synergiesCr: number;
}

export const PRESET_DEALS: PresetDealDef[] = [
  {
    id: 'tcs-infosys',
    label: 'TCS → Infosys',
    description: 'Mega-cap IT Services consolidation (₹5.5L Cr)',
    buyerId: 'TCS',
    buyerName: 'Tata Consultancy Services Ltd',
    targetId: 'Infosys',
    targetName: 'Infosys Ltd',
    premiumPct: 20,
    cashPct: 50,
    debtPct: 30,
    stockPct: 20,
    synergiesCr: 1500,
  },
  {
    id: 'hcltech-wipro',
    label: 'HCLTech → Wipro',
    description: 'Large-cap IT peer combination (₹2.3L Cr)',
    buyerId: 'HCLTech',
    buyerName: 'HCL Technologies Ltd',
    targetId: 'Wipro',
    targetName: 'Wipro Ltd',
    premiumPct: 15,
    cashPct: 40,
    debtPct: 30,
    stockPct: 30,
    synergiesCr: 800,
  },
  {
    id: 'hdfcbank-icicibank',
    label: 'HDFCBank → ICICIBank',
    description: 'Private banking powerhouse combination (₹31.2L Cr)',
    buyerId: 'HDFCBank',
    buyerName: 'HDFC Bank Ltd',
    targetId: 'ICICIBank',
    targetName: 'ICICI Bank Ltd',
    premiumPct: 25,
    cashPct: 50,
    debtPct: 30,
    stockPct: 20,
    synergiesCr: 2500,
  },
  {
    id: 'ambuja-acc',
    label: 'Ambuja Cements → ACC',
    description: 'Executable Accretive: Cement peer combination (₹30K Cr)',
    buyerId: 'Ambuja Cements',
    buyerName: 'Ambuja Cements Ltd',
    targetId: 'ACC',
    targetName: 'ACC Ltd',
    premiumPct: 18,
    cashPct: 0,
    debtPct: 50,
    stockPct: 50,
    synergiesCr: 500,
  },
  {
    id: 'tcs-coforge',
    label: 'TCS → Coforge',
    description: 'Executable Dilutive: Mid-tier digital engineering bolt-on (₹45K Cr)',
    buyerId: 'TCS',
    buyerName: 'Tata Consultancy Services Ltd',
    targetId: 'Coforge',
    targetName: 'Coforge Ltd',
    premiumPct: 15,
    cashPct: 5,
    debtPct: 45,
    stockPct: 50,
    synergiesCr: 300,
  },
];
