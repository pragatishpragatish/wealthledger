"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatINR, formatPercent } from "@/utils/currency";
import {
  calculateEMI,
  calculateInterestRate,
  calculatePrincipal,
  calculateTenure,
} from "@/lib/calculations/loan";

type CalcMode = "emi" | "tenure" | "rate" | "principal";

const MODES: { value: CalcMode; label: string; hint: string }[] = [
  { value: "emi", label: "P + R + T → EMI", hint: "Find EMI" },
  { value: "tenure", label: "P + R + EMI → T", hint: "Find tenure" },
  { value: "rate", label: "P + EMI + T → Rate", hint: "Find rate" },
  { value: "principal", label: "EMI + R + T → P", hint: "Find principal" },
];

export function EmiCalculator() {
  const [mode, setMode] = useState<CalcMode>("emi");
  const [principal, setPrincipal] = useState(2500000);
  const [rate, setRate] = useState(8.5);
  const [tenure, setTenure] = useState(240);
  const [emi, setEmi] = useState(21567);

  const result = useMemo(() => {
    switch (mode) {
      case "emi":
        return {
          label: "EMI",
          value: formatINR(
            calculateEMI(principal, rate, tenure),
            { precise: true }
          ),
        };
      case "tenure": {
        const n = calculateTenure(principal, rate, emi);
        return {
          label: "Tenure",
          value: Number.isFinite(n)
            ? `${n} months (${(n / 12).toFixed(1)} yrs)`
            : "EMI too low",
        };
      }
      case "rate":
        return {
          label: "Interest rate",
          value: formatPercent(
            calculateInterestRate(principal, emi, tenure),
            2
          ),
        };
      case "principal":
        return {
          label: "Principal",
          value: formatINR(
            calculatePrincipal(emi, rate, tenure),
            { precise: true }
          ),
        };
    }
  }, [mode, principal, rate, tenure, emi]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
          <Calculator className="size-4" />
        </span>
        <div>
          <h3 className="font-heading text-base font-semibold">EMI Calculator</h3>
          <p className="text-xs text-muted-foreground">
            Standalone — does not modify the loan
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
              mode === m.value
                ? "border-teal-600/40 bg-teal-500/10 text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-muted/40"
            )}
          >
            <span className="block font-medium">{m.hint}</span>
            <span className="mt-0.5 block opacity-80">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mode !== "principal" && (
          <div className="space-y-2">
            <Label>Principal (₹)</Label>
            <Input
              type="number"
              min="0"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
            />
          </div>
        )}
        {mode !== "rate" && (
          <div className="space-y-2">
            <Label>Rate % p.a.</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value) || 0)}
            />
          </div>
        )}
        {mode !== "tenure" && (
          <div className="space-y-2">
            <Label>Tenure (months)</Label>
            <Input
              type="number"
              min="1"
              value={tenure}
              onChange={(e) => setTenure(Number(e.target.value) || 0)}
            />
          </div>
        )}
        {mode !== "emi" && (
          <div className="space-y-2">
            <Label>EMI (₹)</Label>
            <Input
              type="number"
              min="0"
              value={emi}
              onChange={(e) => setEmi(Number(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">{result.label}</p>
        <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">
          {result.value}
        </p>
      </div>
    </div>
  );
}
