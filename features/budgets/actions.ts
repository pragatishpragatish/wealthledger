"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { budgetSchema } from "@/features/budgets/schemas";
import {
  getBudgetProgression,
  type BudgetProgressionPoint,
} from "@/features/budgets/queries";
import type { BudgetPeriod } from "@/types";

export type BudgetActionResult = {
  error?: string;
  success?: boolean;
};

function revalidateBudgetPaths() {
  revalidatePath("/budgets");
  revalidatePath("/expenses");
  revalidatePath("/");
}

async function insertHistory(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  row: {
    user_id: string;
    budget_id: string | null;
    category_id: string | null;
    period: "monthly" | "yearly";
    year: number;
    month: number | null;
    old_amount: number | null;
    new_amount: number;
    source: "create" | "edit" | "recurring_seed";
  }
) {
  await supabase.from("budget_amount_history").insert(row);
}

export async function createBudget(
  input: unknown
): Promise<BudgetActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const month = values.period === "yearly" ? null : values.month!;
  let templateId: string | null = null;

  if (values.is_recurring) {
    const { data: existingTemplate } = await supabase
      .from("budget_templates")
      .select("id")
      .eq("user_id", user.id)
      .eq("category_id", values.category_id)
      .eq("period", values.period)
      .maybeSingle();

    if (existingTemplate) {
      const { error: tplErr } = await supabase
        .from("budget_templates")
        .update({
          amount: values.amount,
          is_active: true,
        })
        .eq("id", existingTemplate.id)
        .eq("user_id", user.id);
      if (tplErr) return { error: tplErr.message };
      templateId = existingTemplate.id;
    } else {
      const { data: created, error: tplErr } = await supabase
        .from("budget_templates")
        .insert({
          user_id: user.id,
          category_id: values.category_id,
          period: values.period,
          amount: values.amount,
          is_active: true,
        })
        .select("id")
        .single();
      if (tplErr) return { error: tplErr.message };
      templateId = created.id;
    }
  }

  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({
      user_id: user.id,
      category_id: values.category_id,
      period: values.period,
      year: values.year,
      month,
      amount: values.amount,
      spent: 0,
      template_id: templateId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "A budget already exists for this category and period" };
    }
    return { error: error.message };
  }

  await insertHistory(supabase, {
    user_id: user.id,
    budget_id: budget.id,
    category_id: values.category_id,
    period: values.period,
    year: values.year,
    month,
    old_amount: null,
    new_amount: values.amount,
    source: "create",
  });

  revalidateBudgetPaths();
  return { success: true };
}

export async function updateBudget(
  id: string,
  input: unknown
): Promise<BudgetActionResult> {
  if (!id) return { error: "Budget id is required" };

  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const month = values.period === "yearly" ? null : values.month!;

  const { data: existing, error: fetchError } = await supabase
    .from("budgets")
    .select("id, amount, template_id, category_id, period, year, month")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Budget not found" };

  const oldAmount = Number(existing.amount);

  const { error } = await supabase
    .from("budgets")
    .update({
      category_id: values.category_id,
      period: values.period,
      year: values.year,
      month,
      amount: values.amount,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A budget already exists for this category and period" };
    }
    return { error: error.message };
  }

  if (Math.abs(oldAmount - values.amount) > 0.001) {
    await insertHistory(supabase, {
      user_id: user.id,
      budget_id: id,
      category_id: values.category_id,
      period: values.period,
      year: values.year,
      month,
      old_amount: oldAmount,
      new_amount: values.amount,
      source: "edit",
    });
  }

  if (
    existing.template_id &&
    !values.this_period_only &&
    Math.abs(oldAmount - values.amount) > 0.001
  ) {
    const { error: tplErr } = await supabase
      .from("budget_templates")
      .update({ amount: values.amount, is_active: true })
      .eq("id", existing.template_id)
      .eq("user_id", user.id);
    if (tplErr) return { error: tplErr.message };
  }

  // Opt-in to recurring from a one-off budget
  if (values.is_recurring && !existing.template_id) {
    const { data: existingTemplate } = await supabase
      .from("budget_templates")
      .select("id")
      .eq("user_id", user.id)
      .eq("category_id", values.category_id)
      .eq("period", values.period)
      .maybeSingle();

    let templateId: string;
    if (existingTemplate) {
      await supabase
        .from("budget_templates")
        .update({ amount: values.amount, is_active: true })
        .eq("id", existingTemplate.id)
        .eq("user_id", user.id);
      templateId = existingTemplate.id;
    } else {
      const { data: created, error: tplErr } = await supabase
        .from("budget_templates")
        .insert({
          user_id: user.id,
          category_id: values.category_id,
          period: values.period,
          amount: values.amount,
          is_active: true,
        })
        .select("id")
        .single();
      if (tplErr) return { error: tplErr.message };
      templateId = created.id;
    }

    await supabase
      .from("budgets")
      .update({ template_id: templateId })
      .eq("id", id)
      .eq("user_id", user.id);
  }

  revalidateBudgetPaths();
  return { success: true };
}

export async function deleteBudget(id: string): Promise<BudgetActionResult> {
  if (!id) return { error: "Budget id is required" };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateBudgetPaths();
  return { success: true };
}

export async function stopRecurringBudget(
  templateId: string
): Promise<BudgetActionResult> {
  if (!templateId) return { error: "Template id is required" };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("budget_templates")
    .update({ is_active: false })
    .eq("id", templateId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  // Detach current period rows so they remain as one-offs
  await supabase
    .from("budgets")
    .update({ template_id: null })
    .eq("template_id", templateId)
    .eq("user_id", user.id);

  revalidateBudgetPaths();
  return { success: true };
}

export async function fetchBudgetProgression(opts: {
  categoryId: string;
  year: number;
  period: BudgetPeriod;
}): Promise<{ data?: BudgetProgressionPoint[]; error?: string }> {
  try {
    if (!opts.categoryId) return { error: "Category is required" };
    if (!Number.isFinite(opts.year)) return { error: "Invalid year" };
    const data = await getBudgetProgression(opts);
    return { data };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to load progression",
    };
  }
}
