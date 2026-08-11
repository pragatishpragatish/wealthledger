"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { accountSchema } from "@/features/accounts/schemas";
import { emptyToNull } from "@/lib/validations/common";

export type AccountActionResult = {
  error?: string;
  success?: boolean;
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

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: values.name,
    bank_name: values.bank_name,
    account_number: emptyToNull(values.account_number),
    ifsc: emptyToNull(values.ifsc)?.toUpperCase() ?? null,
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
      ifsc: emptyToNull(values.ifsc)?.toUpperCase() ?? null,
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
