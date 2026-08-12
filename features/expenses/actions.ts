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
  revalidatePath("/credit-cards");
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

async function adjustCreditCardOutstanding(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  delta: number
): Promise<string | null> {
  const { data: card, error } = await supabase
    .from("credit_cards")
    .select("id, outstanding, credit_limit")
    .eq("id", cardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return error.message;
  if (!card) return "Credit card not found";

  const next = Number(card.outstanding) + delta;
  if (next < -0.001) return "Credit card outstanding cannot go negative";

  const { error: updateError } = await supabase
    .from("credit_cards")
    .update({ outstanding: Math.max(0, next) })
    .eq("id", cardId)
    .eq("user_id", userId);

  return updateError?.message ?? null;
}

async function applyExpenseFunding(
  supabase: SupabaseClient,
  userId: string,
  opts: {
    accountId: string | null;
    creditCardId: string | null;
    /** Positive amount charged to the funding source */
    amount: number;
    /** true = charge (debit account / raise outstanding), false = reverse */
    charge: boolean;
  }
): Promise<string | null> {
  const delta = opts.charge ? -opts.amount : opts.amount;
  if (opts.accountId) {
    return adjustAccountBalance(supabase, userId, opts.accountId, delta);
  }
  if (opts.creditCardId) {
    // Charge increases outstanding; reverse decreases it
    const ccDelta = opts.charge ? opts.amount : -opts.amount;
    return adjustCreditCardOutstanding(
      supabase,
      userId,
      opts.creditCardId,
      ccDelta
    );
  }
  return "Select a bank account or credit card";
}

async function upsertCreditCardCharge(
  supabase: SupabaseClient,
  userId: string,
  opts: {
    transactionId: string;
    creditCardId: string;
    date: string;
    amount: number;
    merchant: string | null;
    categoryId: string | null;
    notes: string | null;
  }
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("credit_card_transactions")
    .select("id")
    .eq("transaction_id", opts.transactionId)
    .eq("user_id", userId)
    .maybeSingle();

  const payload = {
    user_id: userId,
    credit_card_id: opts.creditCardId,
    transaction_id: opts.transactionId,
    date: opts.date,
    amount: opts.amount,
    merchant: opts.merchant,
    category_id: opts.categoryId,
    description: opts.notes,
    is_payment: false,
  };

  if (existing) {
    const { error } = await supabase
      .from("credit_card_transactions")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", userId);
    return error?.message ?? null;
  }

  const { error } = await supabase
    .from("credit_card_transactions")
    .insert(payload);
  return error?.message ?? null;
}

async function removeCreditCardCharge(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string
): Promise<void> {
  await supabase
    .from("credit_card_transactions")
    .delete()
    .eq("transaction_id", transactionId)
    .eq("user_id", userId);
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
  const paymentMethod =
    values.payment_method ??
    (values.credit_card_id ? ("card" as const) : null);

  const { data: row, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "expense",
      date: values.date,
      amount: values.amount,
      category_id: values.category_id ?? null,
      account_id: values.account_id,
      credit_card_id: values.credit_card_id,
      merchant: values.merchant ?? null,
      payment_method: paymentMethod,
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

  const fundError = await applyExpenseFunding(supabase, user.id, {
    accountId: values.account_id,
    creditCardId: values.credit_card_id,
    amount: values.amount,
    charge: true,
  });
  if (fundError) {
    await supabase.from("transactions").delete().eq("id", row.id);
    return { error: fundError };
  }

  if (values.credit_card_id) {
    const ccError = await upsertCreditCardCharge(supabase, user.id, {
      transactionId: row.id,
      creditCardId: values.credit_card_id,
      date: values.date,
      amount: values.amount,
      merchant: values.merchant ?? null,
      categoryId: values.category_id ?? null,
      notes: values.notes ?? null,
    });
    if (ccError) return { error: ccError };
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
    .select("id, amount, account_id, credit_card_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "expense")
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Expense not found" };

  const oldAccountId = existing.account_id as string | null;
  const oldCardId = existing.credit_card_id as string | null;
  const oldAmount = Number(existing.amount);

  // Reverse previous funding
  const revError = await applyExpenseFunding(supabase, user.id, {
    accountId: oldAccountId,
    creditCardId: oldCardId,
    amount: oldAmount,
    charge: false,
  });
  if (revError) return { error: revError };

  const paymentMethod =
    values.payment_method ??
    (values.credit_card_id ? ("card" as const) : null);

  const { error } = await supabase
    .from("transactions")
    .update({
      date: values.date,
      amount: values.amount,
      category_id: values.category_id ?? null,
      account_id: values.account_id,
      credit_card_id: values.credit_card_id,
      merchant: values.merchant ?? null,
      payment_method: paymentMethod,
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
    await applyExpenseFunding(supabase, user.id, {
      accountId: oldAccountId,
      creditCardId: oldCardId,
      amount: oldAmount,
      charge: true,
    });
    return { error: error.message };
  }

  const fundError = await applyExpenseFunding(supabase, user.id, {
    accountId: values.account_id,
    creditCardId: values.credit_card_id,
    amount: values.amount,
    charge: true,
  });
  if (fundError) {
    await applyExpenseFunding(supabase, user.id, {
      accountId: oldAccountId,
      creditCardId: oldCardId,
      amount: oldAmount,
      charge: true,
    });
    return { error: fundError };
  }

  if (values.credit_card_id) {
    const ccError = await upsertCreditCardCharge(supabase, user.id, {
      transactionId: id,
      creditCardId: values.credit_card_id,
      date: values.date,
      amount: values.amount,
      merchant: values.merchant ?? null,
      categoryId: values.category_id ?? null,
      notes: values.notes ?? null,
    });
    if (ccError) return { error: ccError };
  } else {
    await removeCreditCardCharge(supabase, user.id, id);
  }

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
    .select("id, amount, account_id, credit_card_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "expense")
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Expense not found" };

  const revError = await applyExpenseFunding(supabase, user.id, {
    accountId: existing.account_id as string | null,
    creditCardId: existing.credit_card_id as string | null,
    amount: Number(existing.amount),
    charge: false,
  });
  if (revError) return { error: revError };

  await removeCreditCardCharge(supabase, user.id, id);

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    await applyExpenseFunding(supabase, user.id, {
      accountId: existing.account_id as string | null,
      creditCardId: existing.credit_card_id as string | null,
      amount: Number(existing.amount),
      charge: true,
    });
    return { error: error.message };
  }

  revalidateExpensePaths();
  return { success: true };
}
