export type ReportPeriodType = "monthly" | "yearly" | "financial_year";

export interface ReportRow {
  label: string;
  amount: number;
  meta?: string;
}

export interface ReportSection {
  title: string;
  rows: ReportRow[];
  total: number;
}

export interface NetWorthSummary {
  totalCash: number;
  totalInvestments: number;
  totalAssets: number;
  totalLiabilities: number;
  creditCardOutstanding: number;
  loanOutstanding: number;
  netWorth: number;
}

export interface CashFlowSummary {
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
}

export interface FinancialReport {
  periodType: ReportPeriodType;
  /** Calendar year, or FY start year when periodType is financial_year */
  year: number;
  month: number | null;
  periodStart: string;
  periodEnd: string;
  label: string;
  cashFlow: CashFlowSummary;
  income: ReportSection;
  expense: ReportSection;
  investment: ReportSection;
  loan: ReportSection;
  budget: ReportSection;
  netWorth: NetWorthSummary;
}
