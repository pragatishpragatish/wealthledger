"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { creditCardSchema } from "@/features/credit-cards/schemas";

export type CreditCardActionResult = {
  error?: string;
  success?: boolean;
};

function revalidateCardPaths() {
  revalidatePath("/credit-cards");
  revalidatePath("/");
}

export async function createCreditCard(
  input: unknown
): Promise<CreditCardActionResult> {
  const parsed = creditCardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  if (values.outstanding > values.credit_limit) {
    return { error: "Outstanding cannot exceed credit limit" };
  }

  const { error } = await supabase.from("credit_cards").insert({
    user_id: user.id,
    bank: values.bank,
    card_name: values.card_name,
    last_four: values.last_four,
    credit_limit: values.credit_limit,
    outstanding: values.outstanding,
    statement_amount: values.statement_amount,
    minimum_due: values.minimum_due,
    paid_amount: values.paid_amount,
    billing_date: values.billing_date,
    due_date: values.due_date,
    interest_rate: values.interest_rate,
    reward_type: values.reward_type,
    notes: values.notes ?? null,
    is_active: values.is_active,
  });

  if (error) return { error: error.message };

  revalidateCardPaths();
  return { success: true };
}

export async function updateCreditCard(
  id: string,
  input: unknown
): Promise<CreditCardActionResult> {
  if (!id) return { error: "Card id is required" };

  const parsed = creditCardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  if (values.outstanding > values.credit_limit) {
    return { error: "Outstanding cannot exceed credit limit" };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("credit_cards")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Credit card not found" };

  const { error } = await supabase
    .from("credit_cards")
    .update({
      bank: values.bank,
      card_name: values.card_name,
      last_four: values.last_four,
      credit_limit: values.credit_limit,
      outstanding: values.outstanding,
      statement_amount: values.statement_amount,
      minimum_due: values.minimum_due,
      paid_amount: values.paid_amount,
      billing_date: values.billing_date,
      due_date: values.due_date,
      interest_rate: values.interest_rate,
      reward_type: values.reward_type,
      notes: values.notes ?? null,
      is_active: values.is_active,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateCardPaths();
  return { success: true };
}

export async function deleteCreditCard(
  id: string,
  opts?: { hard?: boolean }
): Promise<CreditCardActionResult> {
  if (!id) return { error: "Card id is required" };

  const { supabase, user } = await requireUser();

  if (opts?.hard) {
    const { error } = await supabase
      .from("credit_cards")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("credit_cards")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
  }

  revalidateCardPaths();
  return { success: true };
}
