"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { formatINR, formatPercent } from "@/utils/currency";
import { cn } from "@/lib/utils";
import { deleteBudget } from "@/features/budgets/actions";
import { BudgetForm } from "@/features/budgets/budget-form";
import type {
  BudgetComputed,
  BudgetsPageData,
} from "@/features/budgets/queries";
import type { BudgetPeriod } from "@/types";

function warningMeta(level: BudgetComputed["warningLevel"]) {
  switch (level) {
    case 100:
      return {
        label: "Over budget",
        bar: "bg-rose-600 dark:bg-rose-400",
        text: "text-rose-600 dark:text-rose-400",
        badge: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      };
    case 90:
      return {
        label: "90% used",
        bar: "bg-orange-500",
        text: "text-orange-600 dark:text-orange-400",
        badge: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
      };
    case 75:
      return {
        label: "75% used",
        bar: "bg-amber-500",
        text: "text-amber-600 dark:text-amber-400",
        badge: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case 50:
      return {
        label: "50% used",
        bar: "bg-yellow-500",
        text: "text-yellow-700 dark:text-yellow-400",
        badge: "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300",
      };
    default:
      return {
        label: null,
        bar: "bg-teal-600 dark:bg-teal-400",
        text: "text-teal-700 dark:text-teal-400",
        badge: "",
      };
  }
}

export function BudgetsView({ data }: { data: BudgetsPageData }) {
  const router = useRouter();
  const { budgets, period, year, month, categories, summary } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetComputed | null>(null);
  const [deleting, setDeleting] = useState<BudgetComputed | null>(null);
  const [pending, startTransition] = useTransition();

  const warned = useMemo(
    () => budgets.filter((b) => b.warningLevel >= 50),
    [budgets]
  );

  function setPeriod(next: BudgetPeriod) {
    const params = new URLSearchParams();
    params.set("period", next);
    params.set("year", String(year));
    if (next === "monthly") params.set("month", String(month));
    router.push(`/budgets?${params.toString()}`);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(budget: BudgetComputed) {
    setEditing(budget);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteBudget(deleting.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Budget deleted");
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description="Category spending limits with live usage from expenses."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add budget
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={period}
          onValueChange={(v) => {
            if (v === "monthly" || v === "yearly") setPeriod(v);
          }}
        >
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">
          {period === "monthly"
            ? new Date(year, month - 1).toLocaleString("en-IN", {
                month: "long",
                year: "numeric",
              })
            : `Year ${year}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile title="Total budget" value={formatINR(summary.totalBudget)} />
        <SummaryTile title="Spent" value={formatINR(summary.totalSpent)} />
        <SummaryTile
          title="Remaining"
          value={formatINR(summary.totalRemaining)}
        />
        <SummaryTile
          title="Over budget"
          value={String(summary.overBudgetCount)}
        />
      </div>

      {warned.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4" />
            Usage warnings
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {warned.map((b) => {
              const meta = warningMeta(b.warningLevel);
              return (
                <li key={b.id}>
                  <span className="font-medium text-foreground">
                    {b.category?.name ?? "Category"}
                  </span>
                  {" · "}
                  {formatPercent(b.usagePercent)} used
                  {meta.label ? ` (${meta.label})` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          description="Create a category budget to track spending against limits."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add budget
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget, i) => {
            const meta = warningMeta(budget.warningLevel);
            return (
              <div
                key={budget.id}
                className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-semibold">
                      {budget.category?.name ?? "Uncategorized"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {budget.period} · {budget.year}
                      {budget.month
                        ? ` · ${new Date(2000, budget.month - 1).toLocaleString("en-IN", { month: "short" })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {meta.label && (
                      <Badge variant="outline" className={meta.badge}>
                        {meta.label}
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(budget)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(budget)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums">
                      {formatINR(budget.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Spent</p>
                    <p className={cn("mt-0.5 text-sm font-medium tabular-nums", meta.text)}>
                      {formatINR(budget.spent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p
                      className={cn(
                        "mt-0.5 text-sm font-medium tabular-nums",
                        budget.remaining < 0 && "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {formatINR(budget.remaining)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Usage</span>
                    <span className={cn("font-medium tabular-nums", meta.text)}>
                      {formatPercent(budget.usagePercent)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", meta.bar)}
                      style={{
                        width: `${Math.min(100, Math.max(budget.usagePercent, 0))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BudgetForm
        open={formOpen}
        onOpenChange={setFormOpen}
        budget={editing}
        categories={categories}
        defaultPeriod={period}
        defaultYear={year}
        defaultMonth={month}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete budget?"
        description={
          deleting
            ? `Remove the budget for "${deleting.category?.name ?? "category"}"?`
            : undefined
        }
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function SummaryTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-teal-500/5 to-card p-5 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <p className="mt-2 font-heading text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
