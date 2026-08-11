"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR, formatPercent } from "@/utils/currency";
import { cn } from "@/lib/utils";
import {
  fetchBudgetProgression,
} from "@/features/budgets/actions";
import type { BudgetProgressionPoint } from "@/features/budgets/queries";
import type { BudgetPeriod } from "@/types";

type Props = {
  categoryId: string;
  period: BudgetPeriod;
  defaultYear: number;
};

function yearOptions(center: number) {
  const years: number[] = [];
  for (let y = center; y >= center - 6; y--) years.push(y);
  return years;
}

export function BudgetProgressionPanel({
  categoryId,
  period,
  defaultYear,
}: Props) {
  const [year, setYear] = useState(defaultYear);
  const [points, setPoints] = useState<BudgetProgressionPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setYear(defaultYear);
  }, [defaultYear, categoryId]);

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchBudgetProgression({
        categoryId,
        year,
        period,
      });
      if (result.error) {
        setError(result.error);
        setPoints([]);
        return;
      }
      setError(null);
      setPoints(result.data ?? []);
    });
  }, [categoryId, year, period]);

  const years = yearOptions(Math.max(defaultYear, new Date().getFullYear()));

  return (
    <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Spending progression
        </p>
        <Select
          value={String(year)}
          onValueChange={(v) => {
            if (v != null) setYear(Number(v));
          }}
          items={Object.fromEntries(years.map((y) => [String(y), String(y)]))}
        >
          <SelectTrigger size="sm" className="h-7 w-[5.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pending && points.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : points.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No budget or spending recorded for {year}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[2.5rem_1fr_1fr_3rem] gap-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">
            <span>{period === "yearly" ? "Year" : "Mo"}</span>
            <span>Budget</span>
            <span>Spent</span>
            <span className="text-right">Used</span>
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {points.map((p) => (
              <li
                key={`${p.year}-${p.month ?? "y"}`}
                className="grid grid-cols-[2.5rem_1fr_1fr_3rem] items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted/50"
              >
                <span className="font-medium text-muted-foreground">
                  {p.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {p.budgetAmount != null ? formatINR(p.budgetAmount) : "—"}
                </span>
                <span className="tabular-nums">{formatINR(p.spent)}</span>
                <span
                  className={cn(
                    "text-right tabular-nums",
                    p.usagePercent >= 100
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground"
                  )}
                >
                  {p.budgetAmount != null ? formatPercent(p.usagePercent) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
