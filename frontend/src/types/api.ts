// API Type Definitions matching FastAPI backend contracts

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
}

// =========================================================================
// Companies & Financials
// =========================================================================

export interface CompanySummary {
  company_id: string;
  company_name: string;
  ticker?: string | null;
  sector?: string | null;
  industry?: string | null;
  sector_type?: string | null;
  current_price?: number | null;
  market_cap_latest?: number | null;
  revenue_latest?: number | null;
  ebitda_latest?: number | null;
  ebitda_margin?: number | null;
  net_debt_latest?: number | null;
  ev?: number | null;
  pe_ratio?: number | null;
  ev_ebitda?: number | null;
  ev_revenue?: number | null;
  illustrative_screening_score?: number | null;
  // Legacy aliases for backward compatibility if any
  market_cap_cr?: number | null;
  is_financial?: boolean;
}

export interface CompanyListResponse {
  total: number;
  skip: number;
  limit: number;
  items: CompanySummary[];
}

export type CompanyListItem = CompanySummary;

export interface CompanyDetail {
  company_id: string;
  company_name: string;
  ticker?: string | null;
  source_file?: string | null;
  face_value?: number | null;
  current_price?: number | null;
  market_cap_latest?: number | null;
  sector?: string | null;
  industry?: string | null;
  sector_type?: string | null;
  latest_fiscal_year?: number | null;
  years_of_history?: number | null;
  revenue_latest?: number | null;
  revenue_cagr?: number | null;
  ebitda_latest?: number | null;
  ebitda_margin?: number | null;
  net_debt_latest?: number | null;
  net_income_latest?: number | null;
  shares_outstanding_latest?: number | null;
  shares_outstanding_fallback_year?: number | null;
  shares_outstanding_is_stale?: boolean | null;
  ev?: number | null;
  ev_ebitda?: number | null;
  net_debt_ebitda?: number | null;
  ev_revenue?: number | null;
  eps?: number | null;
  pe_ratio?: number | null;
  growth_score?: number | null;
  margin_score?: number | null;
  valuation_score?: number | null;
  leverage_score?: number | null;
  illustrative_screening_score?: number | null;
}

export interface CompanyFinancialRow {
  company_id: string;
  fiscal_year: number;
  revenue?: number | null;
  other_income?: number | null;
  depreciation?: number | null;
  interest?: number | null;
  pbt?: number | null;
  tax?: number | null;
  net_income?: number | null;
  ebitda_derived?: number | null;
  ebitda_margin_derived?: number | null;
  total_debt?: number | null;
  cash?: number | null;
  net_debt_derived?: number | null;
  shares_outstanding?: number | null;
}

export interface CompanyFinancialsResponse {
  company_id: string;
  count: number;
  financials: CompanyFinancialRow[];
}

// =========================================================================
// Screening
// =========================================================================

export interface ScreeningRequest {
  sector?: string | null;
  min_revenue_cagr?: number | null;
  min_ebitda_margin?: number | null;
  max_ev_ebitda?: number | null;
  max_net_debt_ebitda?: number | null;
  industrial_only?: boolean;
  sort_by?: string | null;
  ascending?: boolean;
  limit?: number | null;
  // Legacy alias support
  min_market_cap_cr?: number;
  max_market_cap_cr?: number;
  min_revenue_cagr_3yr?: number;
  min_ebitda_margin_latest?: number;
  sectors?: string[];
}

export interface ScreenedCompany {
  company_id: string;
  company_name: string;
  ticker?: string | null;
  sector?: string | null;
  industry?: string | null;
  sector_type?: string | null;
  revenue_latest?: number | null;
  revenue_cagr?: number | null;
  ebitda_latest?: number | null;
  ebitda_margin?: number | null;
  net_debt_latest?: number | null;
  ev?: number | null;
  ev_ebitda?: number | null;
  net_debt_ebitda?: number | null;
  ev_revenue?: number | null;
  pe_ratio?: number | null;
  growth_score?: number | null;
  margin_score?: number | null;
  valuation_score?: number | null;
  leverage_score?: number | null;
  illustrative_screening_score?: number | null;
}

export interface ScreeningResponse {
  total_universe_count: number;
  passed_count: number;
  filters_applied: Record<string, unknown>;
  warnings: string[];
  diagnostics: Record<string, unknown>;
  items: ScreenedCompany[];
  // Legacy aliases
  total_matches?: number;
  results?: ScreenedCompany[];
}

// =========================================================================
// Comparable Companies (Comps)
// =========================================================================

