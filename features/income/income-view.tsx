"use client";

import { useState, useTransition } from "react";
import {
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  TrendingUp,
  Wallet,
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
import { formatINR } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { RECURRING_FREQUENCIES } from "@/lib/constants";
import { deleteIncome } from "@/features/income/actions";
import type { IncomePageData, IncomeRow } from "@/features/income/queries";

const IncomeForm = dynamic(
  () =>
    import("@/features/income/income-form").then((m) => ({
      default: m.IncomeForm,
    })),
  { ssr: false }
);

const freqLabel = Object.fromEntries(
  RECURRING_FREQUENCIES.map((f) => [f.value, f.label])
) as Record<string, string>;

export function IncomeView({ data }: { data: IncomePageData }) {
  const { incomes, analytics, accounts, categories } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IncomeRow | null>(null);
  const [deleting, setDeleting] = useState<IncomeRow | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: IncomeRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteIncome(deleting.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Income deleted");
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income"
        description="Track salary, freelance, rental and other income with recurring support."
        action={
          <Button onClick={openCreate} disabled={accounts.length === 0}>
            <Plus className="size-4" />
            Add income
          </Button>
        }
      />

      {accounts.length === 0 && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Add a bank account first before recording income.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          title="This month"
          value={analytics.monthlyTotal}
          icon={TrendingUp}
          accent="teal"
        />
        <StatTile
          title="This year"
          value={analytics.yearlyTotal}
          icon={Wallet}
          accent="positive"
        />
        <StatTile
          title="Entries (month)"
          value={analytics.count}
          icon={CalendarClock}
          accent="default"
          isCount
        />
        <StatTile
          title="Recurring (month)"
          value={analytics.recurringCount}
          icon={Repeat}
          accent="amber"
          isCount
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AllocationChart
          title="Income by category (YTD)"
          data={analytics.categoryBreakdown}
        />
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Category share
          </h3>
          {analytics.categoryBreakdown.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No income categories yet
            </p>
          ) : (
            <ul className="space-y-3">
              {analytics.categoryBreakdown.slice(0, 6).map((item) => {
                const pct =
                  analytics.yearlyTotal > 0
                    ? (item.value / analytics.yearlyTotal) * 100
                    : 0;
                return (
                  <li key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatINR(item.value)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-teal-600 dark:bg-teal-400"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {incomes.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No income recorded"
          description="Add your first income entry to see analytics and history."
          action={
            <Button onClick={openCreate} disabled={accounts.length === 0}>
              <Plus className="size-4" />
              Add income
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="overflow-x-auto overscroll-x-contain">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="tabular-nums">
                    {formatDisplayDate(row.date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{row.category?.name ?? "Uncategorized"}</span>
                      {row.is_recurring && (
                        <Badge variant="secondary">
                          {row.recurring_frequency
                            ? freqLabel[row.recurring_frequency]
                            : "Recurring"}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.account
                      ? `${row.account.name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatINR(row.amount)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-muted-foreground">
                    {row.notes || "—"}
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
        </div>
      )}

      {formOpen ? (
        <IncomeForm
          open={formOpen}
          onOpenChange={setFormOpen}
          income={editing}
          accounts={accounts}
          categories={categories}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this income?"
        description="Account balance will be adjusted. This cannot be undone."
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
  accent,
  isCount,
}: {
  title: string;
  value: number;
  icon: typeof TrendingUp;
  accent: "default" | "positive" | "teal" | "amber";
  isCount?: boolean;
}) {
  const accents = {
    default: "from-card to-card",
    positive: "from-emerald-500/5 to-card",
    teal: "from-teal-500/8 to-card",
    amber: "from-amber-500/8 to-card",
  };
  const icons = {
    default: "bg-muted text-foreground",
    positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    teal: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
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
            {isCount ? value : formatINR(value)}
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
