"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatINR, formatPercent } from "@/utils/currency";
import {
  calculateCagr,
  calculateFd,
  calculateInflation,
  calculateRd,
} from "@/lib/calculations/investment";
import {
  CalcField,
  CalcMoneyInput,
  CalcStat,
  parseAmount,
} from "@/features/calculators/calc-ui";

export function FdCalculator() {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");
  const [compounds, setCompounds] = useState<1 | 2 | 4 | 12>(4);

  const principalN = parseAmount(principal);
  const rateN = parseAmount(rate);
  const yearsN = parseAmount(years);

  const result = useMemo(
    () =>
      calculateFd({
        principal: principalN,
        annualRatePercent: rateN,
        years: yearsN,
        compoundsPerYear: compounds,
      }),
    [principalN, rateN, yearsN, compounds]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CalcMoneyInput
          label="Principal (₹)"
          placeholder="e.g. 100000"
          step={1000}
          value={principal}
          onChange={setPrincipal}
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
        <CalcField label="Tenure (years)">
          <Input
            type="number"
            min={0}
            step={0.5}
            placeholder="e.g. 3"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Compounding">
          <select
            className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={compounds}
            onChange={(e) =>
              setCompounds(Number(e.target.value) as 1 | 2 | 4 | 12)
            }
          >
            <option value={1}>Yearly</option>
            <option value={2}>Half-yearly</option>
            <option value={4}>Quarterly</option>
            <option value={12}>Monthly</option>
          </select>
        </CalcField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CalcStat
          label="Maturity amount"
          value={formatINR(result.maturity)}
          accent="teal"
        />
        <CalcStat label="Principal" value={formatINR(result.invested)} />
        <CalcStat
          label="Interest earned"
          value={formatINR(result.interest)}
          accent="positive"
        />
      </div>
    </div>
  );
}

export function RdCalculator() {
  const [monthly, setMonthly] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");

  const monthlyN = parseAmount(monthly);
  const rateN = parseAmount(rate);
  const yearsN = parseAmount(years);

  const result = useMemo(
    () =>
      calculateRd({
        monthlyDeposit: monthlyN,
        annualRatePercent: rateN,
        years: yearsN,
      }),
    [monthlyN, rateN, yearsN]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcMoneyInput
          label="Monthly deposit (₹)"
          placeholder="e.g. 5000"
          step={500}
          value={monthly}
          onChange={setMonthly}
        />
        <CalcField label="Interest % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 7"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
        <CalcField label="Tenure (years)">
          <Input
            type="number"
            min={0}
            placeholder="e.g. 5"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CalcStat
          label="Maturity value"
          value={formatINR(result.corpus)}
          accent="teal"
        />
        <CalcStat label="Deposited" value={formatINR(result.invested)} />
        <CalcStat
          label="Interest"
          value={formatINR(result.gains)}
          accent="positive"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Approximate monthly compounding model for planning.
      </p>
    </div>
  );
}

export function InflationCalculator() {
  const [amount, setAmount] = useState("");
  const [inflation, setInflation] = useState("");
  const [years, setYears] = useState("");

  const amountN = parseAmount(amount);
  const inflationN = parseAmount(inflation);
  const yearsN = parseAmount(years);

  const result = useMemo(
    () =>
      calculateInflation({
        amount: amountN,
        annualInflationPercent: inflationN,
        years: yearsN,
      }),
    [amountN, inflationN, yearsN]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcMoneyInput
          label="Amount today (₹)"
          placeholder="e.g. 100000"
          step={1000}
          value={amount}
          onChange={setAmount}
        />
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
        <CalcField label="Years">
          <Input
            type="number"
            min={0}
            placeholder="e.g. 10"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <CalcStat
          label="Future cost of same lifestyle"
          value={formatINR(result.futureCost)}
          accent="teal"
        />
        <CalcStat
          label="Today’s ₹ in future money"
          value={formatINR(result.presentValue)}
        />
        <CalcStat
          label="Purchasing power lost"
          value={formatINR(result.erodedPurchasingPower)}
        />
      </div>
    </div>
  );
}

export function CagrCalculator() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [years, setYears] = useState("");

  const startN = parseAmount(start);
  const endN = parseAmount(end);
  const yearsN = parseAmount(years);

  const cagr = useMemo(
    () =>
      calculateCagr({
        startValue: startN,
        endValue: endN,
        years: yearsN,
      }),
    [startN, endN, yearsN]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcMoneyInput
          label="Starting value (₹)"
          placeholder="e.g. 100000"
          step={1000}
          value={start}
          onChange={setStart}
        />
        <CalcMoneyInput
          label="Ending value (₹)"
          placeholder="e.g. 250000"
          step={1000}
          value={end}
          onChange={setEnd}
        />
        <CalcField label="Years">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="e.g. 5"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            autoComplete="off"
          />
        </CalcField>
      </div>
      <CalcStat label="CAGR" value={formatPercent(cagr, 2)} accent="teal" />
    </div>
  );
}
