"use client";

import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR, formatPercent } from "@/utils/currency";

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent = "default",
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  accent?: "default" | "positive" | "negative" | "teal" | "amber";
  delay?: number;
}) {
  const accentStyles = {
    default: "from-card to-card",
    positive: "from-emerald-500/5 to-card",
    negative: "from-rose-500/5 to-card",
    teal: "from-teal-500/8 to-card",
    amber: "from-amber-500/8 to-card",
  };

  const iconStyles = {
    default: "bg-muted text-foreground",
    positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    negative: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    teal: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-5 shadow-sm",
        accentStyles[accent]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {title}
          </p>
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {formatINR(value)}
          </p>
          {trend !== undefined && (
            <div
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                trend >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {formatPercent(Math.abs(trend))}
              {trendLabel && (
                <span className="font-normal text-muted-foreground">
                  {trendLabel}
                </span>
              )}
            </div>
          )}
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            iconStyles[accent]
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

export function SavingsRateCard({ rate }: { rate: number; delay?: number }) {
  const clamped = Math.max(0, Math.min(100, rate));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-teal-500/8 to-card p-5 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Savings Rate
      </p>
      <p className="mt-2 font-heading text-2xl font-semibold tracking-tight tabular-nums">
        {formatPercent(rate)}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-teal-600 transition-[width] duration-700 ease-out dark:bg-teal-400"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Of monthly income saved
      </p>
    </div>
  );
}
