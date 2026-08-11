import {
  calculateEMI,
  generateAmortizationSchedule,
  scheduleTotals,
  type AmortizationRow,
} from "@/lib/calculations/loan";
import type { PrepaymentStrategy } from "@/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type PrepaymentSimInput = {
  outstanding: number;
  annualRate: number;
  originalEmi: number;
  remainingMonths: number;
  startDate: Date;
  strategy: PrepaymentStrategy;
  oneTimeAmount: number;
  oneTimeDate: string | null;
  recurringExtraEmi: number;
  increasedEmi: number | null;
  annualLumpSum: number;
  prepaymentChargePct?: number;
};

export type PrepaymentSimResult = {
  originalEmi: number;
  newEmi: number;
  originalTenure: number;
  newTenure: number;
  interestSaved: number;
  monthsSaved: number;
  totalSavings: number;
  originalTotalInterest: number;
  newTotalInterest: number;
  originalSchedule: AmortizationRow[];
  newSchedule: AmortizationRow[];
  comparisonChart: { label: string; original: number; simulated: number }[];
};

function monthIndexForDate(startDate: Date, target: string | null): number {
  if (!target) return 1;
  const t = new Date(target);
  const months =
    (t.getFullYear() - startDate.getFullYear()) * 12 +
    (t.getMonth() - startDate.getMonth());
  return Math.max(1, months + 1);
}

function netPrepay(amount: number, chargePct: number): number {
  if (amount <= 0) return 0;
  const charge = round2(amount * (chargePct / 100));
  return Math.max(0, round2(amount - charge));
}

/**
 * Simulate prepayment without mutating the loan.
 * reduce_tenure: keep EMI (or increased), finish earlier.
 * reduce_emi: after one-time, recalculate EMI for original remaining tenure.
 */
export function simulatePrepayment(
  input: PrepaymentSimInput
): PrepaymentSimResult {
  const {
    outstanding,
    annualRate,
    originalEmi,
    remainingMonths,
    startDate,
    strategy,
    oneTimeAmount,
    oneTimeDate,
    recurringExtraEmi,
    increasedEmi,
    annualLumpSum,
    prepaymentChargePct = 0,
  } = input;

  const originalSchedule = generateAmortizationSchedule({
    principal: outstanding,
    annualRate,
    tenureMonths: remainingMonths,
    emi: originalEmi,
    startDate,
  });
  const originalTotals = scheduleTotals(originalSchedule);
  const originalTenure = originalSchedule.length;

  const oneTimeMonth = monthIndexForDate(startDate, oneTimeDate);
  const oneTimeNet = netPrepay(oneTimeAmount, prepaymentChargePct);
  const annualNet = netPrepay(annualLumpSum, prepaymentChargePct);

  let workingEmi = originalEmi;
  let balance = outstanding;

  if (strategy === "reduce_emi" && oneTimeNet > 0 && oneTimeMonth <= 1) {
    balance = Math.max(0, round2(balance - oneTimeNet));
    workingEmi = calculateEMI(balance, annualRate, remainingMonths);
  } else if (increasedEmi != null && increasedEmi > 0) {
    workingEmi = increasedEmi;
  } else if (strategy === "reduce_emi" && oneTimeNet > 0) {
    // Will apply mid-schedule then recalculate EMI
    workingEmi = originalEmi;
  }

  if (strategy === "reduce_tenure" && increasedEmi != null && increasedEmi > 0) {
    workingEmi = increasedEmi;
  }

  const r = annualRate / 12 / 100;
  const newSchedule: AmortizationRow[] = [];
  let emiRecalculated = false;
  const maxMonths = Math.max(remainingMonths * 3, 600);
  let month = 1;

  while (balance > 0.01 && month <= maxMonths) {
    const interest = round2(balance * r);
    let payment = round2(workingEmi + Math.max(0, recurringExtraEmi));

    // Apply one-time mid-schedule
    if (oneTimeNet > 0 && month === oneTimeMonth) {
      if (!(strategy === "reduce_emi" && oneTimeMonth <= 1)) {
        balance = Math.max(0, round2(balance - oneTimeNet));
      }
      if (strategy === "reduce_emi" && !emiRecalculated && oneTimeMonth > 1) {
        const monthsLeft = Math.max(1, remainingMonths - month + 1);
        workingEmi = calculateEMI(balance, annualRate, monthsLeft);
        payment = round2(workingEmi + Math.max(0, recurringExtraEmi));
        emiRecalculated = true;
      }
    }

    // Annual lump sum on anniversary months (12, 24, ...)
    if (annualNet > 0 && month % 12 === 0) {
      balance = Math.max(0, round2(balance - annualNet));
    }

    if (balance <= 0.01) break;

    let principalPart = round2(payment - interest);
    if (principalPart < 0) principalPart = 0;
    if (principalPart > balance) {
      principalPart = balance;
      payment = round2(principalPart + interest);
    }

    const closing = round2(balance - principalPart);
    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + month);

    newSchedule.push({
      emiNumber: month,
      date: paymentDate.toISOString().slice(0, 10),
      openingBalance: round2(balance),
      principal: principalPart,
      interest,
      closingBalance: Math.max(0, closing),
      emi: payment,
    });

    balance = closing;
    month += 1;

    // For reduce_emi without early one-time: stick to original tenure window
    if (
      strategy === "reduce_emi" &&
      oneTimeNet <= 0 &&
      increasedEmi == null &&
      month > remainingMonths
    ) {
      break;
    }
  }

  const newTotals = scheduleTotals(newSchedule);
  const newTenure = newSchedule.length;
  const newEmi =
    newSchedule.length > 0
      ? round2(
          newSchedule[0].emi -
            Math.max(0, recurringExtraEmi) +
            (recurringExtraEmi > 0 ? 0 : 0)
        ) || workingEmi
      : workingEmi;

  // Prefer the working EMI after simulation adjustments
  const displayedNewEmi =
    increasedEmi != null && increasedEmi > 0
      ? increasedEmi
      : strategy === "reduce_emi"
        ? workingEmi
        : originalEmi;

  const interestSaved = round2(
    originalTotals.totalInterest - newTotals.totalInterest
  );
  const monthsSaved = Math.max(0, originalTenure - newTenure);
  const totalSavings = round2(Math.max(0, interestSaved));

  const chartLen = Math.max(originalSchedule.length, newSchedule.length);
  const step = Math.max(1, Math.floor(chartLen / 12));
  const comparisonChart: PrepaymentSimResult["comparisonChart"] = [];
  for (let i = 0; i < chartLen; i += step) {
    comparisonChart.push({
      label: `M${i + 1}`,
      original: originalSchedule[i]?.closingBalance ?? 0,
      simulated: newSchedule[i]?.closingBalance ?? 0,
    });
  }
  // Ensure last points
  if (originalSchedule.length > 0 || newSchedule.length > 0) {
    comparisonChart.push({
      label: "End",
      original:
        originalSchedule[originalSchedule.length - 1]?.closingBalance ?? 0,
      simulated: newSchedule[newSchedule.length - 1]?.closingBalance ?? 0,
    });
  }

  return {
    originalEmi,
    newEmi: displayedNewEmi || newEmi,
    originalTenure,
    newTenure,
    interestSaved,
    monthsSaved,
    totalSavings,
    originalTotalInterest: originalTotals.totalInterest,
    newTotalInterest: newTotals.totalInterest,
    originalSchedule,
    newSchedule,
    comparisonChart,
  };
}
