"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import {
  transactionSchema,
  normalizeTransactionValues,
} from "@/features/transactions/schemas";
import type { PaymentMethod, TransactionType } from "@/types";

export type TransactionActionResult = {
  error?: string;
  success?: boolean;
};

type BalanceEffect = {
  type: TransactionType;
  amount: number;
  account_id: string | null;
  to_account_id: string | null;
};

function revalidateTxPaths() {
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
}

async function adjustAccountBalance(
  supabase: SupabaseClient,
  accountId: string,
  delta: number
) {
  const { data, error } = await supabase
    .from("accounts")
    .select("current_balance")
    .eq("id", accountId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Account not found");

  const next = Number(data.current_balance) + delta;
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ current_balance: next })
    .eq("id", accountId);

  if (updateError) throw new Error(updateError.message);
}

/**
 * Apply (or reverse) the balance impact of a transaction.
 * - income / adjustment: +amount to account
 * - expense: -amount from account
 * - transfer: -from, +to
 */
async function applyBalanceEffect(
  supabase: SupabaseClient,
  effect: BalanceEffect,
  reverse = false
) {
  const sign = reverse ? -1 : 1;
  const amount = Number(effect.amount) * sign;

  switch (effect.type) {
    case "income":
    case "adjustment": {
      if (!effect.account_id) return;
      await adjustAccountBalance(supabase, effect.account_id, amount);
      break;
    }
    case "expense": {
      if (!effect.account_id) return;
      await adjustAccountBalance(supabase, effect.account_id, -amount);
      break;
    }
    case "transfer": {
      if (!effect.account_id || !effect.to_account_id) return;
      await adjustAccountBalance(supabase, effect.account_id, -amount);
      await adjustAccountBalance(supabase, effect.to_account_id, amount);
      break;
    }
  }
}

async function syncTransactionTags(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
  tagsStr?: string
) {
  await supabase
    .from("transaction_tags")
    .delete()
    .eq("transaction_id", transactionId);

  if (!tagsStr?.trim()) return;

  const names = [
    ...new Set(
      tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    ),
  ];

  for (const name of names) {
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();

    let tagId = existing?.id;
    if (!tagId) {
      const { data: created, error } = await supabase
        .from("tags")
        .insert({ user_id: userId, name })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      tagId = created.id;
    }

    const { error: linkError } = await supabase
      .from("transaction_tags")
      .insert({ transaction_id: transactionId, tag_id: tagId });
    if (linkError) throw new Error(linkError.message);
  }
}

function toRow(
  values: ReturnType<typeof normalizeTransactionValues>,
  userId: string
) {
  return {
    user_id: userId,
    type: values.type,
    date: values.date,
    amount: values.amount,
    category_id: values.category_id,
    account_id: values.account_id,
    to_account_id: values.to_account_id,
    merchant: values.merchant,
    notes: values.notes,
    payment_method: (values.payment_method || null) as PaymentMethod | null,
  };
}

/** Broker wallets may only move money via transfers. */
async function assertSpendAccountAllowed(
  supabase: SupabaseClient,
  userId: string,
  type: TransactionType,
  accountId: string | null
): Promise<string | null> {
  if (!accountId) return null;
  if (type === "transfer") return null;

  const { data, error } = await supabase
    .from("accounts")
    .select("account_type")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return error.message;
  if (!data) return "Account not found";
  if (data.account_type === "broker_wallet") {
    return "Broker wallets are funded via Transfers from a bank account only";
  }
  return null;
}

export async function createTransaction(
  input: unknown
): Promise<TransactionActionResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = normalizeTransactionValues(parsed.data);

  const spendErr = await assertSpendAccountAllowed(
    supabase,
    user.id,
    values.type,
    values.account_id
  );
  if (spendErr) return { error: spendErr };

  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert(toRow(values, user.id))
      .select("id, type, amount, account_id, to_account_id")
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: "Failed to create transaction" };

    await applyBalanceEffect(supabase, {
      type: data.type as TransactionType,
      amount: Number(data.amount),
      account_id: data.account_id,
      to_account_id: data.to_account_id,
    });

    await syncTransactionTags(supabase, user.id, data.id, values.tags);

    revalidateTxPaths();
    return { success: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to create transaction",
    };
  }
}

export async function updateTransaction(
  id: string,
  input: unknown
): Promise<TransactionActionResult> {
  if (!id) return { error: "Transaction id is required" };

  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = normalizeTransactionValues(parsed.data);

  const spendErr = await assertSpendAccountAllowed(
    supabase,
    user.id,
    values.type,
    values.account_id
  );
  if (spendErr) return { error: spendErr };

  try {
    const { data: previous, error: fetchError } = await supabase
      .from("transactions")
      .select("id, type, amount, account_id, to_account_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) return { error: fetchError.message };
    if (!previous) return { error: "Transaction not found" };

    await applyBalanceEffect(
      supabase,
      {
        type: previous.type as TransactionType,
        amount: Number(previous.amount),
        account_id: previous.account_id,
        to_account_id: previous.to_account_id,
      },
      true
    );

    const { error: updateError } = await supabase
      .from("transactions")
      .update(toRow(values, user.id))
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      await applyBalanceEffect(supabase, {
        type: previous.type as TransactionType,
        amount: Number(previous.amount),
        account_id: previous.account_id,
        to_account_id: previous.to_account_id,
      });
      return { error: updateError.message };
    }

    await applyBalanceEffect(supabase, {
      type: values.type,
      amount: values.amount,
      account_id: values.account_id,
      to_account_id: values.to_account_id,
    });

    await syncTransactionTags(supabase, user.id, id, values.tags);

    revalidateTxPaths();
    return { success: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to update transaction",
    };
  }
}

export async function deleteTransaction(
  id: string
): Promise<TransactionActionResult> {
  if (!id) return { error: "Transaction id is required" };

  const { supabase, user } = await requireUser();

  try {
    const { data: previous, error: fetchError } = await supabase
      .from("transactions")
      .select("id, type, amount, account_id, to_account_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) return { error: fetchError.message };
    if (!previous) return { error: "Transaction not found" };

    await applyBalanceEffect(
      supabase,
      {
        type: previous.type as TransactionType,
        amount: Number(previous.amount),
        account_id: previous.account_id,
        to_account_id: previous.to_account_id,
      },
      true
    );

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      await applyBalanceEffect(supabase, {
        type: previous.type as TransactionType,
        amount: Number(previous.amount),
        account_id: previous.account_id,
        to_account_id: previous.to_account_id,
      });
      return { error: error.message };
    }

    revalidateTxPaths();
    return { success: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to delete transaction",
    };
  }
}