export interface MultipleStats {
  p25?: number | null;
  median?: number | null;
  p75?: number | null;
  n: number;
}

export interface CompsPeerStatistics {
  peer_count: number;
  small_sample_warning: boolean;
  multiples: Record<string, MultipleStats>;
}

export interface ImpliedValuationEntry {
  multiple_used?: number | null;
  implied_ev?: number | null;
  implied_equity_value?: number | null;
}

export interface ValuationRangePoint {
  multiple?: number | null;
  implied_equity_value?: number | null;
}

export interface CompsResponse {
  target_id: string;
  target_sector?: string | null;
  target_industry?: string | null;
  peer_count: number;
  small_sample_warning: boolean;
  peer_group: string[];
  peer_statistics: CompsPeerStatistics;
  implied_valuation: Record<string, ImpliedValuationEntry>;
  valuation_ranges?: Record<string, Record<string, ValuationRangePoint>> | null;
  warnings: string[];
}

// =========================================================================
// Precedent Transactions
// =========================================================================

export interface TransactionRecord {
  transaction_id: string;
  announcement_date?: string | null;
  acquirer: string;
  target: string;
  sector?: string | null;
  industry?: string | null;
  geography?: string | null;
  transaction_type?: string | null;
  stake_acquired_pct?: number | null;
  deal_value_cr?: number | null;
  target_revenue_cr?: number | null;
  target_ebitda_cr?: number | null;
  implied_ev_cr?: number | null;
  ev_revenue?: number | null;
  ev_ebitda?: number | null;
  status?: string | null;
  source_note?: string | null;
}

export interface PrecedentMultipleStats {
  p25?: number | null;
  median?: number | null;
  p75?: number | null;
  n: number;
}

export interface PrecedentsResponse {
  target_id: string;
  target_sector?: string | null;
  target_industry?: string | null;
  target_revenue_cr?: number | null;
  target_ebitda_cr?: number | null;
  target_net_debt_cr?: number | null;
  transaction_count: number;
  small_sample_warning: boolean;
  transactions: TransactionRecord[];
  statistics: Record<string, PrecedentMultipleStats>;
  implied_valuation: Record<string, ImpliedValuationEntry | null>;
  valuation_ranges?: Record<string, Record<string, ValuationRangePoint> | null> | null;
  warnings: string[];
  diagnostics: Record<string, unknown>;
}

// =========================================================================
// Valuation Summary & Football Field
// =========================================================================

export interface ValuationTargetSummary {
  company_id: string;
  sector?: string | null;
  industry?: string | null;
  sector_type?: string | null;
  market_cap_latest?: number | null;
  current_price?: number | null;
  ev?: number | null;
  net_debt_latest?: number | null;
  revenue_latest?: number | null;
  ebitda_latest?: number | null;
  ebitda_margin?: number | null;
  revenue_cagr?: number | null;
}

export interface ValuationCompsSection {
  peer_count: number;
  peer_group: string[];
  small_sample_warning: boolean;
  multiples: Record<string, MultipleStats>;
  valuation: Record<string, Record<string, ValuationRangePoint>>;
}

export interface ValuationPrecedentsSection {
  transaction_count: number;
  small_sample_warning: boolean;
  multiples: Record<string, PrecedentMultipleStats>;
  valuation: Record<string, Record<string, ValuationRangePoint> | null>;
}

export interface ValuationDCFSection {
  implied_ev: number;
  implied_equity_value: number;
  implied_value_per_share?: number | null;
  wacc: number;
  terminal_growth: number;
  assumptions: Record<string, unknown>;
  wacc_detail: Record<string, unknown>;
  pv_explicit_fcff: number;
  pv_terminal_value: number;
  warnings: string[];
}

export interface FootballFieldRow {
  methodology: string;
  low_multiple?: number | null;
  mid_multiple?: number | null;
  high_multiple?: number | null;
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  available: boolean;
}

export interface DataQualitySummary {
  peer_count: number;
  comps_small_sample: boolean;
  comps_ev_ebitda_available: boolean;
  comps_pe_available: boolean;
  precedent_count: number;
  precedents_small_sample: boolean;
  precedent_ev_revenue_count: number;
  precedent_ev_ebitda_count: number;
  precedent_ev_revenue_available: boolean;
  precedent_ev_ebitda_available: boolean;
  shares_outstanding_is_stale: boolean;
  dcf_available: boolean;
  dcf_has_warnings: boolean;
  target_ebitda_available: boolean;
  target_net_debt_available: boolean;
}

