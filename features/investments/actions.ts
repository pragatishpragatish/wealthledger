"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  contributionSchema,
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
    purchase_date: values.purchase_date,
    units: values.units,
    buy_price: values.buy_price,
    current_price: values.current_price,
    invested_amount: amounts.invested_amount,
    current_value: amounts.current_value,
    maturity_date: values.maturity_date,
    interest_rate: values.interest_rate,
    notes: values.notes ?? null,
    is_active: values.is_active,
  };
}

async function insertBuyLog(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  investmentId: string,
  opts: {
    date: string;
    amount: number;
    units?: number;
    price?: number;
    notes?: string | null;
  }
) {
  await supabase.from("investment_transactions").insert({
    user_id: userId,
    investment_id: investmentId,
    date: opts.date,
    type: "buy",
    units: opts.units ?? 0,
    price: opts.price ?? 0,
    amount: opts.amount,
    notes: opts.notes ?? null,
  });
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

  const { data, error } = await supabase
    .from("investments")
    .insert(row)
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (data?.id && amounts.invested_amount > 0) {
    await insertBuyLog(supabase, user.id, data.id, {
      date:
        values.purchase_date ?? new Date().toISOString().slice(0, 10),
      amount: amounts.invested_amount,
      units: values.units || 0,
      price: values.buy_price || values.current_price || 0,
      notes: "Initial investment",
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

  const { error } = await supabase
    .from("investments")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateInvestmentPaths();
  return { success: true };
}

/**
 * Add another purchase into an existing fund/holding and log the dated entry.
 */
export async function addInvestmentContribution(
  investmentId: string,
  input: unknown
): Promise<InvestmentActionResult> {
  if (!investmentId) return { error: "Investment id is required" };

  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  const { data: inv, error: fetchError } = await supabase
    .from("investments")
    .select(
      "id, invested_amount, current_value, units, buy_price, current_price"
    )
    .eq("id", investmentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!inv) return { error: "Investment not found" };

  const amount = Number(values.amount);
  let addUnits = Number(values.units) || 0;
  let price = Number(values.price) || 0;

  if (addUnits <= 0 && price > 0) {
    addUnits = Math.round((amount / price) * 1e6) / 1e6;
  }
  if (price <= 0 && addUnits > 0) {
    price = Math.round((amount / addUnits) * 10000) / 10000;
  }

  const prevInvested = Number(inv.invested_amount) || 0;
  const prevValue = Number(inv.current_value) || 0;
  const prevUnits = Number(inv.units) || 0;

  const newInvested = Math.round((prevInvested + amount) * 100) / 100;
  const newUnits = Math.round((prevUnits + addUnits) * 1e6) / 1e6;
  // Assume purchase near market: bump current value by the contributed amount
  // unless a price was given with units (then mark-to-market at that price).
  const newValue =
    addUnits > 0 && price > 0
      ? Math.round((prevValue + addUnits * price) * 100) / 100
      : Math.round((prevValue + amount) * 100) / 100;
  const newBuyPrice =
    newUnits > 0
      ? Math.round((newInvested / newUnits) * 10000) / 10000
      : Number(inv.buy_price) || 0;
  const newCurrentPrice =
    price > 0 ? price : Number(inv.current_price) || 0;

  const { error: txError } = await supabase
    .from("investment_transactions")
    .insert({
      user_id: user.id,
      investment_id: investmentId,
      date: values.date,
      type: "buy",
      units: addUnits,
      price,
      amount,
      notes: values.notes ?? "Additional investment",
    });

  if (txError) return { error: txError.message };

  const { error: updateError } = await supabase
    .from("investments")
    .update({
      invested_amount: newInvested,
      current_value: newValue,
      units: newUnits,
      buy_price: newBuyPrice,
      current_price: newCurrentPrice,
    })
    .eq("id", investmentId)
    .eq("user_id", user.id);

  if (updateError) return { error: updateError.message };

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
