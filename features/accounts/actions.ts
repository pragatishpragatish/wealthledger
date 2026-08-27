"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { accountSchema } from "@/features/accounts/schemas";
import { INVESTMENT_PLATFORMS } from "@/lib/constants";
import { emptyToNull } from "@/lib/validations/common";
import { toDateString } from "@/utils/date";

export type AccountActionResult = {
  error?: string;
  success?: boolean;
  created?: number;
};

function revalidateAccountPaths() {
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/transactions");
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