export interface ValuationSummaryResponse {
  target: ValuationTargetSummary;
  comps: ValuationCompsSection;
  precedents: ValuationPrecedentsSection;
  dcf?: ValuationDCFSection | null;
  valuation_table: FootballFieldRow[];
  warnings: string[];
  data_quality: DataQualitySummary;
}

export interface DCFResponse {
  target_id: string;
  wacc: number;
  terminal_growth: number;
  forecast_years: number;
  implied_ev: number;
  implied_equity_value: number;
  implied_value_per_share?: number | null;
  pv_explicit_fcff: number;
  pv_terminal_value: number;
  assumptions: Record<string, unknown>;
  warnings: string[];
}

// =========================================================================
// Deal Workspace (Existing Contracts Preserved)
// =========================================================================

export interface DealCreateRequest {
  buyer_id: string;
  target_id: string;
  acquisition_premium?: number;
  cash_pct?: number;
  debt_pct?: number;
  stock_pct?: number;
  transaction_fees?: number;
  expected_annual_synergies?: number;
}

export interface DealCompanyProfile {
  company_id: string;
  company_name?: string | null;
  sector?: string | null;
  industry?: string | null;
  revenue?: number | null;
  ebitda?: number | null;
  net_income?: number | null;
  market_cap?: number | null;
  equity_value?: number | null;
  enterprise_value?: number | null;
  net_debt?: number | null;
  cash?: number | null;
  total_debt?: number | null;
  shares_outstanding?: number | null;
  current_price?: number | null;
  eps?: number | null;
}

export interface DealTransactionTerms {
  target_standalone_equity_value?: number | null;
  acquisition_premium?: number | null;
  purchase_equity_value: number;
  offer_price_per_share?: number | null;
  target_net_debt?: number | null;
  transaction_enterprise_value?: number | null;
  transaction_fees: number;
  total_transaction_value: number;
  implied_ev_ebitda?: number | null;
  implied_ev_revenue?: number | null;
}

export interface DealFinancingStructure {
  funding_amount: number;
  cash_pct: number;
  debt_pct: number;
  stock_pct: number;
  cash_amount: number;
  debt_amount: number;
  stock_amount: number;
  stock_consideration_value: number;
  new_debt_amount: number;
}

export interface DealSynergiesSchedule {
  annual_run_rate: number;
  synergy_type: string;
  year_1: number;
  year_2: number;
  year_3: number;
  ramp: Record<string, number>;
}

export interface DealResponse {
  acquirer: DealCompanyProfile;
  target: DealCompanyProfile;
  transaction: DealTransactionTerms;
  financing: DealFinancingStructure;
  synergies: DealSynergiesSchedule;
  warnings: string[];
}

// =========================================================================
// Sources & Uses Schedule
// =========================================================================

export interface SourcesUsesRequest {
  buyer_id: string;
  target_id: string;
  purchase_equity_value?: number;
  acquisition_premium?: number;
  cash_pct?: number;
  debt_pct?: number;
  stock_pct?: number;
  transaction_fees?: number;
  refinance_target_debt?: boolean;
  use_target_cash?: boolean;
  debt_issuance_fee_pct?: number;
  minimum_cash_balance?: number;
  other_uses?: number;
  other_sources?: number;
  acquirer_cash?: number;
  new_debt?: number;
  stock_issuance?: number;
  target_cash_sweep?: number;
}

export interface SourcesUsesDetail {
  purchase_equity_value: number;
  target_debt_refinancing: number;
  transaction_fees: number;
  debt_issuance_fees: number;
  other_uses: number;
  total_uses: number;
}

export interface FundingBaseDetail {
  gross_uses_ex_debt_fees: number;
  target_cash_sweep: number;
  other_sources: number;
  net_funding_requirement: number;
}

export interface RequestedFinancingSources {
  acquirer_cash: number;
  new_debt: number;
  stock_issuance: number;
  target_cash_sweep: number;
  other_sources: number;
  total_requested_sources: number;
}

export interface ExecutableFinancingSources {
  acquirer_cash: number;
  new_debt: number;
  stock_issuance: number;
  target_cash_sweep: number;
  other_sources: number;
  total_sources: number;
}

export interface SourcesUsesReconciliation {
  total_sources: number;
  total_uses: number;
  difference: number;
  sources_uses_balanced: boolean;
  is_feasible: boolean;
  funding_shortfall: number;
  tolerance: number;
  status: string; // 'BALANCED & EXECUTABLE' | 'INFEASIBLE: CASH SHORTFALL' | 'UNBALANCED'
}

