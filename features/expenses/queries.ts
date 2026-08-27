import { endOfMonth, endOfYear, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { requireUser } from "@/lib/auth";
import {
  formatMonthKeyLabel,
  getCurrentMonthRange,
  getMonthKey,
  parseMonthKey,
  shiftMonthKey,
  toDateString,
} from "@/utils/date";
import type {
  Account,
  AllocationPoint,
  Category,
  CreditCard,
  Tag,
  Transaction,
} from "@/types";

const CHART_COLORS = [
  "#0F766E",
  "#2563EB",
  "#CA8A04",
  "#DB2777",
  "#7C3AED",
  "#EA580C",
  "#0891B2",
  "#16A34A",
];

export type ExpenseRow = Omit<Transaction, "tags"> & {
  category: Pick<Category, "id" | "name" | "color" | "icon"> | null;
  account: Pick<Account, "id" | "name" | "bank_name"> | null;
  credit_card: Pick<
    CreditCard,
    "id" | "bank" | "card_name" | "last_four"
  > | null;
  tags: Pick<Tag, "id" | "name" | "color">[];
};

export type MerchantSpend = {
  merchant: string;
  total: number;
  count: number;
};

export type BudgetComparison = {
  id: string;
  categoryName: string;
  budgetAmount: number;
  spent: number;
  percent: number;
};

/** Chart/analytics window — defaults to the current calendar month. */
export type ExpenseChartRange =
  | { kind: "month"; year: number; month: number; key: string }
  | { kind: "ytd"; year: number; key: "ytd" };

export type ExpenseChartRangeOption = {
  value: string;
  label: string;
};

export type ExpenseAnalytics = {
  dailyTotal: number;
  weeklyTotal: number;
  monthlyTotal: number;
  yearlyTotal: number;
  count: number;
  categoryBreakdown: AllocationPoint[];
  topMerchants: MerchantSpend[];
  budgetComparisons: BudgetComparison[];
  chartRange: ExpenseChartRange;
  chartLabel: string;
  chartRangeOptions: ExpenseChartRangeOption[];
};

export type ExpensesPageData = {
  expenses: ExpenseRow[];
  analytics: ExpenseAnalytics;
  accounts: Pick<Account, "id" | "name" | "bank_name" | "current_balance">[];
  creditCards: Pick<
    CreditCard,
    "id" | "bank" | "card_name" | "last_four" | "outstanding" | "credit_limit"
  >[];
  categories: Pick<Category, "id" | "name" | "color" | "icon">[];
};

type TagJoin = {
  tags: Pick<Tag, "id" | "name" | "color"> | null;
};

export function parseExpenseChartRange(
  param?: string | null
): ExpenseChartRange {
  const now = new Date();
  const year = now.getFullYear();

  if (param === "ytd") {
    return { kind: "ytd", year, key: "ytd" };
  }

  if (param && parseMonthKey(param)) {
    const [y, m] = param.split("-").map(Number);
    return { kind: "month", year: y, month: m, key: param };
  }

  const key = getMonthKey(now);
  return {
    kind: "month",
    year,
    month: now.getMonth() + 1,
    key,
  };
}

function chartDateBounds(range: ExpenseChartRange): {
  start: string;
  end: string;
} {
  const now = new Date();
  if (range.kind === "ytd") {
    return {
      start: toDateString(startOfYear(new Date(range.year, 0, 1))),
      end: toDateString(
        range.year === now.getFullYear()
          ? now
          : endOfYear(new Date(range.year, 0, 1))
      ),
    };
  }
  const d = new Date(range.year, range.month - 1, 1);
  return {
    start: toDateString(startOfMonth(d)),
    end: toDateString(endOfMonth(d)),
  };
}

function chartRangeLabel(range: ExpenseChartRange): string {
  if (range.kind === "ytd") return `YTD ${range.year}`;
  return formatMonthKeyLabel(range.key);
}

function buildChartRangeOptions(now = new Date()): ExpenseChartRangeOption[] {
  const options: ExpenseChartRangeOption[] = [
    { value: "ytd", label: `YTD ${now.getFullYear()}` },
  ];
  let key = getMonthKey(now);
  for (let i = 0; i < 12; i++) {
    options.push({
      value: key,
      label: formatMonthKeyLabel(key),
    });
    key = shiftMonthKey(key, -1);
  }
  return options;
}

function mapExpenseRow(row: Record<string, unknown>): ExpenseRow {
  const category = row.category as ExpenseRow["category"];
  const account = row.account as ExpenseRow["account"];
  const creditCard = row.credit_card as ExpenseRow["credit_card"];
  const tagJoins = (row.transaction_tags as TagJoin[] | null) ?? [];
  const tags = tagJoins
    .map((j) => j.tags)
    .filter((t): t is Pick<Tag, "id" | "name" | "color"> => Boolean(t));

  return {
    ...(row as unknown as Transaction),
    amount: Number(row.amount),
    category: category ?? null,
    account: account ?? null,
    credit_card: creditCard ?? null,
    tags,
  };
}

export async function getExpenses(limit = 100): Promise<ExpenseRow[]> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("transactions")
    .select(
      `
      *,
      category:categories(id, name, color, icon),
      account:accounts!account_id(id, name, bank_name),
      credit_card:credit_cards!credit_card_id(id, bank, card_name, last_four),
      transaction_tags(tags(id, name, color))
    `
    )
    .eq("user_id", user.id)
    .eq("type", "expense")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapExpenseRow(row as Record<string, unknown>)
  );
}

