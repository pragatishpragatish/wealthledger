"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { calculateEMI } from "@/lib/calculations/loan";
import {
  convertToEmiSchema,
  creditCardPaymentSchema,
  creditCardSchema,
  recordEmiPaymentSchema,
} from "@/features/credit-cards/schemas";

export type CreditCardActionResult = {
  error?: string;
  success?: boolean;
};

function revalidateCardPaths(cardId?: string) {
  revalidatePath("/credit-cards");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/");
  if (cardId) revalidatePath(`/credit-cards/${cardId}`);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function adjustAccountBalance(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  delta: number
): Promise<string | null> {
  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, current_balance")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return error.message;
  if (!account) return "Account not found";

  const next = round2(Number(account.current_balance) + delta);
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ current_balance: next })
    .eq("id", accountId)
    .eq("user_id", userId);

  return updateError?.message ?? null;
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

  revalidateCardPaths(id);
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

  revalidateCardPaths(id);
  return { success: true };
}

/** Pay credit card from a bank/wallet account. */
export async function payCreditCard(
  cardId: string,
  input: unknown
): Promise<CreditCardActionResult> {
  if (!cardId) return { error: "Card id is required" };

  const parsed = creditCardPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const amount = round2(values.amount);

  const { data: card, error: cardError } = await supabase
    .from("credit_cards")
    .select(
      "id, bank, card_name, outstanding, statement_amount, paid_amount, minimum_due"
    )
    .eq("id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (cardError) return { error: cardError.message };
  if (!card) return { error: "Credit card not found" };

  const outstanding = Number(card.outstanding);
  if (amount > outstanding + 0.001) {
    return { error: "Payment cannot exceed outstanding balance" };
  }

  const accountErr = await adjustAccountBalance(
    supabase,
    user.id,
    values.account_id,
    -amount
  );
  if (accountErr) return { error: accountErr };

  const nextOutstanding = round2(Math.max(0, outstanding - amount));
  const statement = Number(card.statement_amount);
  const paidTowardStatement = Math.min(amount, Math.max(0, statement));
  const nextStatement = round2(Math.max(0, statement - paidTowardStatement));
  const nextPaid = round2(Number(card.paid_amount) + paidTowardStatement);
  const nextMinDue =
    nextStatement <= 0
      ? 0
      : Math.min(Number(card.minimum_due), nextStatement);

  const { error: updateError } = await supabase
    .from("credit_cards")
    .update({
      outstanding: nextOutstanding,
      statement_amount: nextStatement,
      paid_amount: nextStatement <= 0 ? 0 : nextPaid,
      minimum_due: nextMinDue,
    })
    .eq("id", cardId)
    .eq("user_id", user.id);

  if (updateError) return { error: updateError.message };

  const label = `${card.bank} ${card.card_name}`;
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "expense",
      date: values.date,
      amount,
      account_id: values.account_id,
      credit_card_id: null,
      merchant: `CC payment · ${label}`,
      notes:
        values.notes ??
        `Payment toward ${label} (liability payoff, not a new purchase)`,
      payment_method: "netbanking",
    })
    .select("id")
    .single();

  if (txError) return { error: txError.message };

  const { error: ccTxError } = await supabase
    .from("credit_card_transactions")
    .insert({
      user_id: user.id,
      credit_card_id: cardId,
      transaction_id: tx.id,
      date: values.date,
      amount,
      description: values.notes ?? `Payment from account`,
      merchant: `Payment · ${label}`,
      is_payment: true,
      converted_to_emi: false,
    });

  if (ccTxError) return { error: ccTxError.message };

  revalidateCardPaths(cardId);
  return { success: true };
}

