import { requireUser } from "@/lib/auth";
import {
  getCreditCardCycle,
  getCreditCardDisplayDueDate,
  toDateString,
} from "@/utils/date";
import type {
  Account,
  CreditCard,
  CreditCardEmi,
  CreditCardTransaction,
} from "@/types";

export type CreditCardComputed = CreditCard & {
  available_credit: number;
  utilization: number;
  /** Payment due shown on the card (statement due if billed, else next cycle). */
  next_due_date: string;
  next_statement_date: string;
  /** Due date for the most recently generated statement. */
  statement_due_date: string;
  /** True when statement_amount > 0 (payment reminder applies). */
  has_payable_statement: boolean;
  /** Outstanding beyond the current statement (unbilled). */
  unbilled_amount: number;
};

export type CreditCardsSummary = {
  totalLimit: number;
  totalOutstanding: number;
  totalAvailable: number;
  avgUtilization: number;
  upcomingDue: CreditCardComputed[];
};

export type CreditCardsPageData = {
  cards: CreditCardComputed[];
  summary: CreditCardsSummary;
};

export type CreditCardDetailData = {
  card: CreditCardComputed;
  activity: CreditCardTransaction[];
  emis: CreditCardEmi[];
  accounts: Account[];
  /** Revolving balance still unpaid on the statement. */
  revolvingBalance: number;
  /** Estimated one-month interest if revolving balance is carried. */
  estimatedMonthlyInterest: number;
  totalEmiOutstanding: number;
  totalMonthlyEmi: number;
};

function computeCard(row: Record<string, unknown>): CreditCardComputed {
  const credit_limit = Number(row.credit_limit);
  const outstanding = Number(row.outstanding);
  const statement_amount = Number(row.statement_amount);
  const billing_date = Number(row.billing_date);
  const due_date = Number(row.due_date);
  const available_credit = Math.max(0, credit_limit - outstanding);
  const utilization =
    credit_limit > 0 ? (outstanding / credit_limit) * 100 : 0;

  const cycle = getCreditCardCycle(billing_date, due_date);
  const has_payable_statement = statement_amount > 0;
  const unbilled_amount = Math.max(0, outstanding - statement_amount);

  return {
    ...(row as unknown as CreditCard),
    credit_limit,
    outstanding,
    statement_amount,
    minimum_due: Number(row.minimum_due),
    paid_amount: Number(row.paid_amount),
    interest_rate: Number(row.interest_rate),
    billing_date,
    due_date,
    available_credit,
    utilization,
    next_statement_date: toDateString(cycle.nextStatementDate),
    statement_due_date: toDateString(cycle.currentStatementDueDate),
    next_due_date: toDateString(
      getCreditCardDisplayDueDate(billing_date, due_date, statement_amount)
    ),
    has_payable_statement,
    unbilled_amount,
  };
}

function mapCcTx(row: Record<string, unknown>): CreditCardTransaction {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    credit_card_id: row.credit_card_id as string,
    transaction_id: (row.transaction_id as string | null) ?? null,
    date: row.date as string,
    amount: Number(row.amount),
    description: (row.description as string | null) ?? null,
    merchant: (row.merchant as string | null) ?? null,
    category_id: (row.category_id as string | null) ?? null,
    is_payment: Boolean(row.is_payment),
    converted_to_emi: Boolean(row.converted_to_emi),
    created_at: row.created_at as string,
    category: (row.category as CreditCardTransaction["category"]) ?? null,
  };
}

