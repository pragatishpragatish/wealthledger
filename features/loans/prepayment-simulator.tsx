"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { cn } from "@/lib/utils";
import { formatINR, formatINRCompact } from "@/utils/currency";
import { toDateString } from "@/utils/date";
import { simulatePrepayment } from "@/features/loans/prepayment-math";
import { saveLoanSimulation } from "@/features/loans/actions";
import type { LoanComputed } from "@/features/loans/queries";
import type { LoanSimulation, PrepaymentStrategy } from "@/types";

type Props = {
  loan: LoanComputed;
  simulations: LoanSimulation[];
};

export function PrepaymentSimulator({ loan, simulations }: Props) {
  const [strategy, setStrategy] = useState<PrepaymentStrategy>("reduce_tenure");
  const [oneTimeAmount, setOneTimeAmount] = useState(100000);
  const [oneTimeDate, setOneTimeDate] = useState(toDateString(new Date()));
  const [recurringExtra, setRecurringExtra] = useState(0);
  const [increasedEmi, setIncreasedEmi] = useState<number | "">("");
  const [annualLump, setAnnualLump] = useState(0);
  const [scenarioName, setScenarioName] = useState("Prepayment scenario");
  const [pending, startTransition] = useTransition();

  const remainingMonths = Math.max(
    1,
    loan.remaining_months || loan.tenure_months - loan.emis_paid
  );

  const result = useMemo(
    () =>
      simulatePrepayment({
        outstanding: loan.outstanding_principal,
        annualRate: loan.interest_rate,
        originalEmi: loan.emi,
        remainingMonths,
        startDate: new Date(),
        strategy,
        oneTimeAmount: Number(oneTimeAmount) || 0,
        oneTimeDate: oneTimeDate || null,
        recurringExtraEmi: Number(recurringExtra) || 0,
        increasedEmi:
          increasedEmi === "" || increasedEmi == null
            ? null
            : Number(increasedEmi),
        annualLumpSum: Number(annualLump) || 0,
        prepaymentChargePct: loan.prepayment_charges,
      }),
    [
      loan.outstanding_principal,
      loan.interest_rate,
      loan.emi,
      loan.prepayment_charges,
      remainingMonths,
      strategy,
      oneTimeAmount,
      oneTimeDate,
      recurringExtra,
      increasedEmi,
      annualLump,
    ]
  );

  function persist(apply: boolean) {
    startTransition(async () => {
      const res = await saveLoanSimulation(loan.id, {
        name: scenarioName.trim() || "Untitled Scenario",
        strategy,
        one_time_amount: Number(oneTimeAmount) || 0,
        one_time_date: oneTimeDate || null,
        recurring_extra_emi: Number(recurringExtra) || 0,
        increased_emi:
          increasedEmi === "" || increasedEmi == null
            ? null
            : Number(increasedEmi),
        annual_lump_sum: Number(annualLump) || 0,
        original_emi: result.originalEmi,
        new_emi: result.newEmi,
        original_tenure: result.originalTenure,
        new_tenure: result.newTenure,
        interest_saved: Math.max(0, result.interestSaved),
        months_saved: result.monthsSaved,
        total_savings: result.totalSavings,
        schedule_json: result.newSchedule,
        apply_to_loan: apply,
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(
        apply ? "Scenario saved and applied to loan" : "Scenario saved"
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="font-heading text-base font-semibold">
          Prepayment simulator
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Experiment freely — nothing changes until you save or apply a
          scenario.
        </p>

        <div className="mt-4 flex rounded-lg border border-border/60 bg-muted/40 p-1">
          {(
            [
              ["reduce_tenure", "Reduce tenure"],
              ["reduce_emi", "Reduce EMI"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                strategy === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setStrategy(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>One-time amount (₹)</Label>
            <Input
              type="number"
              min="0"
              value={oneTimeAmount}
              onChange={(e) => setOneTimeAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>One-time date</Label>
            <Input
              type="date"
              value={oneTimeDate}
              onChange={(e) => setOneTimeDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Recurring extra EMI (₹)</Label>
            <Input
              type="number"
              min="0"
              value={recurringExtra}
              onChange={(e) => setRecurringExtra(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Increase EMI to (₹)</Label>
            <Input
              type="number"
              min="0"
              placeholder={`Current ${loan.emi}`}
              value={increasedEmi}
              onChange={(e) => {
                const v = e.target.value;
                setIncreasedEmi(v === "" ? "" : Number(v));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Annual lump sum (₹)</Label>
            <Input
              type="number"
              min="0"
              value={annualLump}
              onChange={(e) => setAnnualLump(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Scenario name</Label>
            <Input
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Untitled Scenario"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CompareTile
          title="EMI"
          original={formatINR(result.originalEmi)}
          next={formatINR(result.newEmi)}
        />
        <CompareTile
          title="Tenure"
          original={`${result.originalTenure} mo`}
          next={`${result.newTenure} mo`}
        />
        <CompareTile
          title="Interest saved"
          original={formatINR(result.originalTotalInterest)}
          next={formatINR(Math.max(0, result.interestSaved))}
          highlight
        />
        <CompareTile
          title="Months saved"
          original={`${result.originalTenure}`}
          next={`${result.monthsSaved} mo`}
          highlight
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Outstanding balance · original vs simulated
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.comparisonChart}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/50"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={(v) => formatINRCompact(v)}
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
                width={56}
              />
              <ChartTooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="original"
                name="Original"
                stroke="#94A3B8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="simulated"
                name="Simulated"
                stroke="#0F766E"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Total savings{" "}
          <span className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
            {formatINR(result.totalSavings)}
          </span>{" "}
          · New interest{" "}
          <span className="tabular-nums">{formatINR(result.newTotalInterest)}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => persist(false)}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save Scenario
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => persist(true)}
        >
          Apply to Loan
        </Button>
      </div>

      {simulations.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Saved scenarios
          </h3>
          <ul className="divide-y divide-border/60">
            {simulations.map((sim) => (
              <li
                key={sim.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{sim.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sim.strategy === "reduce_emi"
                      ? "Reduce EMI"
                      : "Reduce tenure"}{" "}
                    · Saved {formatINR(sim.interest_saved)} ·{" "}
                    {sim.months_saved} mo
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {sim.is_applied && <Badge variant="secondary">Applied</Badge>}
                  <span className="text-sm tabular-nums">
                    EMI {formatINR(sim.new_emi)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CompareTile({
  title,
  original,
  next,
  highlight,
}: {
  title: string;
  original: string;
  next: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Original{" "}
        <span className="text-foreground tabular-nums">{original}</span>
      </p>
      <p
        className={cn(
          "mt-1 font-heading text-lg font-semibold tabular-nums",
          highlight && "text-emerald-700 dark:text-emerald-400"
        )}
      >
        {next}
      </p>
    </div>
  );
}
