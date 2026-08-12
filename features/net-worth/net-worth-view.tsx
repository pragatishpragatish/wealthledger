"use client";

import { useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  Camera,
  Landmark,
  Loader2,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatINR, formatINRCompact } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { cn } from "@/lib/utils";
import { saveSnapshot } from "@/features/net-worth/actions";
import type { NetWorthPageData } from "@/features/net-worth/queries";

export function NetWorthView({ data }: { data: NetWorthPageData }) {
  const { live, snapshots, trend, assetItems, liabilityItems } = data;
  const [pending, startTransition] = useTransition();

  function handleSnapshot() {
    startTransition(async () => {
      const result = await saveSnapshot();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Snapshot saved for today");
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Net Worth"
        description="Live assets minus liabilities, with historical snapshots."
        action={
          <Button onClick={handleSnapshot} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            Save snapshot
          </Button>
        }
      />

      <div className="min-w-0 rounded-2xl border border-border/60 bg-gradient-to-br from-teal-500/10 via-card to-card p-4 shadow-sm sm:p-6">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Current net worth
        </p>
        <p
          className={cn(
            "mt-2 break-all font-heading text-2xl font-semibold tracking-tight tabular-nums sm:text-4xl",
            live.netWorth >= 0
              ? "text-teal-800 dark:text-teal-300"
              : "text-rose-700 dark:text-rose-400"
          )}
        >
          {formatINR(live.netWorth)}
        </p>
        <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
          <span className="min-w-0">
            Assets{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatINR(live.totalAssets)}
            </span>
          </span>
          <span className="min-w-0">
            Liabilities{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatINR(live.totalLiabilities)}
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <BreakdownStat
          title="Cash"
          value={formatINR(live.totalCash)}
          icon={Wallet}
          tone="teal"
        />
        <BreakdownStat
          title="Investments"
          value={formatINR(live.totalInvestments)}
          icon={TrendingUp}
          tone="blue"
        />
        <BreakdownStat
          title="Credit cards"
          value={formatINR(live.creditCardOutstanding)}
          icon={TrendingDown}
          tone="amber"
        />
        <BreakdownStat
          title="Loans"
          value={formatINR(live.loanOutstanding)}
          icon={Landmark}
          tone="rose"
        />
      </div>

      <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <h3 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase sm:mb-4">
          Net worth trend
        </h3>
        <div className="h-52 w-full min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="nwModuleFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F766E" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0F766E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                stroke="currentColor"
                className="text-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => formatINRCompact(v)}
                tick={{ fontSize: 10 }}
                stroke="currentColor"
                className="text-muted-foreground"
                width={44}
              />
              <ChartTooltip />
              <Area
                type="monotone"
                dataKey="value"
                name="Net worth"
                stroke="#0F766E"
                fill="url(#nwModuleFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownList
          title="Assets"
          total={live.totalAssets}
          items={assetItems}
          empty="No assets yet — add accounts or investments."
          positive
        />
        <BreakdownList
          title="Liabilities"
          total={live.totalLiabilities}
          items={liabilityItems}
          empty="No liabilities — credit cards and loans will appear here."
          positive={false}
        />
      </div>

      <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Snapshots
        </h3>
        {snapshots.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No snapshots yet"
            description="Save a snapshot to start tracking net worth over time."
            action={
              <Button onClick={handleSnapshot} disabled={pending}>
                <Camera className="size-4" />
                Save snapshot
              </Button>
            }
            className="border-0 bg-transparent py-10"
          />
        ) : (
          <>
            <ul className="divide-y divide-border/50 sm:hidden">
              {[...snapshots].reverse().map((s) => (
                <li key={s.id} className="space-y-1.5 py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {formatDisplayDate(s.snapshot_date)}
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatINR(s.net_worth)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Cash {formatINR(s.total_cash)} · Inv{" "}
                    {formatINR(s.total_investments)} · Liab{" "}
                    {formatINR(s.total_liabilities)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto overscroll-x-contain sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Cash</th>
                    <th className="pb-3 font-medium">Investments</th>
                    <th className="pb-3 font-medium">Liabilities</th>
                    <th className="pb-3 font-medium text-right">Net worth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {[...snapshots].reverse().map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 whitespace-nowrap">
                        {formatDisplayDate(s.snapshot_date)}
                      </td>
                      <td className="py-3 tabular-nums">
                        {formatINR(s.total_cash)}
                      </td>
                      <td className="py-3 tabular-nums">
                        {formatINR(s.total_investments)}
                      </td>
                      <td className="py-3 tabular-nums">
                        {formatINR(s.total_liabilities)}
                      </td>
                      <td className="py-3 text-right font-medium tabular-nums">
                        {formatINR(s.net_worth)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BreakdownStat({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: typeof Wallet;
  tone: "teal" | "blue" | "amber" | "rose";
}) {
  const styles = {
    teal: {
      card: "from-teal-500/8 to-card",
      icon: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
    },
    blue: {
      card: "from-blue-500/8 to-card",
      icon: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    },
    amber: {
      card: "from-amber-500/8 to-card",
      icon: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    rose: {
      card: "from-rose-500/8 to-card",
      icon: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    },
  }[tone];

  return (
    <div
      className={`min-w-0 rounded-2xl border border-border/60 bg-gradient-to-br p-3 shadow-sm sm:p-5 ${styles.card}`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">
            {title}
          </p>
          <p className="mt-1.5 break-all font-heading text-base font-semibold tabular-nums sm:mt-2 sm:text-xl">
            {value}
          </p>
        </div>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl sm:size-10 ${styles.icon}`}
        >
          <Icon className="size-4 sm:size-5" />
        </span>
      </div>
    </div>
  );
}

function BreakdownList({
  title,
  total,
  items,
  empty,
  positive,
}: {
  title: string;
  total: number;
  items: NetWorthPageData["assetItems"];
  empty: string;
  positive: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-end justify-between gap-2">
        <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        <p
          className={cn(
            "shrink-0 font-heading text-base font-semibold tabular-nums sm:text-lg",
            positive
              ? "text-teal-800 dark:text-teal-300"
              : "text-rose-700 dark:text-rose-400"
          )}
        >
          {formatINR(total)}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.slice(0, 8).map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.label}</p>
                {item.subtitle && (
                  <p className="truncate text-xs text-muted-foreground capitalize">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatINR(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
