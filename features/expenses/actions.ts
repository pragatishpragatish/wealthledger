"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { expenseSchema } from "@/features/expenses/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExpenseActionResult = {
  error?: string;
  success?: boolean;
};

function revalidateExpensePaths() {
  revalidatePath("/expenses");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/budgets");
  revalidatePath("/");
}

async function adjustAccountBalance(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  delta: number
): Promise<string | null> {
  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, current_balance")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return error.message;
  if (!account) return "Account not found";

  const next = Number(account.current_balance) + delta;
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ current_balance: next })
    .eq("id", accountId)
    .eq("user_id", userId);

  return updateError?.message ?? null;
}

async function syncTags(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
  tagsCsv?: string
): Promise<string | null> {
  await supabase
    .from("transaction_tags")
    .delete()
    .eq("transaction_id", transactionId);

  if (!tagsCsv) return null;

  const names = [
    ...new Set(
      tagsCsv
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    ),
  ];
  if (names.length === 0) return null;

  const tagIds: string[] = [];
  for (const name of names) {
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      tagIds.push(existing.id);
      continue;
    }

    const { data: created, error } = await supabase
      .from("tags")
      .insert({ user_id: userId, name })
      .select("id")
      .single();

    if (error) return error.message;
    if (created) tagIds.push(created.id);
  }

  if (tagIds.length === 0) return null;

  const { error } = await supabase.from("transaction_tags").insert(
    tagIds.map((tag_id) => ({
      transaction_id: transactionId,
      tag_id,
    }))
  );

  return error?.message ?? null;
}

export async function createExpense(
  input: unknown
): Promise<ExpenseActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  const { data: row, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "expense",
      date: values.date,
      amount: values.amount,
      category_id: values.category_id ?? null,
      account_id: values.account_id,
      merchant: values.merchant ?? null,
      payment_method: values.payment_method ?? null,
      notes: values.notes ?? null,
      receipt_url: values.receipt_url ?? null,
      is_recurring: values.is_recurring,
      recurring_frequency: values.is_recurring
        ? values.recurring_frequency
        : null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!row) return { error: "Failed to create expense" };

  const balError = await adjustAccountBalance(
    supabase,
    user.id,
    values.account_id,
    -values.amount
  );
  if (balError) {
    await supabase.from("transactions").delete().eq("id", row.id);
    return { error: balError };
  }

  const tagError = await syncTags(supabase, user.id, row.id, values.tags);
  if (tagError) return { error: tagError };

  revalidateExpensePaths();
  return { success: true };
}

export async function updateExpense(
  id: string,
  input: unknown
): Promise<ExpenseActionResult> {
  if (!id) return { error: "Expense id is required" };

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("id, amount, account_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "expense")
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Expense not found" };

  // Reverse previous debit
  if (existing.account_id) {
    const revError = await adjustAccountBalance(
      supabase,
      user.id,
      existing.account_id,
      Number(existing.amount)
    );
    if (revError) return { error: revError };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      date: values.date,
      amount: values.amount,
      category_id: values.category_id ?? null,
      account_id: values.account_id,
      merchant: values.merchant ?? null,
      payment_method: values.payment_method ?? null,
      notes: values.notes ?? null,
      receipt_url: values.receipt_url ?? null,
      is_recurring: values.is_recurring,
      recurring_frequency: values.is_recurring
        ? values.recurring_frequency
        : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (existing.account_id) {
      await adjustAccountBalance(
        supabase,
        user.id,
        existing.account_id,
        -Number(existing.amount)
      );
    }
    return { error: error.message };
  }

  const balError = await adjustAccountBalance(
    supabase,
    user.id,
    values.account_id,
    -values.amount
  );
  if (balError) return { error: balError };

  const tagError = await syncTags(supabase, user.id, id, values.tags);
  if (tagError) return { error: tagError };

  revalidateExpensePaths();
  return { success: true };
}

export async function deleteExpense(id: string): Promise<ExpenseActionResult> {
  if (!id) return { error: "Expense id is required" };

  const { supabase, user } = await requireUser();

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("id, amount, account_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "expense")
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Expense not found" };

  if (existing.account_id) {
    const revError = await adjustAccountBalance(
      supabase,
      user.id,
      existing.account_id,
      Number(existing.amount)
    );
    if (revError) return { error: revError };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    if (existing.account_id) {
      await adjustAccountBalance(
        supabase,
        user.id,
        existing.account_id,
        -Number(existing.amount)
      );
    }
    return { error: error.message };
  }

  revalidateExpensePaths();
  return { success: true };
}
