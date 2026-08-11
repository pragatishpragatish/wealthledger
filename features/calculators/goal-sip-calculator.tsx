"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/utils/currency";
import { requiredMonthlySip } from "@/lib/calculations/investment";
import { CalcField, CalcStat, CalcToggle } from "@/features/calculators/calc-ui";

export function GoalSipCalculator() {
  const [goal, setGoal] = useState(5000000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const [withLumpsum, setWithLumpsum] = useState(false);
  const [lumpsum, setLumpsum] = useState(100000);
  const [withStepUp, setWithStepUp] = useState(false);
  const [stepUp, setStepUp] = useState(10);

  const monthly = useMemo(
    () =>
      requiredMonthlySip({
        goalAmount: goal,
        annualRatePercent: rate,
        years,
        lumpsum: withLumpsum ? lumpsum : 0,
        stepUpPercent: withStepUp ? stepUp : 0,
      }),
    [goal, rate, years, withLumpsum, lumpsum, withStepUp, stepUp]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Target corpus (₹)">
          <Input
            type="number"
            min={0}
            step={10000}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value) || 0)}
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
        <CalcToggle
          checked={withLumpsum}
          onCheckedChange={setWithLumpsum}
          label="Starting lumpsum"
          description="Already invested or investing now"
        />
        <CalcToggle
          checked={withStepUp}
          onCheckedChange={setWithStepUp}
          label="Plan annual step-up"
          description="Starting SIP grows each year"
        />
      </div>

      {(withLumpsum || withStepUp) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {withLumpsum && (
            <CalcField label="Lumpsum (₹)">
              <Input
                type="number"
                min={0}
                value={lumpsum}
                onChange={(e) => setLumpsum(Number(e.target.value) || 0)}
              />
            </CalcField>
          )}
          {withStepUp && (
            <CalcField label="Step-up % / year">
              <Input
                type="number"
                min={0}
                value={stepUp}
                onChange={(e) => setStepUp(Number(e.target.value) || 0)}
              />
            </CalcField>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <CalcStat
          label={withStepUp ? "Starting monthly SIP" : "Required monthly SIP"}
          value={formatINR(monthly)}
          accent="teal"
        />
        <CalcStat label="Target" value={formatINR(goal)} />
      </div>
    </div>
  );
}
