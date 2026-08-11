"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarClock,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { formatINR, formatPercent } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { LOAN_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deleteLoan } from "@/features/loans/actions";
import { LoanForm } from "@/features/loans/loan-form";
import type { LoanComputed, LoansPageData } from "@/features/loans/queries";

const typeLabel = Object.fromEntries(
  LOAN_TYPES.map((t) => [t.value, t.label])
) as Record<string, string>;

export function LoansView({ data }: { data: LoansPageData }) {
  const { loans, summary, accounts } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LoanComputed | null>(null);
  const [deleting, setDeleting] = useState<LoanComputed | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(loan: LoanComputed) {
    setEditing(loan);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteLoan(deleting.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Loan removed");
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        description="EMI modes, amortization, prepayment simulator and interest savings."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add loan
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile
          title="Total outstanding"
          value={formatINR(summary.totalOutstanding)}
          icon={Landmark}
          accent="amber"
        />
        <SummaryTile
          title="Total EMI"
          value={formatINR(summary.totalEmi)}
          icon={Banknote}
          accent="teal"
        />
        <SummaryTile
          title="Active loans"
          value={String(summary.count)}
          icon={CalendarClock}
          accent="default"
        />
      </div>

      {loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans yet"
          description="Add a home, car or personal loan to track EMI and prepayments."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add loan
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loans.map((loan, i) => (
            <div
              key={loan.id}
              className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-amber-500/5 to-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/loans/${loan.id}`}
                    className="truncate font-heading text-base font-semibold hover:underline"
                  >
                    {loan.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {loan.bank} · {typeLabel[loan.loan_type] ?? loan.loan_type}
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
                    <DropdownMenuItem
                      render={<Link href={`/loans/${loan.id}`} />}
                    >
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEdit(loan)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleting(loan)}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <Badge variant="secondary">
                  {loan.interest_type === "flat" ? "Flat" : "Reducing"}
                </Badge>
                <Badge variant="outline">
                  {formatPercent(loan.interest_rate)} p.a.
                </Badge>
                <Badge variant="outline">
                  {loan.emis_paid}/{loan.tenure_months} EMIs
                </Badge>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="font-heading text-xl font-semibold tabular-nums">
                      {formatINR(loan.outstanding_principal)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">EMI</p>
                    <p className="text-sm font-medium tabular-nums">
                      {formatINR(loan.emi)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium tabular-nums">
                      {formatPercent(loan.progress_percent)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-teal-600 transition-all dark:bg-teal-400"
                      style={{
                        width: `${Math.min(100, Math.max(loan.progress_percent, 1))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Remaining</p>
                    <p className="mt-0.5 font-medium tabular-nums">
                      {loan.remaining_months} mo
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p className="mt-0.5 font-medium">
                      {formatDisplayDate(loan.start_date)}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/loans/${loan.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full"
                  )}
                >
                  Open details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <LoanForm
        open={formOpen}
        onOpenChange={setFormOpen}
        loan={editing}
        accounts={accounts}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Remove loan?"
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
  icon: typeof Landmark;
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
