"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR, formatPercent } from "@/utils/currency";
import {
  calculateEMI,
  calculatePrincipal,
  scheduleTotals,
  generateAmortizationSchedule,
} from "@/lib/calculations/loan";
import {
  CalcField,
  CalcMoneyInput,
  CalcStat,
  parseAmount,
} from "@/features/calculators/calc-ui";
import { EmiCalculator } from "@/features/loans/emi-calculator";

/** Full EMI summary: payment, interest, total. */
export function LoanEmiSummaryCalculator() {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");

  const principalN = parseAmount(principal);
  const rateN = parseAmount(rate);
  const yearsN = parseAmount(years);
  const tenureMonths = Math.max(0, Math.round(yearsN * 12));

  const emi = useMemo(
    () => calculateEMI(principalN, rateN, tenureMonths),
    [principalN, rateN, tenureMonths]
  );

  const totals = useMemo(() => {
    if (tenureMonths <= 0 || principalN <= 0) {
      return { totalInterest: 0, totalPrincipal: 0, totalPayable: 0 };
    }
    const rows = generateAmortizationSchedule({
      principal: principalN,
      annualRate: rateN,
      tenureMonths,
      emi,
      startDate: new Date(),
    });
    return scheduleTotals(rows);
  }, [principalN, rateN, tenureMonths, emi]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcMoneyInput
          label="Loan amount (₹)"
          placeholder="e.g. 2500000"
          step={10000}
          value={principal}
          onChange={setPrincipal}
        />
        <CalcField label="Interest % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 8.5"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Tenure (years)">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 20"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CalcStat label="Monthly EMI" value={formatINR(emi)} accent="teal" />
        <CalcStat
          label="Total interest"
          value={formatINR(totals.totalInterest)}
        />
        <CalcStat
          label="Total payable"
          value={formatINR(totals.totalPayable)}
        />
        <CalcStat
          label="Interest share"
          value={
            totals.totalPayable > 0
              ? formatPercent(
                  (totals.totalInterest / totals.totalPayable) * 100,
                  1
                )
              : "0%"
          }
        />
      </div>
    </div>
  );
}

/** How much loan you can take for a given EMI budget. */
export function LoanAffordabilityCalculator() {
  const [emi, setEmi] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");

  const emiN = parseAmount(emi);
  const rateN = parseAmount(rate);
  const yearsN = parseAmount(years);
  const tenureMonths = Math.max(0, Math.round(yearsN * 12));

  const principal = useMemo(
    () => calculatePrincipal(emiN, rateN, tenureMonths),
    [emiN, rateN, tenureMonths]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcMoneyInput
          label="Affordable EMI (₹)"
          placeholder="e.g. 25000"
          step={500}
          value={emi}
          onChange={setEmi}
        />
        <CalcField label="Interest % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 8.5"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Tenure (years)">
          <Input
            type="number"
            min={0}
            placeholder="e.g. 20"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>
      <CalcStat
        label="Loan you can afford"
        value={formatINR(principal)}
        accent="teal"
      />
    </div>
  );
}

/**
 * Compare paying a loan via EMI vs clearing with a lumpsum today
 * (interest you avoid by paying off now).
 */
export function LoanLumpsumPayoffCalculator() {
  const [outstanding, setOutstanding] = useState("");
  const [rate, setRate] = useState("");
  const [remainingYears, setRemainingYears] = useState("");

  const outstandingN = parseAmount(outstanding);
  const rateN = parseAmount(rate);
  const remainingYearsN = parseAmount(remainingYears);
  const tenureMonths = Math.max(0, Math.round(remainingYearsN * 12));

  const viaEmi = useMemo(() => {
    const emi = calculateEMI(outstandingN, rateN, tenureMonths);
    if (tenureMonths <= 0 || outstandingN <= 0) {
      return { emi: 0, totalInterest: 0, totalPayable: 0 };
    }
    const rows = generateAmortizationSchedule({
      principal: outstandingN,
      annualRate: rateN,
      tenureMonths,
      emi,
      startDate: new Date(),
    });
    const totals = scheduleTotals(rows);
    return { emi, ...totals };
  }, [outstandingN, rateN, tenureMonths]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcMoneyInput
          label="Outstanding principal (₹)"
          placeholder="e.g. 800000"
          step={10000}
          value={outstanding}
          onChange={setOutstanding}
        />
        <CalcField label="Interest % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 10"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Remaining tenure (years)">
          <Input
            type="number"
            min={0}
            step={0.5}
            placeholder="e.g. 5"
            value={remainingYears}
            onChange={(e) => setRemainingYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CalcStat
          label="Lumpsum to clear now"
          value={formatINR(outstandingN)}
          accent="teal"
        />
        <CalcStat label="Current EMI" value={formatINR(viaEmi.emi)} />
        <CalcStat
          label="Interest if you continue EMI"
          value={formatINR(viaEmi.totalInterest)}
        />
        <CalcStat
          label="Interest saved by lumpsum"
          value={formatINR(viaEmi.totalInterest)}
          accent="positive"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Paying {formatINR(outstandingN)} today avoids about{" "}
        {formatINR(viaEmi.totalInterest)} in future interest (before
        prepayment charges, if any).
      </p>
    </div>
  );
}

export function LoanCalculatorsPanel() {
  const [tab, setTab] = useState<"summary" | "afford" | "lumpsum" | "modes">(
    "summary"
  );

  const tabs = [
    { id: "summary" as const, label: "EMI summary" },
    { id: "afford" as const, label: "How much loan?" },
    { id: "lumpsum" as const, label: "Lumpsum payoff" },
    { id: "modes" as const, label: "Solve for X" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "rounded-lg border border-teal-600/40 bg-teal-500/10 px-3 py-1.5 text-sm font-medium"
                : "rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "summary" && <LoanEmiSummaryCalculator />}
      {tab === "afford" && <LoanAffordabilityCalculator />}
      {tab === "lumpsum" && <LoanLumpsumPayoffCalculator />}
      {tab === "modes" && <EmiCalculator />}
    </div>
  );
}
