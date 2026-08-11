import { requireUser } from "@/lib/auth";
import { nextDueDate, toDateString } from "@/utils/date";
import type { CreditCard } from "@/types";

export type CreditCardComputed = CreditCard & {
  available_credit: number;
  utilization: number;
  next_due_date: string;
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
  const available_credit = Math.max(0, credit_limit - outstanding);
  const utilization =
    credit_limit > 0 ? (outstanding / credit_limit) * 100 : 0;

  return {
    ...(row as unknown as CreditCard),
    credit_limit,
    outstanding,
    statement_amount: Number(row.statement_amount),
    minimum_due: Number(row.minimum_due),
    paid_amount: Number(row.paid_amount),
    interest_rate: Number(row.interest_rate),
    billing_date: Number(row.billing_date),
    due_date: Number(row.due_date),
    available_credit,
    utilization,
    next_due_date: toDateString(nextDueDate(Number(row.due_date))),
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

export async function getCreditCardsSummary(): Promise<CreditCardsSummary> {
  const cards = await getCreditCards();
  const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0);
  const totalOutstanding = cards.reduce((s, c) => s + c.outstanding, 0);
  const totalAvailable = Math.max(0, totalLimit - totalOutstanding);
  const avgUtilization =
    totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;

  const upcomingDue = [...cards].sort(
    (a, b) =>
      new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime()
  );

  return {
    totalLimit,
    totalOutstanding,
    totalAvailable,
    avgUtilization,
    upcomingDue,
  };
}

export async function getCreditCardsPageData(): Promise<CreditCardsPageData> {
  const cards = await getCreditCards();
  const totalLimit = cards.reduce((s, c) => s + c.credit_limit, 0);
  const totalOutstanding = cards.reduce((s, c) => s + c.outstanding, 0);
  const totalAvailable = Math.max(0, totalLimit - totalOutstanding);
  const avgUtilization =
    totalLimit > 0 ? (totalOutstanding / totalLimit) * 100 : 0;

  const upcomingDue = [...cards].sort(
    (a, b) =>
      new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime()
  );

  return {
    cards,
    summary: {
      totalLimit,
      totalOutstanding,
      totalAvailable,
      avgUtilization,
      upcomingDue,
    },
  };
}
