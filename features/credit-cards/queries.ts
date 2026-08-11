import { requireUser } from "@/lib/auth";
import {
  getCreditCardCycle,
  getCreditCardDisplayDueDate,
  toDateString,
} from "@/utils/date";
import type { CreditCard } from "@/types";

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

  // Only cards with an open statement belong in payment-due lists.
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
