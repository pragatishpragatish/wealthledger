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

      <div
        className="rounded-2xl border border-border/60 bg-gradient-to-br from-teal-500/10 via-card to-card p-6 shadow-sm"
      >
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Current net worth
        </p>
        <p
          className={cn(
            "mt-2 font-heading text-4xl font-semibold tracking-tight tabular-nums",
            live.netWorth >= 0
              ? "text-teal-800 dark:text-teal-300"
              : "text-rose-700 dark:text-rose-400"
          )}
        >
          {formatINR(live.netWorth)}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            Assets{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatINR(live.totalAssets)}
            </span>
          </span>
          <span>
            Liabilities{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatINR(live.totalLiabilities)}
            </span>
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Net worth trend
        </h3>
        <div className="h-72 w-full">
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
                tick={{ fontSize: 12 }}
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

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
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
                    <td className="py-3">{formatDisplayDate(s.snapshot_date)}</td>
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
      className={`rounded-2xl border border-border/60 bg-gradient-to-br p-5 shadow-sm ${styles.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {title}
          </p>
          <p className="mt-2 font-heading text-xl font-semibold tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
        >
          <Icon className="size-5" />
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
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-2">
        <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        <p
          className={cn(
            "font-heading text-lg font-semibold tabular-nums",
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
