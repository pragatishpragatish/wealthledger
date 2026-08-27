export type AccountType =
  | "savings"
  | "salary"
  | "current"
  | "cash_wallet"
  | "upi_wallet"
  | "broker_wallet";

export type TransactionType = "income" | "expense" | "transfer" | "adjustment";

export type PaymentMethod =
  | "upi"
  | "card"
  | "netbanking"
  | "cash"
  | "cheque"
  | "auto_debit"
  | "other";

export type CategoryKind = "income" | "expense";

export type CreditCardRewardType = "cashback" | "points" | "miles" | "none";

export type InvestmentType =
  | "stocks"
  | "mutual_funds"
  | "etf"
  | "fd"
  | "rd"
  | "ppf"
  | "epf"
  | "nps"
  | "gold"
  | "silver"
  | "crypto"
  | "bonds"
  | "real_estate";

export type LoanType =
  | "home"
  | "car"
  | "education"
  | "personal"
  | "gold"
  | "business"
  | "credit_line";

export type InterestType = "reducing" | "flat";
export type LoanInputMode = "tenure" | "emi";
export type PrepaymentStrategy = "reduce_emi" | "reduce_tenure";
export type BudgetPeriod = "monthly" | "yearly";

export type GoalType =
  | "emergency_fund"
  | "vacation"
  | "car"
  | "house"
  | "wedding"
  | "education"
  | "retirement"
  | "custom";

export type NotificationType =
  | "emi_due"
  | "credit_card_due"
  | "budget_limit"
  | "large_expense"
  | "investment_maturity"
  | "investment_update"
  | "goal_milestone"
  | "bill_due"
  | "sip_due"
  | "fd_maturity"
  | "general";

export type RecurringFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  currency: string;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  kind: CategoryKind;
  icon: string | null;
  color: string | null;
  parent_id: string | null;
  is_system: boolean;
  sort_order: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  bank_name: string;
  account_number: string | null;
  ifsc: string | null;
  account_type: AccountType;
  opening_balance: number;
  current_balance: number;
  opening_date: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  date: string;
  amount: number;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  merchant: string | null;
  notes: string | null;
  payment_method: PaymentMethod | null;
  receipt_url: string | null;
  is_recurring: boolean;
  recurring_frequency: RecurringFrequency | null;
  credit_card_id: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  account?: Account | null;
  to_account?: Account | null;
  tags?: Tag[];
}

export interface CreditCard {
  id: string;
  user_id: string;
  bank: string;
  card_name: string;
  last_four: string | null;
  credit_limit: number;
  outstanding: number;
  statement_amount: number;
  minimum_due: number;
  paid_amount: number;
  billing_date: number;
  due_date: number;
  interest_rate: number;
  reward_type: CreditCardRewardType;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditCardTransaction {
  id: string;
  user_id: string;
  credit_card_id: string;
  transaction_id: string | null;
  date: string;
  amount: number;
  description: string | null;
  merchant: string | null;
  category_id: string | null;
  is_payment: boolean;
  converted_to_emi: boolean;
  created_at: string;
  category?: Category | null;
}

export interface CreditCardEmi {
  id: string;
  user_id: string;
  credit_card_id: string;
  source_transaction_id: string | null;
  description: string;
  principal: number;
  interest_rate: number;
  tenure_months: number;
  emi_amount: number;
  start_date: string;
  emis_paid: number;
  outstanding_principal: number;
  processing_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  name: string;
  bank: string;
  loan_type: LoanType;
  principal: number;
  interest_rate: number;
  interest_type: InterestType;
  input_mode: LoanInputMode;
  tenure_months: number;
  emi: number;
  start_date: string;
  processing_fee: number;
  insurance_fee: number;
  prepayment_charges: number;
  outstanding_principal: number;
  principal_paid: number;
  interest_paid: number;
  emis_paid: number;
  account_id: string | null;
  document_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanSimulation {
  id: string;
  user_id: string;
  loan_id: string;
  name: string;
  strategy: PrepaymentStrategy;
  one_time_amount: number;
  one_time_date: string | null;
  recurring_extra_emi: number;
  increased_emi: number | null;
  annual_lump_sum: number;
  original_emi: number;
  new_emi: number;
  original_tenure: number;
  new_tenure: number;
  interest_saved: number;
  months_saved: number;
  total_savings: number;
  schedule_json: AmortizationScheduleJson | null;
  is_applied: boolean;
  created_at: string;
  updated_at: string;
}

export type AmortizationScheduleJson = {
  emiNumber: number;
  date: string;
  openingBalance: number;
  principal: number;
  interest: number;
  closingBalance: number;
  emi: number;
}[];

export interface Investment {
  id: string;
  user_id: string;
  name: string;
  type: InvestmentType;
  platform: string | null;
  purchase_date: string | null;
  units: number;
  buy_price: number;
  current_price: number;
  invested_amount: number;
  current_value: number;
  maturity_date: string | null;
  interest_rate: number | null;
  document_url: string | null;
  notes: string | null;
  /** @deprecated Kept for DB compatibility; use dated contributions instead. */
  is_sip?: boolean;
  sip_amount?: number;
  sip_day?: number | null;
  sip_frequency?: "monthly" | "weekly" | "quarterly" | null;
  sip_start_date?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BudgetHistorySource = "create" | "edit" | "recurring_seed";

export interface BudgetTemplate {
  id: string;
  user_id: string;
  category_id: string;
  period: BudgetPeriod;
  amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetAmountHistory {
  id: string;
  user_id: string;
  budget_id: string | null;
  category_id: string | null;
  period: BudgetPeriod;
  year: number;
  month: number | null;
  old_amount: number | null;
  new_amount: number;
  source: BudgetHistorySource;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  period: BudgetPeriod;
  year: number;
  month: number | null;
  amount: number;
  spent: number;
  template_id: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  type: GoalType;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  target_date: string | null;
  account_id: string | null;
  icon: string | null;
  color: string | null;
  notes: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NetWorthSnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  total_cash: number;
  total_investments: number;
  total_assets: number;
  total_liabilities: number;
  credit_card_outstanding: number;
  loan_outstanding: number;
  net_worth: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  due_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Settings {
  id: string;
  user_id: string;
  theme: "light" | "dark" | "system";
  notify_emi: boolean;
  notify_credit_card: boolean;
  notify_budget: boolean;
  notify_large_expense: boolean;
  notify_investment_maturity: boolean;
  notify_investment_update: boolean;
  notify_goal_milestones: boolean;
  large_expense_threshold: number;
  fiscal_year_start_month: number;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  user_id: string;
  name: string;
  report_type: string;
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  file_url: string | null;
  created_at: string;
}

export interface DashboardSummary {
  netWorth: number;
  totalCash: number;
  investments: number;
  totalAssets: number;
  totalLiabilities: number;
  creditCardOutstanding: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlySavings: number;
  savingsRate: number;
}

export interface UpcomingItem {
  id: string;
  type: "credit_card" | "emi" | "bill" | "sip" | "fd_maturity";
  title: string;
  amount: number;
  dueDate: string;
  subtitle?: string;
  href: string;
}

export interface ChartPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface AllocationPoint {
  name: string;
  value: number;
  color?: string;
}
