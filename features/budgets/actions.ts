"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { budgetSchema } from "@/features/budgets/schemas";

export type BudgetActionResult = {
  error?: string;
  success?: boolean;
};

function revalidateBudgetPaths() {
  revalidatePath("/budgets");
  revalidatePath("/expenses");
  revalidatePath("/");
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

  const { error } = await supabase.from("budgets").insert({
    user_id: user.id,
    category_id: values.category_id,
    period: values.period,
    year: values.year,
    month,
    amount: values.amount,
    spent: 0,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A budget already exists for this category and period" };
    }
    return { error: error.message };
  }

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
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Budget not found" };

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
