import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { requireUser } from "@/lib/auth";
import {
  getIndianFYRange,
  getIndianFYStartYear,
  toDateString,
} from "@/utils/date";
import type {
  FinancialReport,
  ReportPeriodType,
  ReportSection,
} from "@/features/reports/types";

function buildSection(
  title: string,
  rows: { label: string; amount: number; meta?: string }[]
): ReportSection {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  return {
    title,
    rows: sorted,
    total: sorted.reduce((s, r) => s + r.amount, 0),
  };
}

export function resolveReportPeriod(opts: {
  periodType: ReportPeriodType;
  year: number;
  month: number | null;
}): { start: string; end: string; label: string } {
  const { periodType, year, month } = opts;

  if (periodType === "financial_year") {
    const fy = getIndianFYRange(year);
    return {
      start: toDateString(fy.start),
      end: toDateString(fy.end),
      label: `${fy.label} (1 Apr ${year} – 31 Mar ${year + 1})`,
    };
  }

  if (periodType === "yearly") {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 0, 1));
    return {
      start: toDateString(start),
      end: toDateString(end),
      label: `Calendar year ${year}`,
    };
  }

  const m = month ?? new Date().getMonth() + 1;
  const start = startOfMonth(new Date(year, m - 1, 1));
  const end = endOfMonth(new Date(year, m - 1, 1));
  return {
    start: toDateString(start),
    end: toDateString(end),
    label: format(start, "MMMM yyyy"),
  };
}

function budgetMatchesPeriod(
  b: {
    period: string;
    year: number;
    month: number | null;
  },
  periodType: ReportPeriodType,
  year: number,
  month: number | null
): boolean {
  if (periodType === "financial_year") {
    if (b.period === "yearly" || b.month == null) {
      return b.year === year || b.year === year + 1;
    }
    if (b.period === "monthly" && b.month != null) {
      if (b.year === year && b.month >= 4) return true;
      if (b.year === year + 1 && b.month <= 3) return true;
    }
    return false;
  }

  if (periodType === "yearly") {
    return b.year === year && (b.period === "yearly" || b.month == null);
  }

  return (
    b.year === year &&
    ((b.period === "monthly" && b.month === month) ||
      (b.period === "yearly" && b.month == null))
  );
}

export async function generateReport(opts: {
  periodType?: ReportPeriodType;
  year?: number;
  month?: number | null;
}): Promise<FinancialReport> {
  const now = new Date();
  const periodType = opts.periodType ?? "monthly";
  const year =
    opts.year ??
    (periodType === "financial_year"
      ? getIndianFYStartYear(now)
      : now.getFullYear());
  const month =
    periodType === "monthly" ? (opts.month ?? now.getMonth() + 1) : null;

  const { start, end, label } = resolveReportPeriod({
    periodType,
    year,
    month,
  });

  const { supabase, user } = await requireUser();

  const budgetYears =
    periodType === "financial_year" ? [year, year + 1] : [year];

  const [
    txRes,
    accountsRes,
    investmentsRes,
    loansRes,
    cardsRes,
    budgetsRes,
    categoriesRes,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, type, amount, date, category_id, merchant, notes")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("accounts")
      .select("id, name, bank_name, current_balance, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("investments")
      .select(
        "id, name, type, current_value, invested_amount, is_active"
      )
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("loans")
      .select(
        "id, name, bank, loan_type, emi, outstanding_principal, is_active"
      )
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("credit_cards")
      .select("id, outstanding, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("budgets")
      .select("id, category_id, period, year, month, amount, spent")
      .eq("user_id", user.id)
      .in("year", budgetYears),
    supabase
      .from("categories")
      .select("id, name, kind")
      .eq("user_id", user.id),
  ]);

  const transactions = txRes.data ?? [];
  const accounts = accountsRes.data ?? [];
  const investments = investmentsRes.data ?? [];
  const loans = loansRes.data ?? [];
  const cards = cardsRes.data ?? [];
  const budgets = budgetsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const incomeByCat = new Map<string, number>();
  const expenseByCat = new Map<string, number>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    if (tx.type === "income") {
      totalIncome += amount;
      const name = tx.category_id
        ? (catMap.get(tx.category_id)?.name ?? "Uncategorized")
        : "Uncategorized";
      incomeByCat.set(name, (incomeByCat.get(name) ?? 0) + amount);
    } else if (tx.type === "expense") {
      totalExpense += amount;
      const name = tx.category_id
        ? (catMap.get(tx.category_id)?.name ?? "Uncategorized")
        : (tx.merchant ?? "Uncategorized");
      expenseByCat.set(name, (expenseByCat.get(name) ?? 0) + amount);
    }
  }

  const net = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;

  const income = buildSection(
    "Income",
    Array.from(incomeByCat.entries()).map(([label, amount]) => ({
      label,
      amount,
    }))
  );

  const expense = buildSection(
    "Expense",
    Array.from(expenseByCat.entries()).map(([label, amount]) => ({
      label,
      amount,
    }))
  );

  const investment = buildSection(
    "Investments",
    investments.map((inv) => ({
      label: inv.name,
      amount: Number(inv.current_value),
      meta: `${inv.type.replaceAll("_", " ")} · invested ${Number(inv.invested_amount).toLocaleString("en-IN")}`,
    }))
  );

  const loan = buildSection(
    "Loans",
    loans.map((l) => ({
      label: l.name,
      amount: Number(l.outstanding_principal),
      meta: `${l.bank} · EMI ${Number(l.emi).toLocaleString("en-IN")}`,
    }))
  );

  const periodBudgets = budgets.filter((b) =>
    budgetMatchesPeriod(b, periodType, year, month)
  );

  const budget = buildSection(
    "Budgets",
    periodBudgets.map((b) => {
      const catName = b.category_id
        ? (catMap.get(b.category_id)?.name ?? "Overall")
        : "Overall";
      const spent = Number(b.spent);
      const amount = Number(b.amount);
      return {
        label: catName,
        amount: spent,
        meta: `Budget ${amount.toLocaleString("en-IN")} · ${amount > 0 ? ((spent / amount) * 100).toFixed(0) : 0}% used`,
      };
    })
  );

  const totalCash = accounts.reduce(
    (s, a) => s + Number(a.current_balance),
    0
  );
  const totalInvestments = investments.reduce(
    (s, i) => s + Number(i.current_value),
    0
  );
  const creditCardOutstanding = cards.reduce(
    (s, c) => s + Number(c.outstanding),
    0
  );
  const loanOutstanding = loans.reduce(
    (s, l) => s + Number(l.outstanding_principal),
    0
  );
  const totalAssets = totalCash + totalInvestments;
  const totalLiabilities = creditCardOutstanding + loanOutstanding;

  return {
    periodType,
    year,
    month,
    periodStart: start,
    periodEnd: end,
    label,
    cashFlow: {
      income: totalIncome,
      expense: totalExpense,
      net,
      savingsRate,
    },
    income,
    expense,
    investment,
    loan,
    budget,
    netWorth: {
      totalCash,
      totalInvestments,
      totalAssets,
      totalLiabilities,
      creditCardOutstanding,
      loanOutstanding,
      netWorth: totalAssets - totalLiabilities,
    },
  };
}
