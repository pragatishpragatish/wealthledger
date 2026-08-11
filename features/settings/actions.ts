"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  notificationPrefsSchema,
  profileSchema,
  themeSchema,
} from "@/features/settings/schemas";

export type SettingsActionResult = {
  error?: string;
  success?: boolean;
  data?: unknown;
};

function revalidateSettings() {
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function updateProfile(
  input: unknown
): Promise<SettingsActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      avatar_url: parsed.data.avatar_url,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidateSettings();
  return { success: true };
}

export async function updateTheme(
  theme: unknown
): Promise<SettingsActionResult> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) {
    return { error: "Invalid theme" };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("settings")
    .update({ theme: parsed.data })
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateSettings();
  return { success: true };
}

export async function updateNotificationPrefs(
  input: unknown
): Promise<SettingsActionResult> {
  const parsed = notificationPrefsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const baseUpdate = {
    notify_emi: parsed.data.notify_emi,
    notify_credit_card: parsed.data.notify_credit_card,
    notify_budget: parsed.data.notify_budget,
    notify_large_expense: parsed.data.notify_large_expense,
    notify_investment_maturity: parsed.data.notify_investment_maturity,
    notify_goal_milestones: parsed.data.notify_goal_milestones,
    large_expense_threshold: parsed.data.large_expense_threshold,
  };

  let { error } = await supabase
    .from("settings")
    .update({
      ...baseUpdate,
      notify_investment_update: parsed.data.notify_investment_update,
    })
    .eq("user_id", user.id);

  // Column may be missing until migration 002 is applied
  if (error?.message?.includes("notify_investment_update")) {
    const retry = await supabase
      .from("settings")
      .update(baseUpdate)
      .eq("user_id", user.id);
    error = retry.error;
  }

  if (error) return { error: error.message };

  revalidateSettings();
  return { success: true };
}

export async function exportUserData(): Promise<SettingsActionResult> {
  const { supabase, user } = await requireUser();

  const tables = [
    "profiles",
    "settings",
    "accounts",
    "categories",
    "tags",
    "transactions",
    "credit_cards",
    "loans",
    "investments",
    "budgets",
    "goals",
    "net_worth_snapshots",
  ] as const;

  const payload: Record<string, unknown> = {
    version: 1,
    exported_at: new Date().toISOString(),
    user_id: user.id,
  };

  for (const table of tables) {
    if (table === "profiles") {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) return { error: error.message };
      payload.profile = data;
      continue;
    }
    if (table === "settings") {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return { error: error.message };
      payload.settings = data;
      continue;
    }

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    payload[table] = data ?? [];
  }

  return { success: true, data: payload };
}

type ImportPayload = {
  version?: number;
  accounts?: Record<string, unknown>[];
  categories?: Record<string, unknown>[];
  transactions?: Record<string, unknown>[];
  investments?: Record<string, unknown>[];
  loans?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
  credit_cards?: Record<string, unknown>[];
};

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item)
  );
}

