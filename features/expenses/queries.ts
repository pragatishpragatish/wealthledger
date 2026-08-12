import { endOfYear, startOfWeek, startOfYear } from "date-fns";
import { requireUser } from "@/lib/auth";
import { getCurrentMonthRange, toDateString } from "@/utils/date";
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

export type ExpenseAnalytics = {
  dailyTotal: number;
  weeklyTotal: number;
  monthlyTotal: number;
  yearlyTotal: number;
  count: number;
  categoryBreakdown: AllocationPoint[];
  topMerchants: MerchantSpend[];
  budgetComparisons: BudgetComparison[];
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

export async function getExpenseAnalytics(): Promise<ExpenseAnalytics> {
  const { supabase, user } = await requireUser();
  const now = new Date();
  const today = toDateString(now);
  const weekStart = toDateString(startOfWeek(now, { weekStartsOn: 1 }));
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange();
  const yearStart = toDateString(startOfYear(now));
  const yearEnd = toDateString(endOfYear(now));

  const [yearRes, catsRes, budgetsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, date, category_id, merchant")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("date", yearStart)
      .lte("date", yearEnd),
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
      .eq("year", now.getFullYear())
      .eq("month", now.getMonth() + 1),
  ]);

  if (yearRes.error) throw new Error(yearRes.error.message);
  if (catsRes.error) throw new Error(catsRes.error.message);

  const rows = yearRes.data ?? [];
  const categories = catsRes.data ?? [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  let dailyTotal = 0;
  let weeklyTotal = 0;
  let monthlyTotal = 0;
  let yearlyTotal = 0;
  let monthCount = 0;

  const byCat = new Map<string, number>();
  const byMerchant = new Map<string, { total: number; count: number }>();

  for (const tx of rows) {
    const amount = Number(tx.amount);
    yearlyTotal += amount;

    if (tx.date === today) dailyTotal += amount;
    if (tx.date >= weekStart && tx.date <= today) weeklyTotal += amount;
    if (tx.date >= monthStart && tx.date <= monthEnd) {
      monthlyTotal += amount;
      monthCount += 1;
    }

    const cat = tx.category_id ? catMap.get(tx.category_id) : null;
    const catName = cat?.name ?? "Uncategorized";
    byCat.set(catName, (byCat.get(catName) ?? 0) + amount);

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

  // Prefer live spent from month transactions for budget comparison
  const monthSpendByCat = new Map<string, number>();
  for (const tx of rows.filter(
    (t) => t.date >= monthStart && t.date <= monthEnd
  )) {
    if (!tx.category_id) continue;
    monthSpendByCat.set(
      tx.category_id,
      (monthSpendByCat.get(tx.category_id) ?? 0) + Number(tx.amount)
    );
  }

  const budgetRows = budgetsRes.data ?? [];
  const budgetComparisons: BudgetComparison[] = budgetRows.map((b) => {
    const raw = b.category as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const cat = Array.isArray(raw) ? (raw[0] ?? null) : raw;
    const budgetAmount = Number(b.amount);
    const spent =
      (b.category_id ? monthSpendByCat.get(b.category_id) : undefined) ??
      Number(b.spent);
    return {
      id: b.id,
      categoryName: cat?.name ?? "Overall",
      budgetAmount,
      spent,
      percent: budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0,
    };
  });

  return {
    dailyTotal,
    weeklyTotal,
    monthlyTotal,
    yearlyTotal,
    count: monthCount,
    categoryBreakdown,
    topMerchants,
    budgetComparisons,
  };
}

export async function getExpensesPageData(): Promise<ExpensesPageData> {
  const { supabase, user } = await requireUser();

  const [expenses, analytics, accountsRes, cardsRes, categoriesRes] =
    await Promise.all([
      getExpenses(),
      getExpenseAnalytics(),
      supabase
        .from("accounts")
        .select("id, name, bank_name, current_balance")
        .eq("user_id", user.id)
        .eq("is_active", true)
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
