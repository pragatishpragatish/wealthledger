"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import {
  contributionSchema,
  investmentSchema,
  resolveInvestmentAmounts,
  tradingPnlSchema,
} from "@/features/investments/schemas";
import { investmentFundingKind } from "@/features/investments/funding";
import { updateInvestmentPrices } from "@/lib/market-data/update-prices";
import type { InvestmentType } from "@/types";

export type InvestmentActionResult = {
  error?: string;
  success?: boolean;
  updated?: number;
  failed?: number;
  skipped?: number;
  message?: string;
};

function revalidateInvestmentPaths() {
  revalidatePath("/investments");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/");
  revalidatePath("/calendar");
}

function normalizeSymbol(
  type: InvestmentType,
  symbol: string | null | undefined
): string | null {
  const trimmed = symbol?.trim() ?? "";
  if (!trimmed) return null;
  if (type === "mutual_funds") return trimmed;
  return trimmed.toUpperCase();
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
    symbol: normalizeSymbol(values.type, values.symbol),
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
  supabase: SupabaseClient,
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

/**
 * Validate funding account matches investment type rules, then debit it.
 * Stocks/ETF → broker_wallet; MF/bonds/etc → bank/cash (not broker).
 */
async function debitFundingAccount(
  supabase: SupabaseClient,
  userId: string,
  opts: {
    accountId: string;
    amount: number;
    date: string;
    investmentType: InvestmentType;
    label: string;
    notes?: string | null;
  }
): Promise<string | null> {
  const kind = investmentFundingKind(opts.investmentType);
  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, name, bank_name, current_balance, account_type")
    .eq("id", opts.accountId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return error.message;
  if (!account) return "Funding account not found";

  const isBroker = account.account_type === "broker_wallet";
  if (kind === "broker" && !isBroker) {
    return "Stocks and ETFs must be paid from a stock broker wallet";
  }
  if (kind === "bank" && isBroker) {
    return "Mutual funds, bonds and deposits must be paid from a bank account (not a broker wallet)";
  }

  const balance = Number(account.current_balance);
  if (opts.amount > balance + 0.001) {
    return `Insufficient balance in ${account.name} (${account.bank_name})`;
  }

  const next = Math.round((balance - opts.amount) * 100) / 100;
  const { error: balError } = await supabase
    .from("accounts")
    .update({ current_balance: next })
    .eq("id", account.id)
    .eq("user_id", userId);
  if (balError) return balError.message;

  const categoryId = await findCategoryId(
    supabase,
    userId,
    "expense",
    "Investment"
  );

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: userId,
    type: "expense",
    date: opts.date,
    amount: opts.amount,
    account_id: account.id,
    category_id: categoryId,
    merchant: opts.label,
    notes:
      opts.notes ??
      `Investment purchase · ${isBroker ? "Broker wallet" : "Bank"} debit`,
    payment_method: isBroker ? "other" : "netbanking",
  });

  return txError?.message ?? null;
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
  const shouldDebit =
    values.debit_account !== false &&
    amounts.invested_amount > 0 &&
    Boolean(values.account_id);

  const { data, error } = await supabase
    .from("investments")
    .insert(row)
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (data?.id && amounts.invested_amount > 0) {
    await insertBuyLog(supabase, user.id, data.id, {
      date: values.purchase_date ?? new Date().toISOString().slice(0, 10),
      amount: amounts.invested_amount,
      units: values.units || 0,
      price: values.buy_price || values.current_price || 0,
      notes: "Initial investment",
    });
  }

  if (shouldDebit && values.account_id && data?.id) {
    const debitError = await debitFundingAccount(supabase, user.id, {
      accountId: values.account_id,
      amount: amounts.invested_amount,
      date: values.purchase_date ?? new Date().toISOString().slice(0, 10),
      investmentType: values.type,
      label: `Invest · ${values.name}`,
      notes: values.notes,
    });
    if (debitError) {
      // Roll back investment if funding fails
      await supabase.from("investments").delete().eq("id", data.id);
      return { error: debitError };
    }
  }

  revalidateInvestmentPaths();
  return { success: true };
}

