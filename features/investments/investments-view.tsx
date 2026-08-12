"use client";

import { useState, useTransition } from "react";
import {
  History,
  LineChart,
  MoreHorizontal,
  Pencil,
  Plus,
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
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { AllocationChart } from "@/features/dashboard/lazy-charts";
import { formatINR, formatPercent, formatSignedINR } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { INVESTMENT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deleteInvestment } from "@/features/investments/actions";
import { InvestmentForm } from "@/features/investments/investment-form";
import { ContributionForm } from "@/features/investments/contribution-form";
import { ContributionHistoryDialog } from "@/features/investments/contribution-history-dialog";
import type {
  InvestmentComputed,
  InvestmentsPageData,
} from "@/features/investments/queries";

const typeLabel = Object.fromEntries(
  INVESTMENT_TYPES.map((t) => [t.value, t.label])
) as Record<string, string>;

export function InvestmentsView({ data }: { data: InvestmentsPageData }) {
  const { investments, summary } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentComputed | null>(null);
  const [contributing, setContributing] = useState<InvestmentComputed | null>(
    null
  );
  const [historyFor, setHistoryFor] = useState<InvestmentComputed | null>(null);
  const [deleting, setDeleting] = useState<InvestmentComputed | null>(null);
  const [pending, startTransition] = useTransition();

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        description="Track holdings and log each top-up with its date — same fund, many entries."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add investment
          </Button>
        }
      />

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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <AllocationChart title="Allocation by type" data={summary.allocation} />
        </div>
        <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
          <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Holdings ({summary.count})
          </h3>
          {investments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No holdings yet.</p>
          ) : (
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
          )}
        </div>
      </div>

      {investments.length === 0 ? (
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
      ) : (
        <>
          {/* Mobile: stacked cards */}
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

          {/* Desktop table */}
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
      />

      <ContributionForm
        open={Boolean(contributing)}
        onOpenChange={(open) => {
          if (!open) setContributing(null);
        }}
        investment={contributing}
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