export interface CashReconciliationDetail {
  pre_deal_acquirer_cash?: number | null;
  cash_required: number;
  cash_used_in_transaction: number;
  cash_deficit: number;
  is_cash_funded: boolean;
  target_cash_available?: number | null;
  target_cash_used: number;
  minimum_cash_balance: number;
  pro_forma_acquirer_cash?: number | null;
  pro_forma_target_cash_remaining?: number | null;
  pro_forma_combined_cash?: number | null;
  buffer_shortfall: number;
  warnings: string[];
}

export interface SourcesUsesResponse {
  uses: SourcesUsesDetail;
  funding_base: FundingBaseDetail;
  requested_financing: RequestedFinancingSources;
  sources: ExecutableFinancingSources;
  reconciliation: SourcesUsesReconciliation;
  cash_reconciliation: CashReconciliationDetail;
  warnings: string[];
}

// =========================================================================
// Accretion / Dilution Model
// =========================================================================

export interface AccretionDilutionRequest {
  buyer_id: string;
  target_id: string;
  purchase_equity_value?: number;
  acquisition_premium?: number;
  cash_pct?: number;
  debt_pct?: number;
  stock_pct?: number;
  transaction_fees?: number;
  refinance_target_debt?: boolean;
  use_target_cash?: boolean;
  debt_issuance_fee_pct?: number;
  minimum_cash_balance?: number;
  other_sources?: number;
  expected_annual_synergies?: number;
  synergy_ramp_year_1?: number;
  synergy_ramp_year_2?: number;
  synergy_ramp_year_3?: number;
  synergy_year_1?: number;
  synergy_year_2?: number;
  synergy_year_3?: number;
  debt_interest_rate?: number;
  foregone_cash_interest_rate?: number;
  tax_rate?: number;
}

export interface BuyerADProfile {
  net_income?: number | null;
  diluted_shares?: number | null;
  share_price?: number | null;
  cash?: number | null;
}

export interface TargetADProfile {
  net_income?: number | null;
  diluted_shares?: number | null;
  share_price?: number | null;
}

export interface ADFinancingDetail {
  new_debt: number;
  debt_interest_rate: number;
  debt_interest: number;
  after_tax_debt_interest: number;
  buyer_cash_used: number;
  foregone_cash_interest_rate: number;
  foregone_interest: number;
  after_tax_foregone_interest: number;
  stock_consideration_value: number;
  tax_rate: number;
  is_feasible: boolean;
}

export interface ADSynergiesDetail {
  gross_year_1: number;
  after_tax_year_1: number;
  gross_year_2: number;
  after_tax_year_2: number;
  gross_year_3: number;
  after_tax_year_3: number;
}

export interface ADStandaloneEPS {
  buyer_eps?: number | null;
  target_eps?: number | null;
}

export interface ADYearProjection {
  year: number;
  buyer_net_income?: number | null;
  target_net_income?: number | null;
  gross_synergy: number;
  after_tax_synergy: number;
  new_debt: number;
  debt_interest: number;
  after_tax_debt_interest: number;
  buyer_cash_used: number;
  foregone_interest: number;
  after_tax_foregone_interest: number;
  pro_forma_net_income?: number | null;
  buyer_eps?: number | null;
  pro_forma_shares?: number | null;
  pro_forma_eps?: number | null;
  eps_change?: number | null;
  accretion_dilution_pct?: number | null;
  status: string;
  modelled_status?: string | null;
  is_feasible: boolean;
}

export interface BreakEvenSynergyDetail {
  required_pro_forma_net_income?: number | null;
  break_even_after_tax_synergy?: number | null;
  break_even_gross_synergy?: number | null;
  synergies_required?: boolean | null;
}

export interface ADProFormaProjections {
  new_shares_issued?: number | null;
  pro_forma_shares?: number | null;
  years: Record<string, ADYearProjection>;
}

export interface AccretionDilutionResponse {
  buyer: BuyerADProfile;
  target: TargetADProfile;
  financing: ADFinancingDetail;
  synergies: ADSynergiesDetail;
  standalone: ADStandaloneEPS;
  pro_forma: ADProFormaProjections;
  break_even: Record<string, BreakEvenSynergyDetail>;
  diagnostics: string[];
  is_available: boolean;
  is_feasible: boolean;
}

// ---------------------------------------------------------------------------
// Phase 9 Scenario & Sensitivity Types
// ---------------------------------------------------------------------------

