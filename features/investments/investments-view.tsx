"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowUpDown,
  CandlestickChart,
  History,
  LineChart,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { AllocationChart } from "@/features/dashboard/lazy-charts";
import { formatINR, formatPercent, formatSignedINR } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { INVESTMENT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  deleteInvestment,
  refreshInvestmentPrices,
} from "@/features/investments/actions";
import { InvestmentForm } from "@/features/investments/investment-form";
import { ContributionForm } from "@/features/investments/contribution-form";
import { ContributionHistoryDialog } from "@/features/investments/contribution-history-dialog";
import {
  summarizeInvestments,
  type InvestmentComputed,
} from "@/features/investments/summary";
import type { InvestmentsPageDataWithAccounts } from "@/features/investments/queries";
import { TradingPnlDialog } from "@/features/investments/trading-pnl-dialog";
import { canAutoPrice } from "@/lib/market-data/update-prices";

const typeLabel = Object.fromEntries(
  INVESTMENT_TYPES.map((t) => [t.value, t.label])
) as Record<string, string>;

const SORT_OPTIONS = [
  { value: "value-desc", label: "Value · high to low" },
  { value: "value-asc", label: "Value · low to high" },
  { value: "invested-desc", label: "Invested · high to low" },
  { value: "gain-desc", label: "Gain · high to low" },
  { value: "gain-asc", label: "Gain · low to high" },
  { value: "gain-pct-desc", label: "Return % · high to low" },
  { value: "name-asc", label: "Name · A to Z" },
  { value: "name-desc", label: "Name · Z to A" },
  { value: "type-asc", label: "Type" },
  { value: "platform-asc", label: "Broker" },
  { value: "date-desc", label: "Purchase date · newest" },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]["value"];

function sortInvestments(
  list: InvestmentComputed[],
  sort: SortId
): InvestmentComputed[] {
  const next = [...list];
  const cmp = (a: number, b: number) => a - b;
  next.sort((a, b) => {
    switch (sort) {
      case "value-desc":
        return cmp(b.current_value, a.current_value);
      case "value-asc":
        return cmp(a.current_value, b.current_value);
      case "invested-desc":
        return cmp(b.invested_amount, a.invested_amount);
      case "gain-desc":
        return cmp(b.gain, a.gain);
      case "gain-asc":
        return cmp(a.gain, b.gain);
      case "gain-pct-desc":
        return cmp(b.gain_percent, a.gain_percent);
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "type-asc":
        return (typeLabel[a.type] ?? a.type).localeCompare(
          typeLabel[b.type] ?? b.type
        );
      case "platform-asc":
        return (a.platform ?? "zzz").localeCompare(b.platform ?? "zzz");
      case "date-desc":
        return (b.purchase_date ?? "").localeCompare(a.purchase_date ?? "");
      default:
        return 0;
    }
  });
  return next;
}

