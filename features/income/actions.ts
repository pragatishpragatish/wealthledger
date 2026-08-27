"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { incomeSchema } from "@/features/income/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

export type IncomeActionResult = {
  error?: string;
  success?: boolean;
};

function revalidateIncomePaths() {
  revalidatePath("/income");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
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
    .select("id, current_balance, account_type")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return error.message;
  if (!account) return "Account not found";
  if (account.account_type === "broker_wallet") {
    return "Broker wallets are funded via Transfers from a bank account only";
  }

  const next = Number(account.current_balance) + delta;
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ current_balance: next })
    .eq("id", accountId)
    .eq("user_id", userId);

  return updateError?.message ?? null;
}

export async function createIncome(
  input: unknown
): Promise<IncomeActionResult> {
  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  const { data: row, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "income",
      date: values.date,
      amount: values.amount,
      category_id: values.category_id ?? null,
      account_id: values.account_id,
      notes: values.notes ?? null,
      is_recurring: values.is_recurring,
      recurring_frequency: values.is_recurring
        ? values.recurring_frequency
        : null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!row) return { error: "Failed to create income" };

  const balError = await adjustAccountBalance(
    supabase,
    user.id,
    values.account_id,
    values.amount
  );
  if (balError) {
    await supabase.from("transactions").delete().eq("id", row.id);
    return { error: balError };
  }

  revalidateIncomePaths();
  return { success: true };
}

export async function updateIncome(
  id: string,
  input: unknown
): Promise<IncomeActionResult> {
  if (!id) return { error: "Income id is required" };

  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("id, amount, account_id, type")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "income")
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Income not found" };

  // Reverse previous credit
  if (existing.account_id) {
    const revError = await adjustAccountBalance(
      supabase,
      user.id,
      existing.account_id,
      -Number(existing.amount)
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
      notes: values.notes ?? null,
      is_recurring: values.is_recurring,
      recurring_frequency: values.is_recurring
        ? values.recurring_frequency
        : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    // Attempt to restore previous balance on failure
    if (existing.account_id) {
      await adjustAccountBalance(
        supabase,
        user.id,
        existing.account_id,
        Number(existing.amount)
      );
    }
    return { error: error.message };
  }

  const balError = await adjustAccountBalance(
    supabase,
    user.id,
    values.account_id,
    values.amount
  );
  if (balError) return { error: balError };

  revalidateIncomePaths();
  return { success: true };
}

export async function deleteIncome(id: string): Promise<IncomeActionResult> {
  if (!id) return { error: "Income id is required" };

  const { supabase, user } = await requireUser();

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("id, amount, account_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "income")
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Income not found" };

  if (existing.account_id) {
    const revError = await adjustAccountBalance(
      supabase,
      user.id,
      existing.account_id,
      -Number(existing.amount)
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
        Number(existing.amount)
      );
    }
    return { error: error.message };
  }

  revalidateIncomePaths();
  return { success: true };
}
