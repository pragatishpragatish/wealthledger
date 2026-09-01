"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Building2,
  Landmark,
  LineChart,
  MinusCircle,
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
import {
  createMissingBrokerWallets,
  deleteAccount,
} from "@/features/accounts/actions";
import { AccountForm } from "@/features/accounts/account-form";
import { BrokerChargesDialog } from "@/features/accounts/broker-charges-dialog";

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
  const [defaultBroker, setDefaultBroker] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [chargesAccount, setChargesAccount] = useState<Account | null>(null);
  const [pending, startTransition] = useTransition();
  const [brokerPending, startBrokerTransition] = useTransition();

  const maxBankBalance = useMemo(
    () => Math.max(...summary.byBank.map((b) => b.balance), 1),
    [summary.byBank]
  );

  const brokerAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "broker_wallet"),
    [accounts]
  );
  const otherAccounts = useMemo(
    () => accounts.filter((a) => a.account_type !== "broker_wallet"),
    [accounts]
  );

  function openCreate(broker = false) {
    setEditing(null);
    setDefaultBroker(broker);
    setFormOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setDefaultBroker(account.account_type === "broker_wallet");
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

  function openBrokerCharges(account?: Account) {
    setChargesAccount(account ?? null);
    setChargesOpen(true);
  }

  function handleAddAllBrokers() {
    startBrokerTransition(async () => {
      const result = await createMissingBrokerWallets();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const n = result.created ?? 0;
      toast.success(
        n === 0
          ? "All broker wallets already added"
          : `Added ${n} broker wallet${n === 1 ? "" : "s"}`
      );
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Banks, cash/UPI wallets, and stock broker wallet balances. Transfer between them anytime."
        action={
          <div className="flex flex-wrap gap-2">
            {brokerAccounts.length > 0 ? (
              <Button variant="outline" onClick={() => openBrokerCharges()}>
                <MinusCircle className="size-4" />
                Brokerage &amp; charges
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={handleAddAllBrokers}
              disabled={brokerPending}
            >
              <LineChart className="size-4" />
              {brokerPending ? "Adding…" : "Add all brokers"}
            </Button>
            <Button variant="outline" onClick={() => openCreate(true)}>
              <Plus className="size-4" />
              Broker wallet
            </Button>
            <Button onClick={() => openCreate(false)}>
              <Plus className="size-4" />
              Add account
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          title="Total liquid"
          value={formatINR(summary.totalCash)}
          icon={Wallet}
          accent="teal"
        />
        <SummaryTile
          title="Banks & wallets"
          value={formatINR(summary.bankAndWalletTotal)}
          icon={Landmark}
          accent="default"
        />
        <SummaryTile
          title="Broker wallets"
          value={formatINR(summary.brokerWalletTotal)}
          icon={LineChart}
          accent="amber"
        />
        <SummaryTile
          title="Active accounts"
          value={String(summary.accountCount)}
          icon={Building2}
          accent="default"
        />
      </div>

      {summary.byBank.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="size-4 text-teal-700 dark:text-teal-400" />
            <h2 className="font-heading text-sm font-semibold">
              Balance by institution
            </h2>
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
          description="Add a bank account or stock broker wallet, then transfer money between them."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={handleAddAllBrokers}>
                Add all brokers
              </Button>
              <Button onClick={() => openCreate(false)}>
                <Plus className="size-4" />
                Add account
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          {otherAccounts.length > 0 ? (
            <AccountTable
              title="Banks & wallets"
              accounts={otherAccounts}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Stock broker wallets
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddAllBrokers}
                  disabled={brokerPending}
                >
                  Add all brokers
                </Button>
                <Button size="sm" variant="outline" onClick={() => openCreate(true)}>
                  <Plus className="size-4" />
                  Add broker
                </Button>
              </div>
            </div>
            {brokerAccounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
                No broker wallets yet. Add Groww, Zerodha, Dhan, Lemonn and more —
                then transfer from your bank to fund them.
              </div>
            ) : (
              <AccountTable
                accounts={brokerAccounts}
                onEdit={openEdit}
                onDelete={setDeleting}
                onRecordCharges={openBrokerCharges}
              />
            )}
          </div>
        </div>
      )}

      <AccountForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setDefaultBroker(false);
        }}
        account={editing}
        defaultBroker={defaultBroker}
      />

      <BrokerChargesDialog
        open={chargesOpen}
        onOpenChange={(open) => {
          setChargesOpen(open);
          if (!open) setChargesAccount(null);
        }}
        accounts={accounts}
        defaultAccountId={chargesAccount?.id}
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

function AccountTable({
  title,
  accounts,
  onEdit,
  onDelete,
  onRecordCharges,
}: {
  title?: string;
  accounts: Account[];
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onRecordCharges?: (account: Account) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      {title ? (
        <div className="border-b border-border/50 px-4 py-3">
          <h2 className="font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {title}
          </h2>
        </div>
      ) : null}
      <div className="overflow-x-auto overscroll-x-contain">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="hidden md:table-cell">
                Bank / Broker
              </TableHead>
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
                  {account.account_type === "broker_wallet"
                    ? "—"
                    : maskAccountNumber(account.account_number)}
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
                      render={<Button variant="ghost" size="icon-sm" />}
                    >
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Actions</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onRecordCharges &&
                      account.account_type === "broker_wallet" ? (
                        <DropdownMenuItem
                          onClick={() => onRecordCharges(account)}
                        >
                          <MinusCircle className="size-4" />
                          Brokerage &amp; charges
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => onEdit(account)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(account)}
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
  accent: "default" | "teal" | "amber";
}) {
  const accents = {
    default: "from-card to-card",
    teal: "from-teal-500/8 to-card",
    amber: "from-amber-500/8 to-card",
  };
  const icons = {
    default: "bg-muted text-foreground",
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
            {value}
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
