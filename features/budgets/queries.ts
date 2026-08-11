import { endOfMonth, endOfYear, startOfMonth, startOfYear } from "date-fns";
import { requireUser } from "@/lib/auth";
import { toDateString } from "@/utils/date";
import type { Budget, BudgetPeriod, Category } from "@/types";

export type BudgetComputed = Omit<Budget, "category"> & {
  remaining: number;
  usagePercent: number;
  warningLevel: 0 | 50 | 75 | 90 | 100;
  category: Pick<Category, "id" | "name" | "color" | "icon"> | null;
};

export type BudgetsPageData = {
  budgets: BudgetComputed[];
  period: BudgetPeriod;
  year: number;
  month: number;
  categories: Pick<Category, "id" | "name" | "color" | "icon">[];
  summary: {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    overBudgetCount: number;
  };
};

function warningLevel(pct: number): BudgetComputed["warningLevel"] {
  if (pct >= 100) return 100;
  if (pct >= 90) return 90;
  if (pct >= 75) return 75;
  if (pct >= 50) return 50;
  return 0;
}

function periodRange(
  period: BudgetPeriod,
  year: number,
  month: number
): { start: string; end: string } {
  if (period === "yearly") {
    const d = new Date(year, 0, 1);
    return {
      start: toDateString(startOfYear(d)),
      end: toDateString(endOfYear(d)),
    };
  }
  const d = new Date(year, month - 1, 1);
  return {
    start: toDateString(startOfMonth(d)),
    end: toDateString(endOfMonth(d)),
  };
}

export async function getBudgetsPageData(opts?: {
  period?: BudgetPeriod;
  year?: number;
  month?: number;
}): Promise<BudgetsPageData> {
  const { supabase, user } = await requireUser();
  const now = new Date();
  const period: BudgetPeriod = opts?.period ?? "monthly";
  const year = opts?.year ?? now.getFullYear();
  const month = opts?.month ?? now.getMonth() + 1;
  const { start, end } = periodRange(period, year, month);

  let budgetQuery = supabase
    .from("budgets")
    .select(
      `
      *,
      category:categories(id, name, color, icon)
    `
    )
    .eq("user_id", user.id)
    .eq("period", period)
    .eq("year", year)
    .order("created_at", { ascending: false });

  if (period === "monthly") {
    budgetQuery = budgetQuery.eq("month", month);
  }

  const [budgetsRes, txRes, catsRes] = await Promise.all([
    budgetQuery,
    supabase
      .from("transactions")
      .select("amount, category_id")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("categories")
      .select("id, name, color, icon")
      .eq("user_id", user.id)
      .eq("kind", "expense")
      .order("sort_order")
      .order("name"),
  ]);

  if (budgetsRes.error) throw new Error(budgetsRes.error.message);
  if (txRes.error) throw new Error(txRes.error.message);
  if (catsRes.error) throw new Error(catsRes.error.message);

  const spendByCat = new Map<string, number>();
  for (const tx of txRes.data ?? []) {
    if (!tx.category_id) continue;
    spendByCat.set(
      tx.category_id,
      (spendByCat.get(tx.category_id) ?? 0) + Number(tx.amount)
    );
  }

  const budgets: BudgetComputed[] = (budgetsRes.data ?? []).map((row) => {
    const raw = row.category as
      | Pick<Category, "id" | "name" | "color" | "icon">
      | Pick<Category, "id" | "name" | "color" | "icon">[]
      | null;
    const category = Array.isArray(raw) ? (raw[0] ?? null) : raw;
    const amount = Number(row.amount);
    const spent = row.category_id
      ? (spendByCat.get(row.category_id) ?? 0)
      : Number(row.spent);
    const remaining = amount - spent;
    const usagePercent = amount > 0 ? (spent / amount) * 100 : 0;

    // Persist refreshed spent so analytics stay in sync
    if (Math.abs(spent - Number(row.spent)) > 0.001) {
      void supabase
        .from("budgets")
        .update({ spent })
        .eq("id", row.id)
        .eq("user_id", user.id);
    }

    return {
      ...(row as unknown as Budget),
      amount,
      spent,
      remaining,
      usagePercent,
      warningLevel: warningLevel(usagePercent),
      category,
    };
  });

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  return {
    budgets,
    period,
    year,
    month,
    categories: catsRes.data ?? [],
    summary: {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      overBudgetCount: budgets.filter((b) => b.usagePercent >= 100).length,
    },
  };
}