function mapEmi(row: Record<string, unknown>): CreditCardEmi {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    credit_card_id: row.credit_card_id as string,
    source_transaction_id:
      (row.source_transaction_id as string | null) ?? null,
    description: row.description as string,
    principal: Number(row.principal),
    interest_rate: Number(row.interest_rate),
    tenure_months: Number(row.tenure_months),
    emi_amount: Number(row.emi_amount),
    start_date: row.start_date as string,
    emis_paid: Number(row.emis_paid),
    outstanding_principal: Number(row.outstanding_principal),
    processing_fee: Number(row.processing_fee),
    is_active: Boolean(row.is_active),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getCreditCards(opts?: {
  includeInactive?: boolean;
}): Promise<CreditCardComputed[]> {
  const { supabase, user } = await requireUser();

  let query = supabase
    .from("credit_cards")
    .select("*")
    .eq("user_id", user.id)
    .order("bank", { ascending: true })
    .order("card_name", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    computeCard(row as Record<string, unknown>)
  );
}

function buildSummary(cards: CreditCardComputed[]): CreditCardsSummary {
  const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0);
  const totalOutstanding = cards.reduce((s, c) => s + c.outstanding, 0);
  const totalAvailable = Math.max(0, totalLimit - totalOutstanding);
  const avgUtilization =
    totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;

  const upcomingDue = cards
    .filter((c) => c.has_payable_statement)
    .sort(
      (a, b) =>
        new Date(a.statement_due_date).getTime() -
        new Date(b.statement_due_date).getTime()
    );

  return {
    totalLimit,
    totalOutstanding,
    totalAvailable,
    avgUtilization,
    upcomingDue,
  };
}

export async function getCreditCardsSummary(): Promise<CreditCardsSummary> {
  return buildSummary(await getCreditCards());
}

export async function getCreditCardsPageData(): Promise<CreditCardsPageData> {
  const cards = await getCreditCards();
  return {
    cards,
    summary: buildSummary(cards),
  };
}

export async function getCreditCardById(
  id: string
): Promise<CreditCardDetailData | null> {
  const { supabase, user } = await requireUser();

  const { data: cardRow, error: cardError } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (cardError) throw new Error(cardError.message);
  if (!cardRow) return null;

  const card = computeCard(cardRow as Record<string, unknown>);

  const [activityRes, emisRes, accountsRes] = await Promise.all([
    supabase
      .from("credit_card_transactions")
      .select("*, category:categories(id, name, kind, color, icon)")
      .eq("credit_card_id", id)
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("credit_card_emis")
      .select("*")
      .eq("credit_card_id", id)
      .eq("user_id", user.id)
      .order("is_active", { ascending: false })
      .order("start_date", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("bank_name", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (activityRes.error) throw new Error(activityRes.error.message);
  if (accountsRes.error) throw new Error(accountsRes.error.message);
  // EMI table arrives with migration 008 — tolerate missing table until applied.
  if (
    emisRes.error &&
    !/does not exist|schema cache|could not find/i.test(emisRes.error.message)
  ) {
    throw new Error(emisRes.error.message);
  }

  const activity = (activityRes.data ?? []).map((row) =>
    mapCcTx(row as Record<string, unknown>)
  );
  const emis = emisRes.error
    ? []
    : (emisRes.data ?? []).map((row) =>
        mapEmi(row as Record<string, unknown>)
      );
  const accounts = (accountsRes.data ?? []).map((row) => ({
    ...(row as Account),
    opening_balance: Number((row as Account).opening_balance),
    current_balance: Number((row as Account).current_balance),
  }));

  const revolvingBalance = Math.max(
    0,
    card.statement_amount - card.paid_amount
  );
  const estimatedMonthlyInterest =
    revolvingBalance > 0 && card.interest_rate > 0
      ? Math.round(((revolvingBalance * card.interest_rate) / 12 / 100) * 100) /
        100
      : 0;

  const activeEmis = emis.filter((e) => e.is_active);
  const totalEmiOutstanding = activeEmis.reduce(
    (s, e) => s + e.outstanding_principal,
    0
  );
  const totalMonthlyEmi = activeEmis.reduce((s, e) => s + e.emi_amount, 0);

  return {
    card,
    activity,
    emis,
    accounts,
    revolvingBalance,
    estimatedMonthlyInterest,
    totalEmiOutstanding,
    totalMonthlyEmi,
  };
}
