import { requireUser } from "@/lib/auth";
import {
  generateLoanSchedule,
  remainingTenureMonths,
  scheduleTotals,
} from "@/features/loans/loan-math";
import type { Account, Loan, LoanSimulation } from "@/types";
import type { AmortizationRow } from "@/lib/calculations/loan";

export type LoanComputed = Loan & {
  remaining_months: number;
  total_interest: number;
  total_payable: number;
  progress_percent: number;
};

export type LoansSummary = {
  totalOutstanding: number;
  totalEmi: number;
  count: number;
};

export type LoansPageData = {
  loans: LoanComputed[];
  summary: LoansSummary;
  accounts: Pick<Account, "id" | "name" | "bank_name">[];
};

export type LoanDetailData = {
  loan: LoanComputed;
  schedule: AmortizationRow[];
  scheduleTotals: ReturnType<typeof scheduleTotals>;
  principalVsInterest: { name: string; value: number; color: string }[];
  outstandingTrend: { label: string; value: number }[];
  simulations: LoanSimulation[];
  accounts: Pick<Account, "id" | "name" | "bank_name">[];
};

function mapLoan(row: Record<string, unknown>): LoanComputed {
  const loan = {
    ...(row as unknown as Loan),
    principal: Number(row.principal),
    interest_rate: Number(row.interest_rate),
    tenure_months: Number(row.tenure_months),
    emi: Number(row.emi),
    processing_fee: Number(row.processing_fee),
    insurance_fee: Number(row.insurance_fee),
    prepayment_charges: Number(row.prepayment_charges),
    outstanding_principal: Number(row.outstanding_principal),
    principal_paid: Number(row.principal_paid),
    interest_paid: Number(row.interest_paid),
    emis_paid: Number(row.emis_paid),
  };

  const remaining_months = remainingTenureMonths(loan);
  const schedule = generateLoanSchedule({
    principal: loan.outstanding_principal,
    annualRate: loan.interest_rate,
    tenureMonths: remaining_months || loan.tenure_months,
    emi: loan.emi,
    startDate: new Date(loan.start_date),
    interestType: loan.interest_type,
  });
  const totals = scheduleTotals(schedule);
  const progress_percent =
    loan.tenure_months > 0
      ? Math.round((loan.emis_paid / loan.tenure_months) * 1000) / 10
      : 0;

  return {
    ...loan,
    remaining_months,
    total_interest: totals.totalInterest + loan.interest_paid,
    total_payable: totals.totalPayable + loan.principal_paid + loan.interest_paid,
    progress_percent,
  };
}

function mapSimulation(row: Record<string, unknown>): LoanSimulation {
  return {
    ...(row as unknown as LoanSimulation),
    one_time_amount: Number(row.one_time_amount ?? 0),
    recurring_extra_emi: Number(row.recurring_extra_emi ?? 0),
    increased_emi:
      row.increased_emi == null ? null : Number(row.increased_emi),
    annual_lump_sum: Number(row.annual_lump_sum ?? 0),
    original_emi: Number(row.original_emi),
    new_emi: Number(row.new_emi),
    original_tenure: Number(row.original_tenure),
    new_tenure: Number(row.new_tenure),
    interest_saved: Number(row.interest_saved),
    months_saved: Number(row.months_saved),
    total_savings: Number(row.total_savings),
  };
}

async function getAccountOptions() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, bank_name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Account, "id" | "name" | "bank_name">[];
}

export async function getLoans(opts?: {
  includeInactive?: boolean;
}): Promise<LoanComputed[]> {
  const { supabase, user } = await requireUser();

  let query = supabase
    .from("loans")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapLoan(row as Record<string, unknown>));
}

export async function getLoansPageData(): Promise<LoansPageData> {
  const [loans, accounts] = await Promise.all([
    getLoans(),
    getAccountOptions(),
  ]);

  return {
    loans,
    accounts,
    summary: {
      totalOutstanding: loans.reduce(
        (s, l) => s + l.outstanding_principal,
        0
      ),
      totalEmi: loans.reduce((s, l) => s + l.emi, 0),
      count: loans.length,
    },
  };
}

export async function getLoanById(id: string): Promise<LoanDetailData | null> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("loans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const loan = mapLoan(data as Record<string, unknown>);
  const remaining = loan.remaining_months || loan.tenure_months;

  const schedule = generateLoanSchedule({
    principal: loan.outstanding_principal,
    annualRate: loan.interest_rate,
    tenureMonths: remaining,
    emi: loan.emi,
    startDate: new Date(),
    interestType: loan.interest_type,
  });

  const totals = scheduleTotals(schedule);

  const { data: sims, error: simError } = await supabase
    .from("loan_simulations")
    .select("*")
    .eq("loan_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (simError) throw new Error(simError.message);

  const accounts = await getAccountOptions();

  const step = Math.max(1, Math.floor(schedule.length / 24));
  const outstandingTrend = schedule
    .filter((_, i) => i % step === 0 || i === schedule.length - 1)
    .map((row) => ({
      label: `EMI ${row.emiNumber}`,
      value: row.closingBalance,
    }));

  return {
    loan,
    schedule,
    scheduleTotals: totals,
    principalVsInterest: [
      {
        name: "Principal",
        value: totals.totalPrincipal,
        color: "#0F766E",
      },
      {
        name: "Interest",
        value: totals.totalInterest,
        color: "#E11D48",
      },
    ],
    outstandingTrend,
    simulations: (sims ?? []).map((s) =>
      mapSimulation(s as Record<string, unknown>)
    ),
    accounts,
  };
}
