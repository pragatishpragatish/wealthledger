"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { goalSchema } from "@/features/goals/schemas";

export type GoalActionResult = {
  error?: string;
  success?: boolean;
};

function revalidateGoalPaths() {
  revalidatePath("/goals");
  revalidatePath("/calendar");
  revalidatePath("/");
}

function normalizeTargetDate(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  return value;
}

export async function createGoal(input: unknown): Promise<GoalActionResult> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  if (values.current_amount > values.target_amount) {
    return { error: "Current amount cannot exceed target" };
  }

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    name: values.name,
    type: values.type,
    target_amount: values.target_amount,
    current_amount: values.current_amount,
    monthly_contribution: values.monthly_contribution,
    target_date: normalizeTargetDate(values.target_date),
    color: values.color ?? null,
    notes: values.notes ?? null,
    is_completed: values.current_amount >= values.target_amount,
    completed_at:
      values.current_amount >= values.target_amount
        ? new Date().toISOString()
        : null,
  });

  if (error) return { error: error.message };

  revalidateGoalPaths();
  return { success: true };
}

export async function updateGoal(
  id: string,
  input: unknown
): Promise<GoalActionResult> {
  if (!id) return { error: "Goal id is required" };

  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  if (values.current_amount > values.target_amount) {
    return { error: "Current amount cannot exceed target" };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("goals")
    .select("id, is_completed")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Goal not found" };

  const reached = values.current_amount >= values.target_amount;

  const { error } = await supabase
    .from("goals")
    .update({
      name: values.name,
      type: values.type,
      target_amount: values.target_amount,
      current_amount: values.current_amount,
      monthly_contribution: values.monthly_contribution,
      target_date: normalizeTargetDate(values.target_date),
      color: values.color ?? null,
      notes: values.notes ?? null,
      is_completed: reached ? true : existing.is_completed,
      completed_at: reached ? new Date().toISOString() : undefined,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateGoalPaths();
  return { success: true };
}

export async function markGoalComplete(
  id: string
): Promise<GoalActionResult> {
  if (!id) return { error: "Goal id is required" };

  const { supabase, user } = await requireUser();

  const { data: existing, error: fetchError } = await supabase
    .from("goals")
    .select("id, target_amount")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Goal not found" };

  const { error } = await supabase
    .from("goals")
    .update({
      is_completed: true,
      current_amount: Number(existing.target_amount),
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateGoalPaths();
  return { success: true };
}

export async function deleteGoal(id: string): Promise<GoalActionResult> {
  if (!id) return { error: "Goal id is required" };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateGoalPaths();
  return { success: true };
}
