"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/utils/currency";
import {
  calculateSwp,
  maxSustainableWithdrawal,
  swpMonthsUntilDepleted,
} from "@/lib/calculations/investment";
import {
  CalcField,
  CalcMoneyInput,
  CalcStat,
  parseAmount,
} from "@/features/calculators/calc-ui";

export function SwpCalculator() {
  const [corpus, setCorpus] = useState("");
  const [withdrawal, setWithdrawal] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");

  const corpusN = parseAmount(corpus);
  const withdrawalN = parseAmount(withdrawal);
  const rateN = parseAmount(rate);
  const yearsN = parseAmount(years);

  const result = useMemo(
    () =>
      calculateSwp({
        corpus: corpusN,
        monthlyWithdrawal: withdrawalN,
        annualRatePercent: rateN,
        years: yearsN,
      }),
    [corpusN, withdrawalN, rateN, yearsN]
  );

  const monthsToEmpty = useMemo(
    () =>
      swpMonthsUntilDepleted({
        corpus: corpusN,
        monthlyWithdrawal: withdrawalN,
        annualRatePercent: rateN,
      }),
    [corpusN, withdrawalN, rateN]
  );

  const maxWithdrawal = useMemo(
    () =>
      yearsN > 0
        ? maxSustainableWithdrawal({
            corpus: corpusN,
            annualRatePercent: rateN,
            years: yearsN,
          })
        : 0,
    [corpusN, rateN, yearsN]
  );

  const runwayLabel =
    monthsToEmpty == null
      ? "Does not deplete (within 100 yrs)"
      : monthsToEmpty >= 12
        ? `${(monthsToEmpty / 12).toFixed(1)} years`
        : `${monthsToEmpty} months`;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Model monthly withdrawals from a corpus while it keeps earning returns —
        useful for retirement income planning.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CalcMoneyInput
          label="Starting corpus (₹)"
          placeholder="e.g. 5000000"
          step={10000}
          value={corpus}
          onChange={setCorpus}
        />
        <CalcMoneyInput
          label="Monthly withdrawal (₹)"
          placeholder="e.g. 40000"
          step={1000}
          value={withdrawal}
          onChange={setWithdrawal}
        />
        <CalcField label="Expected return % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 8"
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
            placeholder="e.g. 25"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CalcStat
          label={result.depleted ? "Corpus depleted" : "Remaining corpus"}
          value={
            result.depleted
              ? `After ${result.monthsLasted} mo`
              : formatINR(result.remainingCorpus)
          }
          accent="teal"
        />
        <CalcStat
          label="Total withdrawn"
          value={formatINR(result.totalWithdrawn)}
        />
        <CalcStat
          label="Interest during SWP"
          value={formatINR(Math.max(0, result.interestEarned))}
          accent="positive"
        />
        <CalcStat label="Runway at this SWP" value={runwayLabel} />
      </div>

      {yearsN > 0 && corpusN > 0 ? (
        <p className="text-xs text-muted-foreground">
          Max monthly withdrawal to last {yearsN} years:{" "}
          <span className="font-medium text-foreground">
            {formatINR(maxWithdrawal)}
          </span>
          . Illustrative only — returns and inflation vary.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Enter corpus, withdrawal, return and tenure to project the plan.
        </p>
      )}
    </div>
  );
}
