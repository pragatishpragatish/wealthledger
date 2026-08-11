"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR, formatPercent } from "@/utils/currency";
import { calculateSip } from "@/lib/calculations/investment";
import { CalcField, CalcStat, CalcToggle } from "@/features/calculators/calc-ui";

export function SipCalculator() {
  const [monthly, setMonthly] = useState(5000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const [withLumpsum, setWithLumpsum] = useState(false);
  const [lumpsum, setLumpsum] = useState(50000);
  const [withStepUp, setWithStepUp] = useState(false);
  const [stepUp, setStepUp] = useState(10);

  const result = useMemo(
    () =>
      calculateSip({
        monthlyInvestment: monthly,
        annualRatePercent: rate,
        years,
        lumpsum: withLumpsum ? lumpsum : 0,
        stepUpPercent: withStepUp ? stepUp : 0,
      }),
    [monthly, rate, years, withLumpsum, lumpsum, withStepUp, stepUp]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Monthly SIP (₹)">
          <Input
            type="number"
            min={0}
            step={500}
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value) || 0)}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <CalcToggle
          checked={withLumpsum}
          onCheckedChange={setWithLumpsum}
          label="Add lumpsum"
          description="One-time amount invested at the start"
        />
        <CalcToggle
          checked={withStepUp}
          onCheckedChange={setWithStepUp}
          label="Annual step-up"
          description="Increase SIP every year"
        />
      </div>

      {(withLumpsum || withStepUp) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {withLumpsum && (
            <CalcField label="Lumpsum (₹)">
              <Input
                type="number"
                min={0}
                step={1000}
                value={lumpsum}
                onChange={(e) => setLumpsum(Number(e.target.value) || 0)}
              />
            </CalcField>
          )}
          {withStepUp && (
            <CalcField label="Step-up % / year" hint="Applied after each 12 SIPs">
              <Input
                type="number"
                min={0}
                step={1}
                value={stepUp}
                onChange={(e) => setStepUp(Number(e.target.value) || 0)}
              />
            </CalcField>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CalcStat
          label="Maturity value"
          value={formatINR(result.corpus)}
          accent="teal"
        />
        <CalcStat label="Total invested" value={formatINR(result.invested)} />
        <CalcStat
          label="Est. gains"
          value={formatINR(result.gains)}
          accent="positive"
        />
        <CalcStat
          label={withStepUp ? "Final monthly SIP" : "Months"}
          value={
            withStepUp
              ? formatINR(result.finalMonthlySip)
              : String(result.months)
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Gain share of corpus:{" "}
        {result.corpus > 0
          ? formatPercent((result.gains / result.corpus) * 100, 1)
          : "0%"}
        . Returns are illustrative — markets vary.
      </p>
    </div>
  );
}