export async function getExpenseAnalytics(opts?: {
  chartRangeParam?: string | null;
}): Promise<ExpenseAnalytics> {
  const { supabase, user } = await requireUser();
  const now = new Date();
  const chartRange = parseExpenseChartRange(opts?.chartRangeParam);
  const chartBounds = chartDateBounds(chartRange);

  const today = toDateString(now);
  const weekStart = toDateString(startOfWeek(now, { weekStartsOn: 1 }));
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();
  const yearStart = toDateString(startOfYear(now));
  const yearEnd = toDateString(endOfYear(now));

  const fetchStart =
    chartBounds.start < yearStart ? chartBounds.start : yearStart;
  const fetchEnd = chartBounds.end > yearEnd ? chartBounds.end : yearEnd;

  const budgetYear =
    chartRange.kind === "month" ? chartRange.year : now.getFullYear();
  const budgetMonth =
    chartRange.kind === "month" ? chartRange.month : now.getMonth() + 1;

  const [txRes, catsRes, budgetsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, date, category_id, merchant")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("date", fetchStart)
      .lte("date", fetchEnd),
    supabase
      .from("categories")
      .select("id, name, color")
      .eq("user_id", user.id)
      .eq("kind", "expense"),
    supabase
      .from("budgets")
      .select(
        `
        id, amount, spent, category_id, period, year, month,
        category:categories(id, name)
      `
      )
      .eq("user_id", user.id)
      .eq("period", "monthly")
      .eq("year", budgetYear)
      .eq("month", budgetMonth),
  ]);

  if (txRes.error) throw new Error(txRes.error.message);
  if (catsRes.error) throw new Error(catsRes.error.message);

  const rows = txRes.data ?? [];
  const categories = catsRes.data ?? [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  let dailyTotal = 0;
  let weeklyTotal = 0;
  let monthlyTotal = 0;
  let yearlyTotal = 0;
  let monthCount = 0;

  const byCat = new Map<string, number>();
  const byMerchant = new Map<string, { total: number; count: number }>();
  const chartSpendByCat = new Map<string, number>();

  for (const tx of rows) {
    const amount = Number(tx.amount);

    if (tx.date >= yearStart && tx.date <= yearEnd) yearlyTotal += amount;
    if (tx.date === today) dailyTotal += amount;
    if (tx.date >= weekStart && tx.date <= today) weeklyTotal += amount;
    if (tx.date >= monthStart && tx.date <= monthEnd) {
      monthlyTotal += amount;
      monthCount += 1;
    }

    const inChart =
      tx.date >= chartBounds.start && tx.date <= chartBounds.end;
    if (!inChart) continue;

    const cat = tx.category_id ? catMap.get(tx.category_id) : null;
    const catName = cat?.name ?? "Uncategorized";
    byCat.set(catName, (byCat.get(catName) ?? 0) + amount);

    if (tx.category_id) {
      chartSpendByCat.set(
        tx.category_id,
        (chartSpendByCat.get(tx.category_id) ?? 0) + amount
      );
    }

    const merchant = (tx.merchant ?? "").trim() || "Unknown";
    const prev = byMerchant.get(merchant) ?? { total: 0, count: 0 };
    byMerchant.set(merchant, {
      total: prev.total + amount,
      count: prev.count + 1,
    });
  }

  const categoryBreakdown: AllocationPoint[] = Array.from(byCat.entries())
    .map(([name, value], i) => ({
      name,
      value,
      color:
        categories.find((c) => c.name === name)?.color ??
        CHART_COLORS[i % CHART_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const topMerchants: MerchantSpend[] = Array.from(byMerchant.entries())
    .map(([merchant, v]) => ({
      merchant,
      total: v.total,
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const budgetRows = budgetsRes.data ?? [];
  const budgetComparisons: BudgetComparison[] =
    chartRange.kind === "month"
      ? budgetRows.map((b) => {
          const raw = b.category as
            | { id: string; name: string }
            | { id: string; name: string }[]
            | null;
          const cat = Array.isArray(raw) ? (raw[0] ?? null) : raw;
          const budgetAmount = Number(b.amount);
          const spent =
            (b.category_id
              ? chartSpendByCat.get(b.category_id)
              : undefined) ?? Number(b.spent);
          return {
            id: b.id,
            categoryName: cat?.name ?? "Overall",
            budgetAmount,
            spent,
            percent: budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0,
          };
        })
      : [];

  return {
    dailyTotal,
    weeklyTotal,
    monthlyTotal,
    yearlyTotal,
    count: monthCount,
    categoryBreakdown,
    topMerchants,
    budgetComparisons,
    chartRange,
    chartLabel: chartRangeLabel(chartRange),
    chartRangeOptions: buildChartRangeOptions(now),
  };
}

export async function getExpensesPageData(opts?: {
  chartRangeParam?: string | null;
}): Promise<ExpensesPageData> {
  const { supabase, user } = await requireUser();

  const [expenses, analytics, accountsRes, cardsRes, categoriesRes] =
    await Promise.all([
      getExpenses(),
      getExpenseAnalytics({ chartRangeParam: opts?.chartRangeParam }),
      supabase
        .from("accounts")
        .select("id, name, bank_name, current_balance")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .neq("account_type", "broker_wallet")
        .order("name"),
      supabase
        .from("credit_cards")
        .select("id, bank, card_name, last_four, outstanding, credit_limit")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("bank")
        .order("card_name"),
      supabase
        .from("categories")
        .select("id, name, color, icon")
        .eq("user_id", user.id)
        .eq("kind", "expense")
        .order("sort_order")
        .order("name"),
    ]);

  if (accountsRes.error) throw new Error(accountsRes.error.message);
  if (cardsRes.error) throw new Error(cardsRes.error.message);
  if (categoriesRes.error) throw new Error(categoriesRes.error.message);

  return {
    expenses,
    analytics,
    accounts: (accountsRes.data ?? []).map((a) => ({
      ...a,
      current_balance: Number(a.current_balance),
    })),
    creditCards: (cardsRes.data ?? []).map((c) => ({
      ...c,
      outstanding: Number(c.outstanding),
      credit_limit: Number(c.credit_limit),
    })),
    categories: categoriesRes.data ?? [],
  };
}
