"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import {
  accountSchema,
  brokerChargesSchema,
} from "@/features/accounts/schemas";
import { INVESTMENT_PLATFORMS } from "@/lib/constants";
import { emptyToNull } from "@/lib/validations/common";
import { toDateString } from "@/utils/date";

export type AccountActionResult = {
  error?: string;
  success?: boolean;
  created?: number;
};

const BROKERAGE_CATEGORY = "Brokerage & Charges";

function revalidateAccountPaths() {
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

async function findCategoryId(
  supabase: SupabaseClient,
  userId: string,
  kind: "income" | "expense",
  name: string
): Promise<string | null> {
  const { data } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("name", name)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createAccount(
  input: unknown
): Promise<AccountActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const currentBalance =
    values.current_balance !== undefined
      ? values.current_balance
      : values.opening_balance;
  const isBroker = values.account_type === "broker_wallet";

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: values.name,
    bank_name: values.bank_name,
    account_number: emptyToNull(values.account_number),
    ifsc: isBroker
      ? null
      : emptyToNull(values.ifsc)?.toUpperCase() ?? null,
    account_type: values.account_type,
    opening_balance: values.opening_balance,
    current_balance: currentBalance,
    opening_date: values.opening_date,
    notes: emptyToNull(values.notes),
    is_active: true,
  });

  if (error) return { error: error.message };

  revalidateAccountPaths();
  return { success: true };
}

export async function updateAccount(
  id: string,
  input: unknown
): Promise<AccountActionResult> {
  if (!id) return { error: "Account id is required" };

  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const isBroker = values.account_type === "broker_wallet";

  const { data: existing, error: fetchError } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Account not found" };

  const { error } = await supabase
    .from("accounts")
    .update({
      name: values.name,
      bank_name: values.bank_name,
      account_number: emptyToNull(values.account_number),
      ifsc: isBroker
        ? null
        : emptyToNull(values.ifsc)?.toUpperCase() ?? null,
      account_type: values.account_type,
      opening_balance: values.opening_balance,
      opening_date: values.opening_date,
      notes: emptyToNull(values.notes),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateAccountPaths();
  return { success: true };
}

/**
 * Create a broker wallet account for every known platform that the user
 * does not already have (by bank_name + broker_wallet type).
 */
export async function createMissingBrokerWallets(): Promise<AccountActionResult> {
  const { supabase, user } = await requireUser();

  const { data: existing, error: fetchError } = await supabase
    .from("accounts")
    .select("bank_name")
    .eq("user_id", user.id)
    .eq("account_type", "broker_wallet")
    .eq("is_active", true);

  if (fetchError) return { error: fetchError.message };

  const have = new Set(
    (existing ?? []).map((r) => String(r.bank_name).toLowerCase())
  );

  const platforms = INVESTMENT_PLATFORMS.filter((p) => p !== "Other");
  const missing = platforms.filter((p) => !have.has(p.toLowerCase()));

  if (missing.length === 0) {
    return { success: true, created: 0 };
  }

  const today = toDateString(new Date());
  const rows = missing.map((platform) => ({
    user_id: user.id,
    name: `${platform} Wallet`,
    bank_name: platform,
    account_number: null,
    ifsc: null,
    account_type: "broker_wallet" as const,
    opening_balance: 0,
    current_balance: 0,
    opening_date: today,
    notes: "Stock broker wallet balance",
    is_active: true,
  }));

  const { error } = await supabase.from("accounts").insert(rows);
  if (error) return { error: error.message };

  revalidateAccountPaths();
  return { success: true, created: rows.length };
}

/** Deduct lump-sum brokerage / demat charges from a broker wallet. */
export async function recordBrokerCharges(
  input: unknown
): Promise<AccountActionResult> {
  const parsed = brokerChargesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const amount = Math.round(Number(values.amount) * 100) / 100;

  const { data: account, error: accError } = await supabase
    .from("accounts")
    .select("id, name, bank_name, current_balance, account_type")
    .eq("id", values.account_id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (accError) return { error: accError.message };
  if (!account) return { error: "Broker wallet not found" };
  if (account.account_type !== "broker_wallet") {
    return { error: "Select a stock broker wallet for brokerage charges" };
  }

  const balance = Number(account.current_balance);
  if (amount > balance + 0.001) {
    return { error: "Charge exceeds broker wallet balance" };
  }

  const next = Math.round((balance - amount) * 100) / 100;
  const { error: balError } = await supabase
    .from("accounts")
    .update({ current_balance: Math.max(0, next) })
    .eq("id", account.id)
    .eq("user_id", user.id);
  if (balError) return { error: balError.message };

  const categoryId = await findCategoryId(
    supabase,
    user.id,
    "expense",
    BROKERAGE_CATEGORY
  );

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: "expense",
    date: values.date,
    amount,
    account_id: account.id,
    category_id: categoryId,
    merchant: `Brokerage & charges · ${account.bank_name}`,
    notes:
      values.notes ??
      `Brokerage and other charges · ${account.bank_name} wallet`,
    payment_method: "other",
  });
  if (txError) return { error: txError.message };

  revalidateAccountPaths();
  return { success: true };
}

/** Soft-delete: sets is_active = false. Pass hard=true to permanently remove. */
export async function deleteAccount(
  id: string,
  opts?: { hard?: boolean }
): Promise<AccountActionResult> {
  if (!id) return { error: "Account id is required" };

  const { supabase, user } = await requireUser();

  if (opts?.hard) {
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("accounts")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
  }

  revalidateAccountPaths();
  return { success: true };
}
