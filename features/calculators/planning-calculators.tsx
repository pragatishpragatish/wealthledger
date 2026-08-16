"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/utils/currency";
import {
  calculatePpf,
  calculateRetirementCorpus,
  requiredLumpsum,
} from "@/lib/calculations/investment";
import {
  CalcField,
  CalcMoneyInput,
  CalcStat,
  parseAmount,
} from "@/features/calculators/calc-ui";

/** Public Provident Fund — yearly contribution, annual compounding. */
export function PpfCalculator() {
  const [annual, setAnnual] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");

  const annualN = parseAmount(annual);
  const rateN = parseAmount(rate);
  const yearsN = years.trim() === "" ? 15 : parseAmount(years);

  const result = useMemo(
    () =>
      calculatePpf({
        annualContribution: annualN,
        annualRatePercent: rateN,
        years: yearsN,
      }),
    [annualN, rateN, yearsN]
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Simplified PPF model with yearly deposits and annual compounding.
        Current notified rate is often around 7.1% — confirm before deciding.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CalcMoneyInput
          label="Annual contribution (₹)"
          hint="PPF yearly limit is ₹1.5 lakh"
          placeholder="e.g. 150000"
          step={1000}
          value={annual}
          onChange={setAnnual}
        />
        <CalcField label="Interest % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 7.1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField
          label="Tenure (years)"
          hint="Default lock-in is 15 years; extensions in 5-year blocks"
        >
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 15"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CalcStat
          label="Maturity amount"
          value={formatINR(result.maturity)}
          accent="teal"
        />
        <CalcStat label="Total invested" value={formatINR(result.invested)} />
        <CalcStat
          label="Interest earned"
          value={formatINR(result.interest)}
          accent="positive"
        />
      </div>
    </div>
  );
}

/** How much to invest today for a future goal. */
export function LumpsumGoalCalculator() {
  const [goal, setGoal] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");

  const goalN = parseAmount(goal);
  const rateN = parseAmount(rate);
  const yearsN = parseAmount(years);

  const needed = useMemo(
    () =>
      requiredLumpsum({
        goalAmount: goalN,
        annualRatePercent: rateN,
        years: yearsN,
      }),
    [goalN, rateN, yearsN]
  );

  const gains = Math.max(0, goalN - needed);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Find the one-time investment needed today so it grows to your target
        (complements Goal SIP for monthly investing).
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CalcMoneyInput
          label="Target amount (₹)"
          placeholder="e.g. 1000000"
          step={10000}
          value={goal}
          onChange={setGoal}
        />
        <CalcField label="Expected return % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 12"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Years until goal">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 8"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CalcStat
          label="Invest today"
          value={formatINR(needed)}
          accent="teal"
        />
        <CalcStat label="Target" value={formatINR(goalN)} />
        <CalcStat
          label="Expected growth"
          value={formatINR(gains)}
          accent="positive"
        />
      </div>
    </div>
  );
}

/** Retirement corpus from expenses + SIP to close the gap. */
export function RetirementCalculator() {
  const [expense, setExpense] = useState("");
  const [existing, setExisting] = useState("");
  const [yearsTo, setYearsTo] = useState("");
  const [yearsRetire, setYearsRetire] = useState("");
  const [inflation, setInflation] = useState("");
  const [accumReturn, setAccumReturn] = useState("");
  const [retireReturn, setRetireReturn] = useState("");

  const expenseN = parseAmount(expense);
  const existingN = parseAmount(existing);
  const yearsToN = parseAmount(yearsTo);
  const yearsRetireN = parseAmount(yearsRetire);
  const inflationN = parseAmount(inflation);
  const accumN = parseAmount(accumReturn);
  const retireN = parseAmount(retireReturn);

  const result = useMemo(
    () =>
      calculateRetirementCorpus({
        monthlyExpenseToday: expenseN,
        yearsToRetirement: yearsToN,
        inflationPercent: inflationN,
        accumulationReturnPercent: accumN,
        retirementReturnPercent: retireN,
        yearsInRetirement: yearsRetireN,
        existingCorpus: existingN,
      }),
    [expenseN, existingN, yearsToN, yearsRetireN, inflationN, accumN, retireN]
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Estimate the corpus you need so an SWP can cover inflated expenses
        through retirement, then the monthly SIP to get there.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CalcMoneyInput
          label="Monthly expenses today (₹)"
          placeholder="e.g. 50000"
          step={1000}
          value={expense}
          onChange={setExpense}
        />
        <CalcMoneyInput
          label="Existing corpus (₹)"
          hint="Optional — leave blank if starting from zero"
          placeholder="e.g. 1000000"
          step={10000}
          value={existing}
          onChange={setExisting}
        />
        <CalcField label="Years to retirement">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 20"
            value={yearsTo}
            onChange={(e) => setYearsTo(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Years in retirement">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 30"
            value={yearsRetire}
            onChange={(e) => setYearsRetire(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Inflation % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 6"
            value={inflation}
            onChange={(e) => setInflation(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField
          label="Return while investing % p.a."
          hint="Expected portfolio return before retirement"
        >
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 12"
            value={accumReturn}
            onChange={(e) => setAccumReturn(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField
          label="Return in retirement % p.a."
          hint="Conservative mix while withdrawing"
        >
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 7"
            value={retireReturn}
            onChange={(e) => setRetireReturn(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CalcStat
          label="Monthly expense at retirement"
          value={formatINR(result.expenseAtRetirement)}
        />
        <CalcStat
          label="Corpus needed"
          value={formatINR(result.corpusNeeded)}
          accent="teal"
        />
        <CalcStat
          label="Existing corpus then"
          value={formatINR(result.existingAtRetirement)}
        />
        <CalcStat label="Gap to close" value={formatINR(result.gap)} />
        <CalcStat
          label="Monthly SIP needed"
          value={formatINR(result.monthlySipNeeded)}
          accent="positive"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Assumes constant real spending in retirement dollars grown only by
        pre-retirement inflation. Pair with the SWP calculator to stress-test
        withdrawals.
      </p>
    </div>
  );
}
