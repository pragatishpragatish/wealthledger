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
import { CalcField, CalcStat } from "@/features/calculators/calc-ui";

export function FdCalculator() {
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate] = useState(7.1);
  const [years, setYears] = useState(3);
  const [compounds, setCompounds] = useState<1 | 2 | 4 | 12>(4);

  const result = useMemo(
    () =>
      calculateFd({
        principal,
        annualRatePercent: rate,
        years,
        compoundsPerYear: compounds,
      }),
    [principal, rate, years, compounds]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CalcField label="Principal (₹)">
          <Input
            type="number"
            min={0}
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
            step={0.5}
            value={years}
            onChange={(e) => setYears(Number(e.target.value) || 0)}
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
  const [monthly, setMonthly] = useState(5000);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(5);

  const result = useMemo(
    () =>
      calculateRd({
        monthlyDeposit: monthly,
        annualRatePercent: rate,
        years,
      }),
    [monthly, rate, years]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Monthly deposit (₹)">
          <Input
            type="number"
            min={0}
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value) || 0)}
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
  const [amount, setAmount] = useState(100000);
  const [inflation, setInflation] = useState(6);
  const [years, setYears] = useState(10);

  const result = useMemo(
    () =>
      calculateInflation({
        amount,
        annualInflationPercent: inflation,
        years,
      }),
    [amount, inflation, years]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Amount today (₹)">
          <Input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Inflation % p.a.">
          <Input
            type="number"
            min={0}
            step={0.1}
            value={inflation}
            onChange={(e) => setInflation(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Years">
          <Input
            type="number"
            min={0}
            value={years}
            onChange={(e) => setYears(Number(e.target.value) || 0)}
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
  const [start, setStart] = useState(100000);
  const [end, setEnd] = useState(250000);
  const [years, setYears] = useState(5);

  const cagr = useMemo(
    () =>
      calculateCagr({
        startValue: start,
        endValue: end,
        years,
      }),
    [start, end, years]
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CalcField label="Starting value (₹)">
          <Input
            type="number"
            min={0}
            value={start}
            onChange={(e) => setStart(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Ending value (₹)">
          <Input
            type="number"
            min={0}
            value={end}
            onChange={(e) => setEnd(Number(e.target.value) || 0)}
          />
        </CalcField>
        <CalcField label="Years">
          <Input
            type="number"
            min={0}
            step={0.1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value) || 0)}
          />
        </CalcField>
      </div>
      <CalcStat label="CAGR" value={formatPercent(cagr, 2)} accent="teal" />
    </div>
  );
}
