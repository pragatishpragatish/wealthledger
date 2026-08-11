/**
 * Loan EMI & amortization helpers (reducing balance).
 * Used by Loans module and dashboard calculations.
 */

export type AmortizationRow = {
  emiNumber: number;
  date: string;
  openingBalance: number;
  principal: number;
  interest: number;
  closingBalance: number;
  emi: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** EMI from principal, annual rate %, tenure months */
export function calculateEMI(
  principal: number,
  annualRate: number,
  tenureMonths: number
): number {
  if (tenureMonths <= 0) return 0;
  if (annualRate === 0) return round2(principal / tenureMonths);
  const r = annualRate / 12 / 100;
  const emi =
    (principal * r * Math.pow(1 + r, tenureMonths)) /
    (Math.pow(1 + r, tenureMonths) - 1);
  return round2(emi);
}

/** Tenure months from principal, annual rate %, EMI */
export function calculateTenure(
  principal: number,
  annualRate: number,
  emi: number
): number {
  if (emi <= 0 || principal <= 0) return 0;
  if (annualRate === 0) return Math.ceil(principal / emi);
  const r = annualRate / 12 / 100;
  if (emi <= principal * r) return Infinity;
  const n = Math.log(emi / (emi - principal * r)) / Math.log(1 + r);
  return Math.ceil(n);
}

/** Approximate rate from principal, EMI, tenure (Newton-Raphson) */
export function calculateInterestRate(
  principal: number,
  emi: number,
  tenureMonths: number
): number {
  if (principal <= 0 || emi <= 0 || tenureMonths <= 0) return 0;
  let rate = 0.01;
  for (let i = 0; i < 50; i++) {
    const r = rate / 12;
    const pow = Math.pow(1 + r, tenureMonths);
    const f = (principal * r * pow) / (pow - 1) - emi;
    const f2 =
      (principal * (r + 0.00001) * Math.pow(1 + r + 0.00001, tenureMonths)) /
        (Math.pow(1 + r + 0.00001, tenureMonths) - 1) -
      emi;
    const deriv = (f2 - f) / 0.00001;
    if (Math.abs(deriv) < 1e-12) break;
    const next = rate - f / deriv;
    if (Math.abs(next - rate) < 1e-8) {
      rate = next;
      break;
    }
    rate = Math.max(0, next);
  }
  return round2(rate * 100 * 12);
}

/** Principal from EMI, annual rate %, tenure */
export function calculatePrincipal(
  emi: number,
  annualRate: number,
  tenureMonths: number
): number {
  if (tenureMonths <= 0 || emi <= 0) return 0;
  if (annualRate === 0) return round2(emi * tenureMonths);
  const r = annualRate / 12 / 100;
  const principal =
    (emi * (Math.pow(1 + r, tenureMonths) - 1)) /
    (r * Math.pow(1 + r, tenureMonths));
  return round2(principal);
}

export function generateAmortizationSchedule(opts: {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  emi?: number;
  startDate: Date;
}): AmortizationRow[] {
  const emi =
    opts.emi ??
    calculateEMI(opts.principal, opts.annualRate, opts.tenureMonths);
  const r = opts.annualRate / 12 / 100;
  let balance = opts.principal;
  const rows: AmortizationRow[] = [];

  for (let i = 1; i <= opts.tenureMonths && balance > 0.01; i++) {
    const interest = round2(balance * r);
    let principalPart = round2(emi - interest);
    if (principalPart > balance) principalPart = balance;
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
      emi: round2(principalPart + interest),
    });
    balance = closing;
  }

  return rows;
}

export function scheduleTotals(rows: AmortizationRow[]) {
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const totalPrincipal = rows.reduce((s, r) => s + r.principal, 0);
  const totalPayable = totalInterest + totalPrincipal;
  return {
    totalInterest: round2(totalInterest),
    totalPrincipal: round2(totalPrincipal),
    totalPayable: round2(totalPayable),
  };
}
