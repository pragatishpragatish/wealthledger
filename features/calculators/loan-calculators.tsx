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
import { CalcField, CalcStat } from "@/features/calculators/calc-ui";
import { EmiCalculator } from "@/features/loans/emi-calculator";

/** Full EMI summary: payment, interest, total. */
export function LoanEmiSummaryCalculator() {
  const [principal, setPrincipal] = useState(2500000);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);

  const tenureMonths = Math.max(0, Math.round(years * 12));
  const emi = useMemo(
    () => calculateEMI(principal, rate, tenureMonths),
    [principal, rate, tenureMonths]
  );

  const totals = useMemo(() => {
    if (tenureMonths <= 0 || principal <= 0) {
      return { totalInterest: 0, totalPrincipal: 0, totalPayable: 0 };
    }
    const rows = generateAmortizationSchedule({
      principal,
      annualRate: rate,
      tenureMonths,
      emi,
      startDate: new Date(),
    });
    return scheduleTotals(rows);
  }, [principal, rate, tenureMonths, emi]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Loan amount (₹)">
          <Input
            type="number"
            min={0}
            step={10000}
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Interest % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Tenure (years)">
          <Input
            type="number"
            min={0}
            step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value) || 0)}
          />
        </CalcField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CalcStat label="Monthly EMI" value={formatINR(emi)} accent="teal" />
        <CalcStat label="Total interest" value={formatINR(totals.totalInterest)} />
        <CalcStat label="Total payable" value={formatINR(totals.totalPayable)} />
        <CalcStat
          label="Interest share"
          value={
            totals.totalPayable > 0
              ? formatPercent((totals.totalInterest / totals.totalPayable) * 100, 1)
              : "0%"
          }
        />
      </div>
    </div>
  );
}

/** How much loan you can take for a given EMI budget. */
export function LoanAffordabilityCalculator() {
  const [emi, setEmi] = useState(25000);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);

  const tenureMonths = Math.max(0, Math.round(years * 12));
  const principal = useMemo(
    () => calculatePrincipal(emi, rate, tenureMonths),
    [emi, rate, tenureMonths]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Affordable EMI (₹)">
          <Input
            type="number"
            min={0}
            value={emi}
            onChange={(e) => setEmi(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Interest % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Tenure (years)">
          <Input
            type="number"
            min={0}
            value={years}
            onChange={(e) => setYears(Number(e.target.value) || 0)}
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
  const [outstanding, setOutstanding] = useState(800000);
  const [rate, setRate] = useState(10);
  const [remainingYears, setRemainingYears] = useState(5);

  const tenureMonths = Math.max(0, Math.round(remainingYears * 12));

  const viaEmi = useMemo(() => {
    const emi = calculateEMI(outstanding, rate, tenureMonths);
    if (tenureMonths <= 0 || outstanding <= 0) {
      return { emi: 0, totalInterest: 0, totalPayable: 0 };
    }
    const rows = generateAmortizationSchedule({
      principal: outstanding,
      annualRate: rate,
      tenureMonths,
      emi,
      startDate: new Date(),
    });
    const totals = scheduleTotals(rows);
    return { emi, ...totals };
  }, [outstanding, rate, tenureMonths]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Outstanding principal (₹)">
          <Input
            type="number"
            min={0}
            value={outstanding}
            onChange={(e) => setOutstanding(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Interest % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Remaining tenure (years)">
          <Input
            type="number"
            min={0}
            step={0.5}
            value={remainingYears}
            onChange={(e) => setRemainingYears(Number(e.target.value) || 0)}
          />
        </CalcField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CalcStat
          label="Lumpsum to clear now"
          value={formatINR(outstanding)}
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
        Paying {formatINR(outstanding)} today avoids about{" "}
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