export async function importUserData(
  raw: unknown
): Promise<SettingsActionResult> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { error: "Invalid JSON shape" };
  }

  const payload = raw as ImportPayload;
  const { supabase, user } = await requireUser();

  const accounts = asArray(payload.accounts);
  const categories = asArray(payload.categories);
  const transactions = asArray(payload.transactions);
  const investments = asArray(payload.investments);
  const loans = asArray(payload.loans);
  const goals = asArray(payload.goals);
  const creditCards = asArray(payload.credit_cards);

  if (
    accounts.length === 0 &&
    categories.length === 0 &&
    transactions.length === 0 &&
    investments.length === 0 &&
    loans.length === 0 &&
    goals.length === 0 &&
    creditCards.length === 0
  ) {
    return {
      error:
        "No importable data found. Expected accounts, categories, transactions, investments, loans, goals, or credit_cards.",
    };
  }

  let imported = 0;

  async function upsertRows(
    table: string,
    rows: Record<string, unknown>[],
    label: string
  ): Promise<string | null> {
    if (rows.length === 0) return null;
    const withIds = rows.filter((r) => typeof r.id === "string");
    const withoutIds = rows.filter((r) => typeof r.id !== "string");

    if (withIds.length > 0) {
      const { error } = await supabase.from(table).upsert(withIds, {
        onConflict: "id",
      });
      if (error) return `${label}: ${error.message}`;
    }
    if (withoutIds.length > 0) {
      const cleaned = withoutIds.map(({ id: _id, ...rest }) => rest);
      const { error } = await supabase.from(table).insert(cleaned);
      if (error) return `${label}: ${error.message}`;
    }
    return null;
  }

  if (categories.length > 0) {
    const rows = categories.map((c) => ({
      ...(typeof c.id === "string" ? { id: c.id } : {}),
      user_id: user.id,
      name: String(c.name ?? "Imported"),
      kind: c.kind === "income" ? "income" : "expense",
      icon: typeof c.icon === "string" ? c.icon : null,
      color: typeof c.color === "string" ? c.color : null,
      parent_id: typeof c.parent_id === "string" ? c.parent_id : null,
      is_system: Boolean(c.is_system),
      sort_order: Number(c.sort_order ?? 0),
    }));
    const err = await upsertRows("categories", rows, "Categories");
    if (err) return { error: err };
    imported += rows.length;
  }

  if (accounts.length > 0) {
    const rows = accounts.map((a) => ({
      ...(typeof a.id === "string" ? { id: a.id } : {}),
      user_id: user.id,
      name: String(a.name ?? "Imported account"),
      bank_name: String(a.bank_name ?? "Unknown"),
      account_number:
        typeof a.account_number === "string" ? a.account_number : null,
      ifsc: typeof a.ifsc === "string" ? a.ifsc : null,
      account_type:
        typeof a.account_type === "string" ? a.account_type : "savings",
      opening_balance: Number(a.opening_balance ?? 0),
      current_balance: Number(a.current_balance ?? a.opening_balance ?? 0),
      opening_date:
        typeof a.opening_date === "string"
          ? a.opening_date
          : new Date().toISOString().slice(0, 10),
      notes: typeof a.notes === "string" ? a.notes : null,
      is_active: a.is_active !== false,
    }));
    const err = await upsertRows("accounts", rows, "Accounts");
    if (err) return { error: err };
    imported += rows.length;
  }

  if (investments.length > 0) {
    const rows = investments.map((i) => ({
      ...(typeof i.id === "string" ? { id: i.id } : {}),
      user_id: user.id,
      name: String(i.name ?? "Imported investment"),
      type: typeof i.type === "string" ? i.type : "mutual_funds",
      platform: typeof i.platform === "string" ? i.platform : null,
      purchase_date:
        typeof i.purchase_date === "string" ? i.purchase_date : null,
      units: Number(i.units ?? 0),
      buy_price: Number(i.buy_price ?? 0),
      current_price: Number(i.current_price ?? 0),
      invested_amount: Number(i.invested_amount ?? 0),
      current_value: Number(i.current_value ?? 0),
      maturity_date:
        typeof i.maturity_date === "string" ? i.maturity_date : null,
      interest_rate:
        i.interest_rate == null ? null : Number(i.interest_rate),
      notes: typeof i.notes === "string" ? i.notes : null,
      is_active: i.is_active !== false,
    }));
    const err = await upsertRows("investments", rows, "Investments");
    if (err) return { error: err };
    imported += rows.length;
  }

  if (loans.length > 0) {
    const rows = loans.map((l) => ({
      ...(typeof l.id === "string" ? { id: l.id } : {}),
      user_id: user.id,
      name: String(l.name ?? "Imported loan"),
      bank: String(l.bank ?? "Unknown"),
      loan_type: typeof l.loan_type === "string" ? l.loan_type : "personal",
      principal: Number(l.principal ?? 0),
      interest_rate: Number(l.interest_rate ?? 0),
      interest_type: l.interest_type === "flat" ? "flat" : "reducing",
      input_mode: l.input_mode === "emi" ? "emi" : "tenure",
      tenure_months: Number(l.tenure_months ?? 0),
      emi: Number(l.emi ?? 0),
      start_date:
        typeof l.start_date === "string"
          ? l.start_date
          : new Date().toISOString().slice(0, 10),
      processing_fee: Number(l.processing_fee ?? 0),
      insurance_fee: Number(l.insurance_fee ?? 0),
      prepayment_charges: Number(l.prepayment_charges ?? 0),
      outstanding_principal: Number(
        l.outstanding_principal ?? l.principal ?? 0
      ),
      principal_paid: Number(l.principal_paid ?? 0),
      interest_paid: Number(l.interest_paid ?? 0),
      emis_paid: Number(l.emis_paid ?? 0),
      account_id: typeof l.account_id === "string" ? l.account_id : null,
      notes: typeof l.notes === "string" ? l.notes : null,
      is_active: l.is_active !== false,
    }));
    const err = await upsertRows("loans", rows, "Loans");
    if (err) return { error: err };
    imported += rows.length;
  }

  if (goals.length > 0) {
    const rows = goals.map((g) => ({
      ...(typeof g.id === "string" ? { id: g.id } : {}),
      user_id: user.id,
      name: String(g.name ?? "Imported goal"),
      type: typeof g.type === "string" ? g.type : "custom",
      target_amount: Number(g.target_amount ?? 0),
      current_amount: Number(g.current_amount ?? 0),
      monthly_contribution: Number(g.monthly_contribution ?? 0),
      target_date:
        typeof g.target_date === "string" ? g.target_date : null,
      account_id: typeof g.account_id === "string" ? g.account_id : null,
      icon: typeof g.icon === "string" ? g.icon : null,
      color: typeof g.color === "string" ? g.color : null,
      notes: typeof g.notes === "string" ? g.notes : null,
      is_completed: Boolean(g.is_completed),
      completed_at:
        typeof g.completed_at === "string" ? g.completed_at : null,
    }));
    const err = await upsertRows("goals", rows, "Goals");
    if (err) return { error: err };
    imported += rows.length;
  }

  if (creditCards.length > 0) {
    const rows = creditCards.map((c) => ({
      ...(typeof c.id === "string" ? { id: c.id } : {}),
      user_id: user.id,
      bank: String(c.bank ?? "Unknown"),
      card_name: String(c.card_name ?? "Card"),
      last_four: typeof c.last_four === "string" ? c.last_four : null,
      credit_limit: Number(c.credit_limit ?? 0),
      outstanding: Number(c.outstanding ?? 0),
      statement_amount: Number(c.statement_amount ?? 0),
      minimum_due: Number(c.minimum_due ?? 0),
      paid_amount: Number(c.paid_amount ?? 0),
      billing_date: Number(c.billing_date ?? 1),
      due_date: Number(c.due_date ?? 1),
      interest_rate: Number(c.interest_rate ?? 0),
      reward_type:
        typeof c.reward_type === "string" ? c.reward_type : "none",
      is_active: c.is_active !== false,
      notes: typeof c.notes === "string" ? c.notes : null,
    }));
    const err = await upsertRows("credit_cards", rows, "Credit cards");
    if (err) return { error: err };
    imported += rows.length;
  }

  if (transactions.length > 0) {
    const rows = transactions.map((t) => ({
      ...(typeof t.id === "string" ? { id: t.id } : {}),
      user_id: user.id,
      type: typeof t.type === "string" ? t.type : "expense",
      date:
        typeof t.date === "string"
          ? t.date
          : new Date().toISOString().slice(0, 10),
      amount: Number(t.amount ?? 0),
      category_id: typeof t.category_id === "string" ? t.category_id : null,
      account_id: typeof t.account_id === "string" ? t.account_id : null,
      to_account_id:
        typeof t.to_account_id === "string" ? t.to_account_id : null,
      merchant: typeof t.merchant === "string" ? t.merchant : null,
      notes: typeof t.notes === "string" ? t.notes : null,
      payment_method:
        typeof t.payment_method === "string" ? t.payment_method : null,
      is_recurring: Boolean(t.is_recurring),
      recurring_frequency:
        typeof t.recurring_frequency === "string"
          ? t.recurring_frequency
          : null,
      credit_card_id:
        typeof t.credit_card_id === "string" ? t.credit_card_id : null,
    }));
    const err = await upsertRows("transactions", rows, "Transactions");
    if (err) return { error: err };
    imported += rows.length;
  }

  revalidateSettings();
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/investments");
  revalidatePath("/loans");
  revalidatePath("/goals");
  revalidatePath("/credit-cards");

  return { success: true, data: { imported } };
}

