"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { cn } from "@/lib/utils";
import { formatINR } from "@/utils/currency";
import {
  formatDisplayDate,
  formatMonthKeyLabel,
  getMonthKey,
  shiftMonthKey,
} from "@/utils/date";
import type { Account, Category, Transaction, TransactionType } from "@/types";
import type {
  TransactionSort,
  TransactionsResult,
} from "@/features/transactions/queries";
import { deleteTransaction } from "@/features/transactions/actions";
import { TransactionForm } from "@/features/transactions/transaction-form";

type TransactionsPeriodMode = "month" | "range";

type AccountOption = Pick<
  Account,
  "id" | "name" | "bank_name" | "current_balance" | "account_type"
>;
type CategoryOption = Pick<Category, "id" | "name" | "kind" | "color">;

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
  { value: "adjustment", label: "Adjustment" },
];

const SORT_OPTIONS: { value: TransactionSort; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Amount high → low" },
  { value: "amount_asc", label: "Amount low → high" },
];

function typeBadge(type: TransactionType) {
  switch (type) {
    case "income":
      return {
        label: "Income",
        className:
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-transparent",
        icon: ArrowDownLeft,
      };
    case "expense":
      return {
        label: "Expense",
        className:
          "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-transparent",
        icon: ArrowUpRight,
      };
    case "transfer":
      return {
        label: "Transfer",
        className:
          "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-transparent",
        icon: ArrowLeftRight,
      };
    case "adjustment":
      return {
        label: "Adjustment",
        className:
          "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-transparent",
        icon: SlidersHorizontal,
      };
  }
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function transactionsToCsv(rows: Transaction[]) {
  const header = [
    "Date",
    "Type",
    "Amount",
    "Account",
    "To Account",
    "Category",
    "Merchant",
    "Payment Method",
    "Tags",
    "Notes",
  ];
  const lines = rows.map((t) =>
    [
      t.date,
      t.type,
      String(t.amount),
      t.account?.name ?? "",
      t.to_account?.name ?? "",
      t.category?.name ?? "",
      t.merchant ?? "",
      t.payment_method ?? "",
      (t.tags ?? []).map((tag) => tag.name).join("; "),
      t.notes ?? "",
    ]
      .map((v) => csvEscape(String(v)))
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TransactionsView({
  data,
  accounts,
  categories,
  filters,
}: {
  data: TransactionsResult;
  accounts: AccountOption[];
  categories: CategoryOption[];
  filters: {
    search: string;
    type: string;
    accountId: string;
    sort: TransactionSort;
    period: TransactionsPeriodMode;
    month: string;
    fromMonth: string;
    toMonth: string;
    from: string;
    to: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(filters.search);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [pending, startTransition] = useTransition();

  const updateParams = useCallback(
    (patch: Record<string, string | null | undefined>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      if (resetPage) params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  function goToMonthMode(monthKey = filters.month || getMonthKey()) {
    updateParams({
      period: "month",
      month: monthKey,
      fromMonth: null,
      toMonth: null,
      from: null,
      to: null,
    });
  }

  function goToRangeMode() {
    const start = filters.fromMonth || filters.month || getMonthKey();
    const end = filters.toMonth || start;
    updateParams({
      period: "range",
      month: null,
      fromMonth: start,
      toMonth: end,
      from: null,
      to: null,
    });
  }

  function shiftMonth(delta: number) {
    goToMonthMode(shiftMonthKey(filters.month || getMonthKey(), delta));
  }

  const pageLabel = useMemo(() => {
    if (data.total === 0) return "0 transactions";
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);
    return `${start}–${end} of ${data.total}`;
  }, [data]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(tx: Transaction) {
    setEditing(tx);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteTransaction(deleting.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transaction deleted");
      setDeleting(null);
    });
  }

  function handleExport() {
    if (data.transactions.length === 0) {
      toast.error("Nothing to export on this page");
      return;
    }
    const csv = transactionsToCsv(data.transactions);
    downloadCsv(
      `wealthledger-transactions-page-${data.page}.csv`,
      csv
    );
    toast.success("CSV downloaded");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Browse by month, jump across a custom month range, search, and export."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button onClick={openCreate} disabled={accounts.length === 0}>
              <Plus className="size-4" />
              Add transaction
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border/60 p-0.5">
              <button
                type="button"
                onClick={() => goToMonthMode()}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  filters.period === "month"
                    ? "bg-teal-500/15 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Month
              </button>
              <button
                type="button"
                onClick={goToRangeMode}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  filters.period === "range"
                    ? "bg-teal-500/15 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarRange className="size-3.5" />
                Range
              </button>
            </div>

            {filters.period === "month" ? (
              <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[9.5rem] text-center text-sm font-medium tabular-nums">
                  {formatMonthKeyLabel(filters.month)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="month"
                  value={filters.fromMonth}
                  onChange={(e) =>
                    updateParams({
                      period: "range",
                      fromMonth: e.target.value || null,
                      toMonth: filters.toMonth || e.target.value || null,
                      month: null,
                      from: null,
                      to: null,
                    })
                  }
                  aria-label="From month"
                  className="w-[10.5rem]"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="month"
                  value={filters.toMonth}
                  onChange={(e) =>
                    updateParams({
                      period: "range",
                      fromMonth: filters.fromMonth || e.target.value || null,
                      toMonth: e.target.value || null,
                      month: null,
                      from: null,
                      to: null,
                    })
                  }
                  aria-label="To month"
                  className="w-[10.5rem]"
                />
              </div>
            )}
          </div>

          {filters.period === "month" &&
            filters.month !== getMonthKey() && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => goToMonthMode(getMonthKey())}
              >
                This month
              </Button>
            )}
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <form
            className="relative lg:col-span-2"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              updateParams({ search: searchInput.trim() || null });
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search merchant or notes…"
              className="pl-8"
            />
          </form>

          <Select
            value={filters.type || "all"}
            onValueChange={(v) =>
              updateParams({ type: v === "all" || v == null ? null : v })
            }
            items={Object.fromEntries(
              TYPE_FILTERS.map((t) => [t.value, t.label])
            )}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.accountId || "all"}
            onValueChange={(v) =>
              updateParams({
                accountId: v === "all" || v == null ? null : v,
              })
            }
            items={[
              { value: "all", label: "All accounts" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Select
            value={filters.sort}
            onValueChange={(v) => {
              if (v) updateParams({ sort: v });
            }}
            items={SORT_OPTIONS.map((s) => ({
              value: s.value,
              label: s.label,
            }))}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{pageLabel}</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Add an account first"
          description="Transactions need at least one bank account or wallet."
          action={
            <Link
              href="/accounts"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Go to Accounts
            </Link>
          }
        />
      ) : data.transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions found"
          description="Try adjusting filters or add your first transaction."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add transaction
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
                <TableHead>Details</TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transactions.map((tx) => {
                const badge = typeBadge(tx.type);
                const Icon = badge.icon;
                const signed =
                  tx.type === "expense"
                    ? -tx.amount
                    : tx.type === "transfer"
                      ? tx.amount
                      : tx.amount;

                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDisplayDate(tx.date)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {tx.merchant ||
                            tx.category?.name ||
                            (tx.type === "transfer"
                              ? "Transfer"
                              : tx.type === "adjustment"
                                ? "Adjustment"
                                : "Transaction")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            tx.category?.name,
                            tx.tags && tx.tags.length > 0
                              ? tx.tags.map((t) => t.name).join(", ")
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                        {tx.notes ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {tx.notes}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="min-w-0 text-sm">
                        <p className="truncate">{tx.account?.name ?? "—"}</p>
                        {tx.type === "transfer" && tx.to_account && (
                          <p className="truncate text-xs text-muted-foreground">
                            → {tx.to_account.name}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge className={cn(badge.className)}>
                        <Icon className="size-3" />
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        tx.type === "income" || tx.type === "adjustment"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : tx.type === "expense"
                            ? "text-rose-700 dark:text-rose-400"
                            : ""
                      )}
                    >
                      {tx.type === "expense"
                        ? `-${formatINR(tx.amount, { precise: true })}`
                        : tx.type === "income" || tx.type === "adjustment"
                          ? `+${formatINR(tx.amount, { precise: true })}`
                          : formatINR(signed, { precise: true })}
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
                          <DropdownMenuItem onClick={() => openEdit(tx)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleting(tx)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() =>
                updateParams({ page: String(data.page - 1) }, false)
              }
            >
              Previous
            </Button>
            <p className="text-xs text-muted-foreground">
              Page {data.page} of {data.totalPages}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() =>
                updateParams({ page: String(data.page + 1) }, false)
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editing}
        accounts={accounts}
        categories={categories}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete transaction?"
        description="Account balances will be reversed to undo this entry."
        confirmLabel="Delete"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
