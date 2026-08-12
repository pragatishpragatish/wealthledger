"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  CalendarRange,
  MoreHorizontal,
  Pencil,
  Plus,
  Store,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import dynamic from "next/dynamic";
import { AllocationChart } from "@/features/dashboard/lazy-charts";
import { formatINR, formatPercent } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { PAYMENT_METHODS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deleteExpense } from "@/features/expenses/actions";
import type { ExpenseRow, ExpensesPageData } from "@/features/expenses/queries";

const ExpenseForm = dynamic(
  () =>
    import("@/features/expenses/expense-form").then((m) => ({
      default: m.ExpenseForm,
    })),
  { ssr: false }
);

const methodLabel = Object.fromEntries(
  PAYMENT_METHODS.map((p) => [p.value, p.label])
) as Record<string, string>;

export function ExpensesView({ data }: { data: ExpensesPageData }) {
  const { expenses, analytics, accounts, creditCards, categories } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null);
  const [pending, startTransition] = useTransition();
  const canAdd = accounts.length > 0 || creditCards.length > 0;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: ExpenseRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteExpense(deleting.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Expense deleted");
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Categorized spending with merchants, budgets and analytics."
        action={
          <Button onClick={openCreate} disabled={!canAdd}>
            <Plus className="size-4" />
            Add expense
          </Button>
        }
      />

      {!canAdd && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Add a bank account or credit card before recording expenses.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile title="Today" value={analytics.dailyTotal} icon={TrendingDown} />
        <StatTile
          title="This week"
          value={analytics.weeklyTotal}
          icon={CalendarDays}
          accent="amber"
        />
        <StatTile
          title="This month"
          value={analytics.monthlyTotal}
          icon={CalendarRange}
          accent="negative"
        />
        <StatTile
          title="This year"
          value={analytics.yearlyTotal}
          icon={Store}
          accent="default"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AllocationChart
          title="Spending by category (YTD)"
          data={analytics.categoryBreakdown}
        />

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Top merchants
          </h3>
          {analytics.topMerchants.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No merchant data yet
            </p>
          ) : (
            <ul className="space-y-3">
              {analytics.topMerchants.map((m, i) => (
                <li
                  key={m.merchant}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.count} {m.count === 1 ? "txn" : "txns"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium">
                    {formatINR(m.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {analytics.budgetComparisons.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Budget vs spent (this month)
          </h3>
          <ul className="space-y-4">
            {analytics.budgetComparisons.map((b) => {
              const over = b.percent > 100;
              return (
                <li key={b.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{b.categoryName}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatINR(b.spent)} / {formatINR(b.budgetAmount)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        over
                          ? "bg-rose-600 dark:bg-rose-400"
                          : b.percent > 80
                            ? "bg-amber-500"
                            : "bg-teal-600 dark:bg-teal-400"
                      )}
                      style={{ width: `${Math.min(100, b.percent)}%` }}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-xs",
                      over
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatPercent(b.percent)} used
                    {over ? " · over budget" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="No expenses yet"
          description="Log your first expense to unlock spending analytics."
          action={
            <Button onClick={openCreate} disabled={!canAdd}>
              <Plus className="size-4" />
              Add expense
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden lg:table-cell">Paid from</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="tabular-nums">
                    {formatDisplayDate(row.date)}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {row.merchant || "—"}
                      </p>
                      {row.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.tags.slice(0, 3).map((t) => (
                            <Badge key={t.id} variant="secondary">
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {row.category?.name ?? "Uncategorized"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {row.credit_card
                      ? `${row.credit_card.card_name} · ${row.credit_card.bank}`
                      : row.account
                        ? `${row.account.name} · ${row.account.bank_name}`
                        : row.payment_method
                          ? methodLabel[row.payment_method] ??
                            row.payment_method
                          : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-rose-700 dark:text-rose-400">
                    {formatINR(row.amount)}
                  </TableCell>
                  <TableCell>
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
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {formOpen ? (
        <ExpenseForm
          open={formOpen}
          onOpenChange={setFormOpen}
          expense={editing}
          accounts={accounts}
          creditCards={creditCards}
          categories={categories}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this expense?"
        description={
          deleting?.credit_card_id
            ? "Credit card outstanding will be reduced. This cannot be undone."
            : "Account balance will be restored. This cannot be undone."
        }
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function StatTile({
  title,
  value,
  icon: Icon,
  accent = "negative",
}: {
  title: string;
  value: number;
  icon: typeof TrendingDown;
  accent?: "default" | "negative" | "amber";
}) {
  const accents = {
    default: "from-card to-card",
    negative: "from-rose-500/5 to-card",
    amber: "from-amber-500/8 to-card",
  };
  const icons = {
    default: "bg-muted text-foreground",
    negative: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };

  return (
    <div
      className={`rounded-2xl border border-border/60 bg-gradient-to-br p-5 shadow-sm ${accents[accent]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {title}
          </p>
          <p className="mt-2 font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {formatINR(value)}
          </p>
        </div>
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${icons[accent]}`}
        >
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}
