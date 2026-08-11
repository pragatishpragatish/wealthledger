"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { loanSchema, simulationSchema } from "@/features/loans/schemas";

export type LoanActionResult = {
  error?: string;
  success?: boolean;
  id?: string;
};

function revalidateLoanPaths(id?: string) {
  revalidatePath("/loans");
  revalidatePath("/");
  if (id) revalidatePath(`/loans/${id}`);
}

export async function createLoan(input: unknown): Promise<LoanActionResult> {
  const parsed = loanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;
  const outstanding = values.outstanding_principal ?? values.principal;

  const { data, error } = await supabase
    .from("loans")
    .insert({
      user_id: user.id,
      name: values.name,
      bank: values.bank,
      loan_type: values.loan_type,
      principal: values.principal,
      interest_rate: values.interest_rate,
      interest_type: values.interest_type,
      input_mode: values.input_mode,
      tenure_months: values.tenure_months,
      emi: values.emi,
      start_date: values.start_date,
      processing_fee: values.processing_fee,
      insurance_fee: values.insurance_fee,
      prepayment_charges: values.prepayment_charges,
      outstanding_principal: outstanding,
      principal_paid: values.principal_paid,
      interest_paid: values.interest_paid,
      emis_paid: values.emis_paid,
      account_id: values.account_id,
      notes: values.notes ?? null,
      is_active: values.is_active,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidateLoanPaths(data.id);
  return { success: true, id: data.id };
}

export async function updateLoan(
  id: string,
  input: unknown
): Promise<LoanActionResult> {
  if (!id) return { error: "Loan id is required" };

  const parsed = loanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  const { data: existing, error: fetchError } = await supabase
    .from("loans")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Loan not found" };

  const outstanding = values.outstanding_principal ?? values.principal;

  const { error } = await supabase
    .from("loans")
    .update({
      name: values.name,
      bank: values.bank,
      loan_type: values.loan_type,
      principal: values.principal,
      interest_rate: values.interest_rate,
      interest_type: values.interest_type,
      input_mode: values.input_mode,
      tenure_months: values.tenure_months,
      emi: values.emi,
      start_date: values.start_date,
      processing_fee: values.processing_fee,
      insurance_fee: values.insurance_fee,
      prepayment_charges: values.prepayment_charges,
      outstanding_principal: outstanding,
      principal_paid: values.principal_paid,
      interest_paid: values.interest_paid,
      emis_paid: values.emis_paid,
      account_id: values.account_id,
      notes: values.notes ?? null,
      is_active: values.is_active,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateLoanPaths(id);
  return { success: true, id };
}

export async function deleteLoan(
  id: string,
  opts?: { hard?: boolean }
): Promise<LoanActionResult> {
  if (!id) return { error: "Loan id is required" };

  const { supabase, user } = await requireUser();

  if (opts?.hard) {
    const { error } = await supabase
      .from("loans")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("loans")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };
  }

  revalidateLoanPaths(id);
  return { success: true, id };
}

export async function saveLoanSimulation(
  loanId: string,
  input: unknown
): Promise<LoanActionResult> {
  if (!loanId) return { error: "Loan id is required" };

  const parsed = simulationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  const values = parsed.data;

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select(
      "id, emi, tenure_months, emis_paid, outstanding_principal, prepayment_charges"
    )
    .eq("id", loanId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loanError) return { error: loanError.message };
  if (!loan) return { error: "Loan not found" };

  const { data: sim, error } = await supabase
    .from("loan_simulations")
    .insert({
      user_id: user.id,
      loan_id: loanId,
      name: values.name,
      strategy: values.strategy,
      one_time_amount: values.one_time_amount,
      one_time_date: values.one_time_date,
      recurring_extra_emi: values.recurring_extra_emi,
      increased_emi: values.increased_emi,
      annual_lump_sum: values.annual_lump_sum,
      original_emi: values.original_emi,
      new_emi: values.new_emi,
      original_tenure: values.original_tenure,
      new_tenure: values.new_tenure,
      interest_saved: values.interest_saved,
      months_saved: values.months_saved,
      total_savings: values.total_savings,
      schedule_json: values.schedule_json ?? null,
      is_applied: values.apply_to_loan,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (values.apply_to_loan) {
    const chargePct = Number(loan.prepayment_charges) || 0;
    const oneTime = Number(values.one_time_amount) || 0;
    const netOneTime = Math.max(
      0,
      Math.round((oneTime - oneTime * (chargePct / 100)) * 100) / 100
    );
    const currentOutstanding = Number(loan.outstanding_principal);
    const nextOutstanding = Math.max(
      0,
      Math.round((currentOutstanding - netOneTime) * 100) / 100
    );
    const nextTenure = Math.max(
      Number(loan.emis_paid) + values.new_tenure,
      values.new_tenure
    );

    const { error: applyError } = await supabase
      .from("loans")
      .update({
        emi: values.new_emi,
        tenure_months: nextTenure,
        outstanding_principal: nextOutstanding,
      })
      .eq("id", loanId)
      .eq("user_id", user.id);

    if (applyError) return { error: applyError.message };
  }

  revalidateLoanPaths(loanId);
  return { success: true, id: sim.id };
}

export async function deleteLoanSimulation(
  id: string,
  loanId: string
): Promise<LoanActionResult> {
  if (!id) return { error: "Simulation id is required" };

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("loan_simulations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidateLoanPaths(loanId);
  return { success: true };
}