export async function updateInvestment(
  id: string,
  input: unknown
): Promise<InvestmentActionResult> {
  if (!id) return { error: "Investment id is required" };

  const parsed = investmentSchema.safeParse({
    ...(typeof input === "object" && input != null ? input : {}),
    debit_account: false,
    account_id: null,
  });
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
      "id, name, type, invested_amount, current_value, units, buy_price, current_price"
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

  const shouldDebit = values.debit_account !== false && Boolean(values.account_id);
  if (shouldDebit && values.account_id) {
    const debitError = await debitFundingAccount(supabase, user.id, {
      accountId: values.account_id,
      amount,
      date: values.date,
      investmentType: inv.type as InvestmentType,
      label: `Invest · ${inv.name}`,
      notes: values.notes,
    });
    if (debitError) return { error: debitError };
  }

  const prevInvested = Number(inv.invested_amount) || 0;
  const prevValue = Number(inv.current_value) || 0;
  const prevUnits = Number(inv.units) || 0;

  const newInvested = Math.round((prevInvested + amount) * 100) / 100;
  const newUnits = Math.round((prevUnits + addUnits) * 1e6) / 1e6;
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

const ACTIVITY_LABEL: Record<"fno" | "intraday" | "other", string> = {
  fno: "F&O",
  intraday: "Intraday",
  other: "Trading",
};

/** Adjust a broker wallet for F&O / intraday profit or loss. */
export async function recordBrokerTradingPnl(
  input: unknown
): Promise<InvestmentActionResult> {
  const parsed = tradingPnlSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const amount = Math.round(Number(values.amount) * 100) / 100;
  const activity = ACTIVITY_LABEL[values.activity];

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
    return { error: "Select a stock broker wallet for trading P&L" };
  }

  const balance = Number(account.current_balance);
  const isProfit = values.result === "profit";
  const next = Math.round((balance + (isProfit ? amount : -amount)) * 100) / 100;
  if (next < -0.001) {
    return { error: "Loss exceeds broker wallet balance" };
  }

  const { error: balError } = await supabase
    .from("accounts")
    .update({ current_balance: Math.max(0, next) })
    .eq("id", account.id)
    .eq("user_id", user.id);
  if (balError) return { error: balError.message };

  if (isProfit) {
    const categoryId = await findCategoryId(
      supabase,
      user.id,
      "income",
      "Trading Returns"
    );
    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "income",
      date: values.date,
      amount,
      account_id: account.id,
      category_id: categoryId,
      merchant: `${activity} profit · ${account.bank_name}`,
      notes: values.notes ?? `${activity} trading profit`,
      payment_method: "other",
    });
    if (txError) return { error: txError.message };
  } else {
    const categoryId = await findCategoryId(
      supabase,
      user.id,
      "expense",
      "Investment"
    );
    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "expense",
      date: values.date,
      amount,
      account_id: account.id,
      category_id: categoryId,
      merchant: `${activity} loss · ${account.bank_name}`,
      notes: values.notes ?? `${activity} trading loss`,
      payment_method: "other",
    });
    if (txError) return { error: txError.message };
  }

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

/** Refresh market prices / NAVs for the signed-in user's holdings with symbols. */
export async function refreshInvestmentPrices(): Promise<InvestmentActionResult> {
  const { supabase, user } = await requireUser();

  try {
    const result = await updateInvestmentPrices(supabase, {
      userId: user.id,
    });
    revalidateInvestmentPaths();
    return {
      success: true,
      updated: result.updated,
      failed: result.failed,
      skipped: result.skipped,
      message: `Updated ${result.updated} · failed ${result.failed} · skipped ${result.skipped}`,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Price refresh failed",
    };
  }
}
