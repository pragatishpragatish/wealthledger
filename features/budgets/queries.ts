import {
  endOfMonth,
  endOfYear,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { requireUser } from "@/lib/auth";
import { toDateString } from "@/utils/date";
import type { Budget, BudgetPeriod, Category } from "@/types";

export type BudgetComputed = Omit<Budget, "category"> & {
  remaining: number;
  usagePercent: number;
  warningLevel: 0 | 50 | 75 | 90 | 100;
  is_recurring: boolean;
  category: Pick<Category, "id" | "name" | "color" | "icon"> | null;
};

export type BudgetProgressionPoint = {
  year: number;
  month: number | null;
  label: string;
  budgetAmount: number | null;
  spent: number;
  usagePercent: number;
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

async function ensurePeriodBudgets(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  period: BudgetPeriod,
  year: number,
  month: number
) {
  const { data: templates, error: tplError } = await supabase
    .from("budget_templates")
    .select("id, category_id, period, amount")
    .eq("user_id", userId)
    .eq("period", period)
    .eq("is_active", true);

  if (tplError) throw new Error(tplError.message);
  if (!templates?.length) return;

  let existingQuery = supabase
    .from("budgets")
    .select("id, category_id, template_id")
    .eq("user_id", userId)
    .eq("period", period)
    .eq("year", year);

  if (period === "monthly") {
    existingQuery = existingQuery.eq("month", month);
  } else {
    existingQuery = existingQuery.is("month", null);
  }

  const { data: existing, error: existingError } = await existingQuery;
  if (existingError) throw new Error(existingError.message);

  const byCategory = new Map(
    (existing ?? []).map((b) => [b.category_id as string, b])
  );

  for (const tpl of templates) {
    const found = byCategory.get(tpl.category_id);
    if (found) {
      // Link orphan period row to template if same category/period
      if (!found.template_id) {
        await supabase
          .from("budgets")
          .update({ template_id: tpl.id })
          .eq("id", found.id)
          .eq("user_id", userId);
      }
      continue;
    }

    const seedMonth = period === "yearly" ? null : month;
    const { data: created, error: insertError } = await supabase
      .from("budgets")
      .insert({
        user_id: userId,
        category_id: tpl.category_id,
        period,
        year,
        month: seedMonth,
        amount: tpl.amount,
        spent: 0,
        template_id: tpl.id,
      })
      .select("id")
      .single();

    if (insertError) {
      // Race / unique: another request created it
      if (insertError.code === "23505") continue;
      throw new Error(insertError.message);
    }

    await supabase.from("budget_amount_history").insert({
      user_id: userId,
      budget_id: created.id,
      category_id: tpl.category_id,
      period,
      year,
      month: seedMonth,
      old_amount: null,
      new_amount: tpl.amount,
      source: "recurring_seed",
    });
  }
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

  await ensurePeriodBudgets(supabase, user.id, period, year, month);

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
    const templateId = (row.template_id as string | null) ?? null;

    if (Math.abs(spent - Number(row.spent)) > 0.001) {
      void supabase
        .from("budgets")
        .update({ spent })
        .eq("id", row.id)
        .eq("user_id", user.id);
    }

    return {
      ...(row as unknown as Budget),
      template_id: templateId,
      amount,
      spent,
      remaining,
      usagePercent,
      warningLevel: warningLevel(usagePercent),
      is_recurring: Boolean(templateId),
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

export async function getBudgetProgression(opts: {
  categoryId: string;
  year: number;
  period: BudgetPeriod;
}): Promise<BudgetProgressionPoint[]> {
  const { supabase, user } = await requireUser();
  const { categoryId, year, period } = opts;

  const yearStart = toDateString(startOfYear(new Date(year, 0, 1)));
  const yearEnd = toDateString(endOfYear(new Date(year, 0, 1)));

  const [budgetsRes, txRes] = await Promise.all([
    supabase
      .from("budgets")
      .select("amount, year, month, period")
      .eq("user_id", user.id)
      .eq("category_id", categoryId)
      .eq("period", period)
      .eq("year", year),
    supabase
      .from("transactions")
      .select("amount, date")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .eq("category_id", categoryId)
      .gte("date", yearStart)
      .lte("date", yearEnd),
  ]);

  if (budgetsRes.error) throw new Error(budgetsRes.error.message);
  if (txRes.error) throw new Error(txRes.error.message);

  if (period === "yearly") {
    const budgetRow = (budgetsRes.data ?? []).find((b) => b.month == null);
    const spent = (txRes.data ?? []).reduce(
      (s, t) => s + Number(t.amount),
      0
    );
    const budgetAmount = budgetRow ? Number(budgetRow.amount) : null;
    return [
      {
        year,
        month: null,
        label: String(year),
        budgetAmount,
        spent,
        usagePercent:
          budgetAmount && budgetAmount > 0
            ? (spent / budgetAmount) * 100
            : 0,
      },
    ];
  }

  const budgetByMonth = new Map<number, number>();
  for (const b of budgetsRes.data ?? []) {
    if (b.month != null) budgetByMonth.set(b.month, Number(b.amount));
  }

  const spentByMonth = new Map<number, number>();
  for (const t of txRes.data ?? []) {
    const m = new Date(t.date + "T00:00:00").getMonth() + 1;
    spentByMonth.set(m, (spentByMonth.get(m) ?? 0) + Number(t.amount));
  }

  const points: BudgetProgressionPoint[] = [];
  for (let m = 1; m <= 12; m++) {
    const budgetAmount = budgetByMonth.has(m)
      ? (budgetByMonth.get(m) ?? null)
      : null;
    const spent = spentByMonth.get(m) ?? 0;
    // Skip empty months with no budget and no spend
    if (budgetAmount == null && spent === 0) continue;
    points.push({
      year,
      month: m,
      label: new Date(2000, m - 1).toLocaleString("en-IN", { month: "short" }),
      budgetAmount,
      spent,
      usagePercent:
        budgetAmount && budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0,
    });
  }

  return points;
}
