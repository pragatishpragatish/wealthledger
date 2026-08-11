"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  investmentSchema,
  resolveInvestmentAmounts,
} from "@/features/investments/schemas";

export type InvestmentActionResult = {
  error?: string;
  success?: boolean;
};

function revalidateInvestmentPaths() {
  revalidatePath("/investments");
  revalidatePath("/");
  revalidatePath("/calendar");
}

function toInvestmentRow(
  userId: string,
  values: ReturnType<typeof investmentSchema.parse>,
  amounts: ReturnType<typeof resolveInvestmentAmounts>
) {
  return {
    user_id: userId,
    name: values.name,
    type: values.type,
    platform: values.platform ?? null,
    purchase_date: values.purchase_date ?? values.sip_start_date,
    units: values.units,
    buy_price: values.buy_price,
    current_price: values.current_price,
    invested_amount: amounts.invested_amount,
    current_value: amounts.current_value,
    maturity_date: values.maturity_date,
    interest_rate: values.interest_rate,
    notes: values.notes ?? null,
    is_active: values.is_active,
    is_sip: values.is_sip,
    sip_amount: values.is_sip ? values.sip_amount : 0,
    sip_day: values.is_sip ? values.sip_day : null,
    sip_frequency: values.is_sip ? (values.sip_frequency ?? "monthly") : null,
    sip_start_date: values.is_sip ? values.sip_start_date : null,
  };
}

export async function createInvestment(
  input: unknown
): Promise<InvestmentActionResult> {
  const parsed = investmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const amounts = resolveInvestmentAmounts(values);
  const row = toInvestmentRow(user.id, values, amounts);

  let { data, error } = await supabase
    .from("investments")
    .insert(row)
    .select("id")
    .single();

  // Migration 003 may not be applied yet — retry without SIP columns
  if (error?.message?.includes("is_sip") || error?.message?.includes("sip_")) {
    const {
      is_sip: _a,
      sip_amount: _b,
      sip_day: _c,
      sip_frequency: _d,
      sip_start_date: _e,
      ...legacy
    } = row;
    const retry = await supabase
      .from("investments")
      .insert(legacy)
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { error: error.message };

  if (data?.id && values.is_sip && values.sip_amount > 0) {
    await supabase.from("investment_transactions").insert({
      user_id: user.id,
      investment_id: data.id,
      date: values.sip_start_date ?? values.purchase_date ?? new Date().toISOString().slice(0, 10),
      type: "sip",
      units: values.units || 0,
      price: values.current_price || values.buy_price || 0,
      amount: amounts.invested_amount || values.sip_amount,
      notes: `SIP ₹${values.sip_amount.toLocaleString("en-IN")}/mo`,
    });
  }

  revalidateInvestmentPaths();
  return { success: true };
}

export async function updateInvestment(
  id: string,
  input: unknown
): Promise<InvestmentActionResult> {
  if (!id) return { error: "Investment id is required" };

  const parsed = investmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const amounts = resolveInvestmentAmounts(values);

  const { data: existing, error: fetchError } = await supabase
    .from("investments")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Investment not found" };

  const row = toInvestmentRow(user.id, values, amounts);
  const { user_id: _uid, ...updatePayload } = row;

  let { error } = await supabase
    .from("investments")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error?.message?.includes("is_sip") || error?.message?.includes("sip_")) {
    const {
      is_sip: _a,
      sip_amount: _b,
      sip_day: _c,
      sip_frequency: _d,
      sip_start_date: _e,
      ...legacy
    } = updatePayload;
    const retry = await supabase
      .from("investments")
      .update(legacy)
      .eq("id", id)
      .eq("user_id", user.id);
    error = retry.error;
  }

  if (error) return { error: error.message };

  revalidateInvestmentPaths();
  return { success: true };
}

export async function deleteInvestment(
  id: string,
  opts?: { hard?: boolean }
): Promise<InvestmentActionResult> {
  if (!id) return { error: "Investment id is required" };

  const { supabase, user } = await requireUser();

  if (opts?.hard) {
    const { error } = await supabase
      .from("investments")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("investments")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
  }

  revalidateInvestmentPaths();
  return { success: true };
}
