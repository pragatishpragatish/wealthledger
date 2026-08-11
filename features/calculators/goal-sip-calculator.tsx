"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/utils/currency";
import { requiredMonthlySip } from "@/lib/calculations/investment";
import {
  CalcField,
  CalcStat,
  parseAmount,
} from "@/features/calculators/calc-ui";

export function GoalSipCalculator() {
  const [goal, setGoal] = useState("5000000");
  const [lumpsum, setLumpsum] = useState("");
  const [stepUp, setStepUp] = useState("");
  const [rate, setRate] = useState("12");
  const [years, setYears] = useState("10");

  const goalN = parseAmount(goal);
  const lump = parseAmount(lumpsum);
  const step = parseAmount(stepUp);
  const rateN = parseAmount(rate);
  const yearsN = parseAmount(years);

  const monthly = useMemo(
    () =>
      requiredMonthlySip({
        goalAmount: goalN,
        annualRatePercent: rateN,
        years: yearsN,
        lumpsum: lump,
        stepUpPercent: step,
      }),
    [goalN, rateN, yearsN, lump, step]
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Enter a target corpus. Leave lumpsum or step-up blank if you don’t need
        them.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CalcField label="Target corpus (₹)">
          <Input
            type="number"
            min={0}
            step={10000}
            placeholder="e.g. 5000000"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </CalcField>
        <CalcField
          label="Starting lumpsum (₹)"
          hint="Already invested / investing now — leave blank if none"
        >
          <Input
            type="number"
            min={0}
            placeholder="e.g. 100000"
            value={lumpsum}
            onChange={(e) => setLumpsum(e.target.value)}
          />
        </CalcField>
        <CalcField
          label="SIP step-up % / year"
          hint="Leave blank for a constant monthly SIP"
        >
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 10"
            value={stepUp}
            onChange={(e) => setStepUp(e.target.value)}
          />
        </CalcField>
        <CalcField label="Expected return % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 12"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </CalcField>
        <CalcField label="Years to goal">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 10"
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
        </CalcField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CalcStat
          label={step > 0 ? "Starting monthly SIP" : "Required monthly SIP"}
          value={formatINR(monthly)}
          accent="teal"
        />
        <CalcStat label="Target" value={formatINR(goalN)} />
      </div>
    </div>
  );
}
