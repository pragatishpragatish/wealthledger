"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/utils/currency";
import { requiredMonthlySip } from "@/lib/calculations/investment";
import { CalcField, CalcStat } from "@/features/calculators/calc-ui";

export function GoalSipCalculator() {
  const [goal, setGoal] = useState(5000000);
  const [lumpsum, setLumpsum] = useState(0);
  const [stepUp, setStepUp] = useState(0);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);

  const monthly = useMemo(
    () =>
      requiredMonthlySip({
        goalAmount: goal,
        annualRatePercent: rate,
        years,
        lumpsum: Math.max(0, lumpsum),
        stepUpPercent: Math.max(0, stepUp),
      }),
    [goal, rate, years, lumpsum, stepUp]
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Enter any starting lumpsum (or 0). Step-up is the yearly increase on the
        required SIP — use 0 for a flat SIP.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CalcField label="Target corpus (₹)">
          <Input
            type="number"
            min={0}
            step={10000}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField
          label="Starting lumpsum (₹)"
          hint="Already invested / investing now — use 0 if none"
        >
          <Input
            type="number"
            min={0}
            value={lumpsum}
            onChange={(e) => setLumpsum(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField
          label="SIP step-up % / year"
          hint="Use 0 for a constant monthly SIP"
        >
          <Input
            type="number"
            min={0}
            step={1}
            value={stepUp}
            onChange={(e) => setStepUp(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Expected return % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Years to goal">
          <Input
            type="number"
            min={0}
            step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value) || 0)}
          />
        </CalcField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CalcStat
          label={stepUp > 0 ? "Starting monthly SIP" : "Required monthly SIP"}
          value={formatINR(monthly)}
          accent="teal"
        />
        <CalcStat label="Target" value={formatINR(goal)} />
      </div>
    </div>
  );
}
