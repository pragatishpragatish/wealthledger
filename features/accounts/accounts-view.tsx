"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Building2,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
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
import { ACCOUNT_TYPES } from "@/lib/constants";
import { formatINR, maskAccountNumber } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import type { Account } from "@/types";
import type { AccountsSummary } from "@/features/accounts/queries";
import { deleteAccount } from "@/features/accounts/actions";
import { AccountForm } from "@/features/accounts/account-form";

const typeLabel = Object.fromEntries(
  ACCOUNT_TYPES.map((t) => [t.value, t.label])
) as Record<string, string>;

export function AccountsView({
  accounts,
  summary,
}: {
  accounts: Account[];
  summary: AccountsSummary;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [pending, startTransition] = useTransition();

  const maxBankBalance = useMemo(
    () => Math.max(...summary.byBank.map((b) => b.balance), 1),
    [summary.byBank]
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteAccount(deleting.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Account removed");
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Accounts"
        description="Manage savings, salary, current, cash and UPI wallets."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add account
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div
          className="rounded-2xl border border-border/60 bg-gradient-to-br from-teal-500/8 to-card p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Total cash
              </p>
              <p className="mt-2 font-heading text-2xl font-semibold tracking-tight tabular-nums">
                {formatINR(summary.totalCash)}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
              <Wallet className="size-5" />
            </span>
          </div>
        </div>

        <div
          className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Active accounts
              </p>
              <p className="mt-2 font-heading text-2xl font-semibold tracking-tight tabular-nums">
                {summary.accountCount}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
              <Landmark className="size-5" />
            </span>
          </div>
        </div>
      </div>

      {summary.byBank.length > 0 && (
        <div
          className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="size-4 text-teal-700 dark:text-teal-400" />
            <h2 className="font-heading text-sm font-semibold">Balance by bank</h2>
          </div>
          <ul className="space-y-3">
            {summary.byBank.map((row) => (
              <li key={row.bank} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{row.bank}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatINR(row.balance)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-teal-600 dark:bg-teal-400"
                    style={{
                      width: `${Math.max((row.balance / maxBankBalance) * 100, 2)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your first bank account or wallet to start tracking balances."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add account
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="overflow-x-auto overscroll-x-contain">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="hidden md:table-cell">Bank</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden lg:table-cell">Number</TableHead>
                <TableHead className="hidden xl:table-cell">Opened</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{account.name}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden">
                        {account.bank_name}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {account.bank_name}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">
                      {typeLabel[account.account_type] ?? account.account_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">
                    {maskAccountNumber(account.account_number)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">
                    {formatDisplayDate(account.opening_date)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(account.current_balance, { precise: true })}
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
                        <DropdownMenuItem onClick={() => openEdit(account)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(account)}
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

      <AccountForm
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Remove account?"
        description={
          deleting
            ? `"${deleting.name}" will be deactivated. Historical transactions stay intact.`
            : undefined
        }
        confirmLabel="Remove"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