const STORAGE_BUCKETS = [
  "receipts",
  "loan-documents",
  "investment-documents",
  "avatars",
] as const;

async function clearUserStorage(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string
) {
  for (const bucket of STORAGE_BUCKETS) {
    const { data: entries } = await supabase.storage.from(bucket).list(userId, {
      limit: 1000,
    });
    if (!entries?.length) continue;
    const paths = entries.map((entry) => `${userId}/${entry.name}`);
    await supabase.storage.from(bucket).remove(paths);
  }
}

/**
 * Permanently deletes the signed-in auth user and all cascaded finance data.
 * Requires migration 004 (`delete_own_account`). Confirmation must be exactly "DELETE".
 */
export async function deleteAccount(
  confirmation: string
): Promise<SettingsActionResult> {
  if (confirmation.trim() !== "DELETE") {
    return { error: 'Type DELETE in all caps to confirm account deletion.' };
  }

  const { supabase, user } = await requireUser();

  try {
    await clearUserStorage(supabase, user.id);
  } catch {
    // Storage cleanup is best-effort; DB wipe still proceeds.
  }

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    if (
      error.message.includes("delete_own_account") ||
      error.message.includes("Could not find the function") ||
      error.code === "PGRST202"
    ) {
      return {
        error:
          "Account deletion is not set up yet. Run supabase/migrations/004_delete_own_account.sql in the Supabase SQL Editor, then try again.",
      };
    }
    return { error: error.message };
  }

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
