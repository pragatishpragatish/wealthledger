import {
  calculateEMI,
  calculateTenure,
  generateAmortizationSchedule,
  scheduleTotals,
  type AmortizationRow,
} from "@/lib/calculations/loan";
import type { InterestType } from "@/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Flat interest: total interest = P × r × years; EMI = (P+I)/n */
export function calculateFlatEMI(
  principal: number,
  annualRate: number,
  tenureMonths: number
): number {
  if (tenureMonths <= 0) return 0;
  const years = tenureMonths / 12;
  const totalInterest = principal * (annualRate / 100) * years;
  return round2((principal + totalInterest) / tenureMonths);
}

/** Flat tenure from principal, rate, EMI */
export function calculateFlatTenure(
  principal: number,
  annualRate: number,
  emi: number
): number {
  if (emi <= 0 || principal <= 0) return 0;
  const monthlyInterestComponent = (principal * (annualRate / 100)) / 12;
  if (emi <= monthlyInterestComponent) return Infinity;
  return Math.ceil(principal / (emi - monthlyInterestComponent));
}

export function resolveEmi(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  interestType: InterestType
): number {
  if (interestType === "flat") {
    return calculateFlatEMI(principal, annualRate, tenureMonths);
  }
  return calculateEMI(principal, annualRate, tenureMonths);
}

export function resolveTenure(
  principal: number,
  annualRate: number,
  emi: number,
  interestType: InterestType
): number {
  if (interestType === "flat") {
    return calculateFlatTenure(principal, annualRate, emi);
  }
  return calculateTenure(principal, annualRate, emi);
}

export function generateLoanSchedule(opts: {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  emi?: number;
  startDate: Date;
  interestType: InterestType;
  emisPaid?: number;
}): AmortizationRow[] {
  if (opts.interestType === "flat") {
    return generateFlatSchedule(opts);
  }

  const full = generateAmortizationSchedule({
    principal: opts.principal,
    annualRate: opts.annualRate,
    tenureMonths: opts.tenureMonths,
    emi: opts.emi,
    startDate: opts.startDate,
  });

  const paid = opts.emisPaid ?? 0;
  if (paid <= 0) return full;
  return full.slice(paid).map((row, i) => ({
    ...row,
    emiNumber: i + 1,
  }));
}

function generateFlatSchedule(opts: {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  emi?: number;
  startDate: Date;
  emisPaid?: number;
}): AmortizationRow[] {
  const years = opts.tenureMonths / 12;
  const totalInterest = opts.principal * (opts.annualRate / 100) * years;
  const monthlyPrincipal = round2(opts.principal / opts.tenureMonths);
  const monthlyInterest = round2(totalInterest / opts.tenureMonths);
  const emi =
    opts.emi ?? round2(monthlyPrincipal + monthlyInterest);

  let balance = opts.principal;
  const rows: AmortizationRow[] = [];
  const startPaid = opts.emisPaid ?? 0;

  for (let i = 1; i <= opts.tenureMonths && balance > 0.01; i++) {
    const principalPart =
      i === opts.tenureMonths ? round2(balance) : Math.min(monthlyPrincipal, balance);
    const interest = monthlyInterest;
    const closing = round2(balance - principalPart);
    const paymentDate = new Date(opts.startDate);
    paymentDate.setMonth(paymentDate.getMonth() + i);

    rows.push({
      emiNumber: i,
      date: paymentDate.toISOString().slice(0, 10),
      openingBalance: round2(balance),
      principal: principalPart,
      interest,
      closingBalance: Math.max(0, closing),
      emi: round2(principalPart + interest) || emi,
    });
    balance = closing;
  }

  if (startPaid <= 0) return rows;
  return rows.slice(startPaid).map((row, i) => ({
    ...row,
    emiNumber: i + 1,
  }));
}

export function remainingTenureMonths(loan: {
  tenure_months: number;
  emis_paid: number;
}): number {
  return Math.max(0, loan.tenure_months - loan.emis_paid);
}

export { scheduleTotals };