export function InvestmentsView({
  data,
}: {
  data: InvestmentsPageDataWithAccounts;
}) {
  const { investments: allInvestments, accounts } = data;
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [brokerFilter, setBrokerFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortId>("value-desc");

  const [formOpen, setFormOpen] = useState(false);
  const [tradingOpen, setTradingOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentComputed | null>(null);
  const [contributing, setContributing] = useState<InvestmentComputed | null>(
    null
  );
  const [historyFor, setHistoryFor] = useState<InvestmentComputed | null>(null);
  const [deleting, setDeleting] = useState<InvestmentComputed | null>(null);
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();

  const pricedCount = useMemo(
    () =>
      allInvestments.filter(
        (i) => canAutoPrice(i.type) && Boolean(i.symbol?.trim())
      ).length,
    [allInvestments]
  );

  const canRefreshPrices = useMemo(
    () => allInvestments.some((i) => canAutoPrice(i.type)),
    [allInvestments]
  );

  const brokerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const inv of allInvestments) {
      const p = inv.platform?.trim();
      if (p) set.add(p);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allInvestments]);

  const typeOptions = useMemo(() => {
    const present = new Set(allInvestments.map((i) => i.type));
    return INVESTMENT_TYPES.filter((t) => present.has(t.value));
  }, [allInvestments]);

  const filtered = useMemo(() => {
    return allInvestments.filter((inv) => {
      if (typeFilter !== "all" && inv.type !== typeFilter) return false;
      if (brokerFilter === "all") return true;
      if (brokerFilter === "__none__") {
        return !inv.platform?.trim();
      }
      return (inv.platform ?? "") === brokerFilter;
    });
  }, [allInvestments, typeFilter, brokerFilter]);

  const investments = useMemo(
    () => sortInvestments(filtered, sort),
    [filtered, sort]
  );

  const summary = useMemo(
    () => summarizeInvestments(investments),
    [investments]
  );

  const hasUnspecifiedBroker = useMemo(
    () => allInvestments.some((i) => !i.platform?.trim()),
    [allInvestments]
  );

  const filtersActive = typeFilter !== "all" || brokerFilter !== "all";

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(inv: InvestmentComputed) {
    setEditing(inv);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteInvestment(deleting.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Investment removed");
      setDeleting(null);
    });
  }

  function handleRefreshPrices() {
    if (pricedCount === 0) {
      toast.message(
        "Add a Yahoo ticker (e.g. RELIANCE.NS) or AMFI scheme code on each holding first"
      );
      return;
    }
    startRefresh(async () => {
      const result = await refreshInvestmentPrices();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Prices updated");
    });
  }

  function clearFilters() {
    setTypeFilter("all");
    setBrokerFilter("all");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        description="Track holdings and log each top-up with its date — same fund, many entries."
        action={
          <div className="flex flex-wrap gap-2">
            {canRefreshPrices ? (
              <Button
                variant="outline"
                disabled={refreshing}
                onClick={handleRefreshPrices}
              >
                <RefreshCw
                  className={cn("size-4", refreshing && "animate-spin")}
                />
                Refresh prices
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setTradingOpen(true)}>
              <CandlestickChart className="size-4" />
              Trading P&L
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add investment
            </Button>
          </div>
        }
      />

      {allInvestments.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              if (v != null) setTypeFilter(v);
            }}
            items={{
              all: "All types",
              ...Object.fromEntries(
                typeOptions.map((t) => [t.value, t.label])
              ),
            }}
          >
            <SelectTrigger className="w-full sm:w-[11.5rem]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {typeOptions.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={brokerFilter}
            onValueChange={(v) => {
              if (v != null) setBrokerFilter(v);
            }}
            items={{
              all: "All brokers",
              ...Object.fromEntries(brokerOptions.map((b) => [b, b])),
              ...(hasUnspecifiedBroker
                ? { __none__: "No broker set" }
                : {}),
            }}
          >
            <SelectTrigger className="w-full sm:w-[11.5rem]">
              <SelectValue placeholder="Broker" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brokers</SelectItem>
              {brokerOptions.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
              {hasUnspecifiedBroker ? (
                <SelectItem value="__none__">No broker set</SelectItem>
              ) : null}
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(v) => {
              if (v != null) setSort(v as SortId);
            }}
            items={Object.fromEntries(
              SORT_OPTIONS.map((o) => [o.value, o.label])
            )}
          >
            <SelectTrigger className="w-full sm:w-[14rem]">
              <ArrowUpDown className="size-3.5 opacity-60" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="sm:ml-auto"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <SummaryTile
          title="Portfolio value"
          value={formatINR(summary.portfolioValue)}
          icon={Wallet}
          accent="teal"
        />
        <SummaryTile
          title="Invested"
          value={formatINR(summary.invested)}
          icon={LineChart}
          accent="default"
        />
        <SummaryTile
          title="Profit / Loss"
          value={formatSignedINR(summary.profitLoss)}
          icon={summary.profitLoss >= 0 ? TrendingUp : TrendingDown}
          accent={summary.profitLoss >= 0 ? "positive" : "amber"}
        />
        <SummaryTile
          title="Return"
          value={formatPercent(summary.profitLossPercent)}
          icon={summary.profitLossPercent >= 0 ? TrendingUp : TrendingDown}
          accent={summary.profitLossPercent >= 0 ? "positive" : "amber"}
        />
      </div>

      {allInvestments.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <AllocationChart
              title={
                filtersActive
                  ? "Allocation by type (filtered)"
                  : "Allocation by type"
              }
              data={summary.allocation}
            />
          </div>
          <div className="min-w-0">
            <AllocationChart
              title={
                filtersActive
                  ? "Allocation by broker (filtered)"
                  : "Allocation by broker"
              }
              data={summary.allocationByPlatform}
            />
          </div>
        </div>
      ) : null}

      {allInvestments.length > 0 && investments.length > 0 ? (
        <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
          <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Holdings ({summary.count}
            {filtersActive ? ` of ${allInvestments.length}` : ""})
          </h3>
          <ul className="divide-y divide-border/60">
            {investments.slice(0, 6).map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{inv.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {typeLabel[inv.type] ?? inv.type}
                    {inv.contribution_count > 0
                      ? ` · ${inv.contribution_count} entries`
                      : ""}
                    {inv.platform ? ` · ${inv.platform}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums font-medium">
                    {formatINR(inv.current_value)}
                  </p>
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      inv.gain >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {formatSignedINR(inv.gain)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {allInvestments.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="No investments yet"
          description="Add a fund once, then top it up anytime with dated entries."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add investment
            </Button>
          }
        />
      ) : investments.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="No matching investments"
          description="Try another type or broker, or clear filters."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {investments.map((inv) => {
              const latest = inv.contributions[0];
              return (
                <div
                  key={inv.id}
                  className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{inv.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {typeLabel[inv.type] ?? inv.type}
                        {inv.platform ? ` · ${inv.platform}` : ""}
                        {inv.symbol ? ` · ${inv.symbol}` : ""}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setContributing(inv)}>
                          <Plus className="size-4" />
                          Add money
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoryFor(inv)}>
                          <History className="size-4" />
                          View entries
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(inv)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(inv)}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Value</p>
                      <p className="font-medium tabular-nums">
                        {formatINR(inv.current_value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Invested</p>
                      <p className="tabular-nums">
                        {formatINR(inv.invested_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gain</p>
                      <p
                        className={cn(
                          "tabular-nums",
                          inv.gain >= 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {formatSignedINR(inv.gain)}{" "}
                        <span className="text-xs">
                          ({formatPercent(inv.gain_percent)})
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Entries</p>
                      <p>{inv.contribution_count || 1}</p>
                    </div>
                  </div>
                  {latest && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last +{formatINR(latest.amount)} ·{" "}
                      {formatDisplayDate(latest.date)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:block">
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium text-right">Invested</th>
                    <th className="px-4 py-3 font-medium text-right">Value</th>
                    <th className="px-4 py-3 font-medium text-right">Gain</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => {
                    const latest = inv.contributions[0];
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{inv.name}</p>
                          {inv.platform && (
                            <p className="text-xs text-muted-foreground">
                              {inv.platform}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary">
                              {typeLabel[inv.type] ?? inv.type}
                            </Badge>
                            {inv.contribution_count > 1 && (
                              <Badge className="bg-teal-600/15 text-teal-800 dark:text-teal-300">
                                {inv.contribution_count} entries
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatINR(inv.invested_amount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {formatINR(inv.current_value)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right tabular-nums",
                            inv.gain >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          )}
                        >
                          <div>{formatSignedINR(inv.gain)}</div>
                          <div className="text-xs">
                            {formatPercent(inv.gain_percent)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {inv.symbol && (
                            <div className="font-mono text-[11px]">
                              {inv.symbol}
                              {inv.last_priced_at
                                ? ` · priced ${formatDisplayDate(inv.last_priced_at.slice(0, 10))}`
                                : ""}
                            </div>
                          )}
                          {latest && (
                            <div>
                              Last +{formatINR(latest.amount)} ·{" "}
                              {formatDisplayDate(latest.date)}
                            </div>
                          )}
                          {inv.units > 0 && (
                            <div>
                              {inv.units} ×{" "}
                              {formatINR(inv.current_price, { precise: true })}
                            </div>
                          )}
                          {inv.maturity_date && (
                            <div>
                              Matures {formatDisplayDate(inv.maturity_date)}
                            </div>
                          )}
                          {inv.interest_rate != null && (
                            <div>{formatPercent(inv.interest_rate)} p.a.</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon-sm" />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Actions</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setContributing(inv)}
                              >
                                <Plus className="size-4" />
                                Add money
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setHistoryFor(inv)}
                              >
                                <History className="size-4" />
                                View entries
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(inv)}>
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleting(inv)}
                              >
                                <Trash2 className="size-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <InvestmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        investment={editing}
        accounts={accounts}
      />

      <ContributionForm
        open={Boolean(contributing)}
        onOpenChange={(open) => {
          if (!open) setContributing(null);
        }}
        investment={contributing}
        accounts={accounts}
      />

      <TradingPnlDialog
        open={tradingOpen}
        onOpenChange={setTradingOpen}
        accounts={accounts}
      />

      <ContributionHistoryDialog
        open={Boolean(historyFor)}
        onOpenChange={(open) => {
          if (!open) setHistoryFor(null);
        }}
        investment={historyFor}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Remove investment?"
        description={
          deleting ? `"${deleting.name}" will be deactivated.` : undefined
        }
        confirmLabel="Remove"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function SummaryTile({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  icon: typeof Wallet;
  accent: "default" | "positive" | "teal" | "amber";
}) {
  const accents = {
    default: "from-card to-card",
    positive: "from-emerald-500/5 to-card",
    teal: "from-teal-500/8 to-card",
    amber: "from-rose-500/8 to-card",
  };
  const icons = {
    default: "bg-muted text-foreground",
    positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    teal: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
    amber: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  };

  return (
    <div
      className={`min-w-0 rounded-2xl border border-border/60 bg-gradient-to-br p-3 shadow-sm sm:p-5 ${accents[accent]}`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">
            {title}
          </p>
          <p className="mt-1.5 break-all font-heading text-base font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-2xl">
            {value}
          </p>
        </div>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-xl sm:size-10 ${icons[accent]}`}
        >
          <Icon className="size-4 sm:size-5" />
        </span>
      </div>
    </div>
  );
}