/** Roll current outstanding into a statement (billing day helper). */
export async function generateCreditCardStatement(
  cardId: string
): Promise<CreditCardActionResult> {
  if (!cardId) return { error: "Card id is required" };

  const { supabase, user } = await requireUser();

  const { data: card, error } = await supabase
    .from("credit_cards")
    .select("id, outstanding, minimum_due")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!card) return { error: "Credit card not found" };

  const outstanding = Number(card.outstanding);
  if (outstanding <= 0) {
    return { error: "Nothing to bill — outstanding is zero" };
  }

  const minDue = Math.max(
    100,
    round2(Math.min(outstanding, Math.max(outstanding * 0.05, 0)))
  );

  const { error: updateError } = await supabase
    .from("credit_cards")
    .update({
      statement_amount: outstanding,
      minimum_due: Math.min(Number(card.minimum_due) || minDue, outstanding) || minDue,
      paid_amount: 0,
    })
    .eq("id", cardId)
    .eq("user_id", user.id);

  if (updateError) return { error: updateError.message };

  revalidateCardPaths(cardId);
  return { success: true };
}

/** Convert a purchase (or custom amount) into an EMI plan. */
export async function convertPurchaseToEmi(
  cardId: string,
  input: unknown
): Promise<CreditCardActionResult> {
  if (!cardId) return { error: "Card id is required" };

  const parsed = convertToEmiSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const principal = round2(values.principal);
  const fee = round2(values.processing_fee);
  const emiAmount = calculateEMI(
    principal,
    values.interest_rate,
    values.tenure_months
  );

  if (emiAmount <= 0) return { error: "Could not compute EMI" };

  const { data: card, error: cardError } = await supabase
    .from("credit_cards")
    .select("id, outstanding, credit_limit")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (cardError) return { error: cardError.message };
  if (!card) return { error: "Credit card not found" };

  if (principal > Number(card.outstanding) + 0.001) {
    return { error: "EMI principal cannot exceed card outstanding" };
  }

  if (values.source_transaction_id) {
    const { data: src, error: srcError } = await supabase
      .from("credit_card_transactions")
      .select("id, amount, is_payment, converted_to_emi, credit_card_id")
      .eq("id", values.source_transaction_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (srcError) return { error: srcError.message };
    if (!src || src.credit_card_id !== cardId) {
      return { error: "Purchase not found on this card" };
    }
    if (src.is_payment) return { error: "Payments cannot be converted to EMI" };
    if (src.converted_to_emi) {
      return { error: "This purchase is already on EMI" };
    }
  }

  const nextOutstanding = round2(Number(card.outstanding) + fee);
  if (nextOutstanding > Number(card.credit_limit) + 0.001) {
    return { error: "Processing fee would exceed credit limit" };
  }

  const { data: emi, error: emiError } = await supabase
    .from("credit_card_emis")
    .insert({
      user_id: user.id,
      credit_card_id: cardId,
      source_transaction_id: values.source_transaction_id,
      description: values.description,
      principal,
      interest_rate: values.interest_rate,
      tenure_months: values.tenure_months,
      emi_amount: emiAmount,
      start_date: values.start_date,
      emis_paid: 0,
      outstanding_principal: principal,
      processing_fee: fee,
      is_active: true,
    })
    .select("id")
    .single();

  if (emiError) return { error: emiError.message };

  if (values.source_transaction_id) {
    await supabase
      .from("credit_card_transactions")
      .update({ converted_to_emi: true })
      .eq("id", values.source_transaction_id)
      .eq("user_id", user.id);
  }

  if (fee > 0) {
    const { error: feeOutError } = await supabase
      .from("credit_cards")
      .update({ outstanding: nextOutstanding })
      .eq("id", cardId)
      .eq("user_id", user.id);
    if (feeOutError) return { error: feeOutError.message };

    await supabase.from("credit_card_transactions").insert({
      user_id: user.id,
      credit_card_id: cardId,
      date: values.start_date,
      amount: fee,
      description: `EMI processing fee · ${values.description}`,
      merchant: "EMI fee",
      is_payment: false,
      converted_to_emi: false,
    });
  }

  void emi;
  revalidateCardPaths(cardId);
  return { success: true };
}

/** Record one EMI installment paid from an account. */
export async function recordCreditCardEmiPayment(
  cardId: string,
  input: unknown
): Promise<CreditCardActionResult> {
  if (!cardId) return { error: "Card id is required" };

  const parsed = recordEmiPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  const { data: emi, error: emiError } = await supabase
    .from("credit_card_emis")
    .select("*")
    .eq("id", values.emi_id)
    .eq("credit_card_id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (emiError) return { error: emiError.message };
  if (!emi) return { error: "EMI plan not found" };
  if (!emi.is_active) return { error: "EMI plan is already closed" };
  if (Number(emi.emis_paid) >= Number(emi.tenure_months)) {
    return { error: "All EMIs already paid" };
  }

  const { data: card, error: cardError } = await supabase
    .from("credit_cards")
    .select("id, bank, card_name, outstanding, statement_amount, paid_amount, minimum_due")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (cardError) return { error: cardError.message };
  if (!card) return { error: "Credit card not found" };

  const payment = round2(Number(emi.emi_amount));
  const outstandingPrincipal = Number(emi.outstanding_principal);
  const remainingEmis =
    Number(emi.tenure_months) - Number(emi.emis_paid);
  const r = Number(emi.interest_rate) / 12 / 100;
  const interestPart =
    r > 0 ? round2(outstandingPrincipal * r) : 0;
  let principalPart = round2(payment - interestPart);
  if (principalPart > outstandingPrincipal) principalPart = outstandingPrincipal;
  if (remainingEmis <= 1) principalPart = outstandingPrincipal;

  const payAmount = round2(principalPart + interestPart);

  const accountErr = await adjustAccountBalance(
    supabase,
    user.id,
    values.account_id,
    -payAmount
  );
  if (accountErr) return { error: accountErr };

  const cardOutstanding = Number(card.outstanding);
  const reduceBy = Math.min(payAmount, cardOutstanding);
  const nextCardOutstanding = round2(cardOutstanding - reduceBy);
  const statement = Number(card.statement_amount);
  const paidTowardStatement = Math.min(reduceBy, Math.max(0, statement));
  const nextStatement = round2(Math.max(0, statement - paidTowardStatement));

  const { error: cardUpdateError } = await supabase
    .from("credit_cards")
    .update({
      outstanding: nextCardOutstanding,
      statement_amount: nextStatement,
      paid_amount:
        nextStatement <= 0
          ? 0
          : round2(Number(card.paid_amount) + paidTowardStatement),
      minimum_due:
        nextStatement <= 0
          ? 0
          : Math.min(Number(card.minimum_due), nextStatement),
    })
    .eq("id", cardId)
    .eq("user_id", user.id);

  if (cardUpdateError) return { error: cardUpdateError.message };

  const nextEmiOutstanding = round2(
    Math.max(0, outstandingPrincipal - principalPart)
  );
  const nextEmisPaid = Number(emi.emis_paid) + 1;
  const closed =
    nextEmiOutstanding <= 0.01 || nextEmisPaid >= Number(emi.tenure_months);

  const { error: emiUpdateError } = await supabase
    .from("credit_card_emis")
    .update({
      emis_paid: nextEmisPaid,
      outstanding_principal: closed ? 0 : nextEmiOutstanding,
      is_active: !closed,
    })
    .eq("id", emi.id)
    .eq("user_id", user.id);

  if (emiUpdateError) return { error: emiUpdateError.message };

  const label = `${card.bank} ${card.card_name}`;
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: "expense",
      date: values.date,
      amount: payAmount,
      account_id: values.account_id,
      merchant: `CC EMI · ${emi.description}`,
      notes:
        values.notes ??
        `EMI ${nextEmisPaid}/${emi.tenure_months} on ${label}`,
      payment_method: "auto_debit",
    })
    .select("id")
    .single();

  if (txError) return { error: txError.message };

  await supabase.from("credit_card_transactions").insert({
    user_id: user.id,
    credit_card_id: cardId,
    transaction_id: tx.id,
    date: values.date,
    amount: payAmount,
    description: `EMI ${nextEmisPaid}/${emi.tenure_months} · ${emi.description}`,
    merchant: `EMI payment`,
    is_payment: true,
    converted_to_emi: false,
  });

  revalidateCardPaths(cardId);
  return { success: true };
}