export interface ScenarioAssumptions {
  acquisition_premium?: number;
  cash_pct?: number;
  debt_pct?: number;
  stock_pct?: number;
  transaction_fees?: number;
  debt_issuance_fee_pct?: number;
  minimum_cash_balance?: number;
  refinance_target_debt?: boolean;
  use_target_cash?: boolean;
  debt_interest_rate?: number;
  foregone_cash_interest_rate?: number;
  tax_rate?: number;
  synergy_year_1?: number | null;
  synergy_year_2?: number | null;
  synergy_year_3?: number | null;
  expected_annual_synergies?: number;
}

export interface ScenarioDefinitionSchema {
  name: string;
  scenario_type: 'BASE' | 'UPSIDE' | 'DOWNSIDE' | 'CUSTOM' | string;
  description?: string;
  overrides?: ScenarioAssumptions;
}

export interface SingleScenarioRequest {
  buyer_id: string;
  target_id: string;
  base_assumptions?: ScenarioAssumptions;
  scenario?: ScenarioDefinitionSchema;
}

export interface ScenarioRequest {
  buyer_id: string;
  target_id: string;
  base_assumptions?: ScenarioAssumptions;
  scenarios: ScenarioDefinitionSchema[];
}

export interface ScenarioIdentity {
  name: string;
  scenario_type: string;
  description: string;
}

export interface ScenarioDealResult {
  purchase_equity_value: number | null;
  offer_price_per_share?: number | null;
  transaction_enterprise_value: number | null;
  cash_amount?: number | null;
  debt_amount?: number | null;
  stock_amount?: number | null;
  cash_pct?: number | null;
  debt_pct?: number | null;
  stock_pct?: number | null;
}

export interface ScenarioSourcesUsesResult {
  total_uses: number | null;
  total_sources: number | null;
  buyer_cash: number | null;
  new_debt: number | null;
  stock_issuance: number | null;
  target_cash?: number | null;
  balance: number | null;
  is_feasible: boolean | null;
  pro_forma_cash?: number | null;
}

export interface ScenarioYearResult {
  eps: number | null;
  accretion_dilution_pct: number | null;
  status: string | null;
  break_even_gross_synergy: number | null;
}

export interface ScenarioADResult {
  standalone_eps: number | null;
  year_1: ScenarioYearResult | null;
  year_2?: ScenarioYearResult | null;
  year_3?: ScenarioYearResult | null;
}

export interface ScenarioDiagnostics {
  warnings: string[];
  is_feasible: boolean;
  is_available: boolean;
  validation_errors?: string[] | null;
}

export interface ScenarioResult {
  identity: ScenarioIdentity;
  assumptions: {
    effective: Record<string, unknown>;
    overrides: Record<string, unknown>;
  };
  deal: ScenarioDealResult | null;
  sources_uses: ScenarioSourcesUsesResult | null;
  accretion_dilution: ScenarioADResult | null;
  diagnostics: ScenarioDiagnostics;
}

export interface ScenarioComparisonResponse {
  acquirer_id: string;
  target_id: string;
  scenario_count: number;
  scenarios: ScenarioResult[];
}

// ---------------------------------------------------------------------------
// Sensitivity Analysis Types
// ---------------------------------------------------------------------------

export interface SensitivityAxis {
  variable: string;
  values: number[];
}

export interface Sensitivity1DRequest {
  buyer_id: string;
  target_id: string;
  base_assumptions?: ScenarioAssumptions;
  axis: SensitivityAxis;
  output_metric: string;
}

export interface Sensitivity2DRequest {
  buyer_id: string;
  target_id: string;
  base_assumptions?: ScenarioAssumptions;
  x_axis: SensitivityAxis;
  y_axis: SensitivityAxis;
  output_metric: string;
}

export interface SensitivityCell {
  value?: number | null;
  x_value?: number | null;
  y_value?: number | null;
  output: number | boolean | null;
  is_feasible: boolean;
  diagnostics?: string[];
}

export interface Sensitivity1DResponse {
  acquirer_id: string;
  target_id: string;
  variable: string;
  values: number[];
  output_metric: string;
  cells: SensitivityCell[];
}

export interface SensitivityDimensions {
  rows: number;
  columns: number;
  total_cells: number;
}

export interface Sensitivity2DResponse {
  acquirer_id: string;
  target_id: string;
  x_variable: string;
  x_values: number[];
  y_variable: string;
  y_values: number[];
  output_metric: string;
  matrix: SensitivityCell[][];
  dimensions: SensitivityDimensions;
}

