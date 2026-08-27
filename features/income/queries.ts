import { startOfYear, endOfYear } from "date-fns";
import { requireUser } from "@/lib/auth";
import { getCurrentMonthRange, toDateString } from "@/utils/date";
import type { Account, AllocationPoint, Category, Transaction } from "@/types";

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

export type IncomeRow = Transaction & {
  category: Pick<Category, "id" | "name" | "color" | "icon"> | null;
  account: Pick<Account, "id" | "name" | "bank_name"> | null;
};

export type IncomeAnalytics = {
  monthlyTotal: number;
  yearlyTotal: number;
  count: number;
  recurringCount: number;
  categoryBreakdown: AllocationPoint[];
};

export type IncomePageData = {
  incomes: IncomeRow[];
  analytics: IncomeAnalytics;
  accounts: Pick<Account, "id" | "name" | "bank_name" | "current_balance">[];
  categories: Pick<Category, "id" | "name" | "color" | "icon">[];
};

function mapIncomeRow(row: Record<string, unknown>): IncomeRow {
  const category = row.category as IncomeRow["category"];
  const account = row.account as IncomeRow["account"];
  return {
    ...(row as unknown as Transaction),
    amount: Number(row.amount),
    category: category ?? null,
    account: account ?? null,
    tags: undefined,
  };
}

export async function getIncomes(limit = 100): Promise<IncomeRow[]> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("transactions")
    .select(
      `
      *,
      category:categories(id, name, color, icon),
      account:accounts!account_id(id, name, bank_name)
    `
    )
    .eq("user_id", user.id)
    .eq("type", "income")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapIncomeRow(row as Record<string, unknown>));
}

export async function getIncomeAnalytics(): Promise<IncomeAnalytics> {
  const { supabase, user } = await requireUser();
  const { start, end } = getCurrentMonthRange();
  const now = new Date();
  const yearStart = toDateString(startOfYear(now));
  const yearEnd = toDateString(endOfYear(now));

  const [monthRes, yearRes, catsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, category_id, is_recurring")
      .eq("user_id", user.id)
      .eq("type", "income")
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("transactions")
      .select("id, amount, category_id")
      .eq("user_id", user.id)
      .eq("type", "income")
      .gte("date", yearStart)
      .lte("date", yearEnd),
    supabase
      .from("categories")
      .select("id, name, color")
      .eq("user_id", user.id)
      .eq("kind", "income"),
  ]);

  if (monthRes.error) throw new Error(monthRes.error.message);
  if (yearRes.error) throw new Error(yearRes.error.message);

  const monthRows = monthRes.data ?? [];
  const yearRows = yearRes.data ?? [];
  const categories = catsRes.data ?? [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const monthlyTotal = monthRows.reduce((s, t) => s + Number(t.amount), 0);
  const yearlyTotal = yearRows.reduce((s, t) => s + Number(t.amount), 0);
  const recurringCount = monthRows.filter((t) => t.is_recurring).length;

  const byCat = new Map<string, number>();
  for (const tx of yearRows) {
    const cat = tx.category_id ? catMap.get(tx.category_id) : null;
    const name = cat?.name ?? "Uncategorized";
    byCat.set(name, (byCat.get(name) ?? 0) + Number(tx.amount));
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

  return {
    monthlyTotal,
    yearlyTotal,
    count: monthRows.length,
    recurringCount,
    categoryBreakdown,
  };
}

export async function getIncomePageData(): Promise<IncomePageData> {
  const { supabase, user } = await requireUser();

  const [incomes, analytics, accountsRes, categoriesRes] = await Promise.all([
    getIncomes(),
    getIncomeAnalytics(),
    supabase
      .from("accounts")
      .select("id, name, bank_name, current_balance")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .neq("account_type", "broker_wallet")
      .order("name"),
    supabase
      .from("categories")
      .select("id, name, color, icon")
      .eq("user_id", user.id)
      .eq("kind", "income")
      .order("sort_order")
      .order("name"),
  ]);

  if (accountsRes.error) throw new Error(accountsRes.error.message);
  if (categoriesRes.error) throw new Error(categoriesRes.error.message);

  return {
    incomes,
    analytics,
    accounts: (accountsRes.data ?? []).map((a) => ({
      ...a,
      current_balance: Number(a.current_balance),
    })),
    categories: categoriesRes.data ?? [],
  };
}
