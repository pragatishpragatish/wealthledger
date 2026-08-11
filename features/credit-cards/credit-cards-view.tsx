"use client";

import { useState, useTransition } from "react";
import {
  CalendarClock,
  CreditCard,
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
import { CREDIT_CARD_REWARD_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deleteCreditCard } from "@/features/credit-cards/actions";
import { CreditCardForm } from "@/features/credit-cards/credit-card-form";
import type {
  CreditCardComputed,
  CreditCardsPageData,
} from "@/features/credit-cards/queries";

const rewardLabel = Object.fromEntries(
  CREDIT_CARD_REWARD_TYPES.map((r) => [r.value, r.label])
) as Record<string, string>;

function utilizationTone(pct: number) {
  if (pct >= 70) return "high";
  if (pct >= 40) return "mid";
  return "low";
}

export function CreditCardsView({ data }: { data: CreditCardsPageData }) {
  const { cards, summary } = data;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCardComputed | null>(null);
  const [deleting, setDeleting] = useState<CreditCardComputed | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(card: CreditCardComputed) {
    setEditing(card);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteCreditCard(deleting.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Card removed");
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Cards"
        description="Limits, utilization, statement dues and payment reminders."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add card
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          title="Total limit"
          value={formatINR(summary.totalLimit)}
          icon={CreditCard}
          accent="teal"
        />
        <SummaryTile
          title="Outstanding"
          value={formatINR(summary.totalOutstanding)}
          icon={Wallet}
          accent="amber"
        />
        <SummaryTile
          title="Available"
          value={formatINR(summary.totalAvailable)}
          icon={Wallet}
          accent="positive"
        />
        <SummaryTile
          title="Avg utilization"
          value={formatPercent(summary.avgUtilization)}
          icon={CalendarClock}
          accent="default"
        />
      </div>

      {summary.upcomingDue.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Upcoming dues
          </h3>
          <ul className="divide-y divide-border/60">
            {summary.upcomingDue.slice(0, 4).map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {card.bank} {card.card_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Statement due {formatDisplayDate(card.statement_due_date)} ·
                    Min {formatINR(card.minimum_due)}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums font-medium">
                  {formatINR(card.statement_amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No credit cards yet"
          description="Add a card to track utilization and payment dues."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add card
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, i) => {
            const tone = utilizationTone(card.utilization);
            return (
              <div
                key={card.id}
                className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-teal-500/5 to-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-semibold">
                      {card.card_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {card.bank}
                      {card.last_four ? ` · •••• ${card.last_four}` : ""}
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
                      <DropdownMenuItem onClick={() => openEdit(card)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleting(card)}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {rewardLabel[card.reward_type] ?? card.reward_type}
                  </Badge>
                  {card.has_payable_statement ? (
                    <Badge variant="outline">
                      Statement due {formatDisplayDate(card.statement_due_date)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      Next stmt {formatDisplayDate(card.next_statement_date)}
                    </Badge>
                  )}
                  {!card.has_payable_statement && card.unbilled_amount > 0 ? (
                    <Badge variant="secondary">
                      Unbilled {formatINR(card.unbilled_amount)}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className="font-heading text-xl font-semibold tabular-nums">
                        {formatINR(card.outstanding)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="text-sm font-medium tabular-nums">
                        {formatINR(card.available_credit)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Utilization</span>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          tone === "high" &&
                            "text-rose-600 dark:text-rose-400",
                          tone === "mid" &&
                            "text-amber-600 dark:text-amber-400",
                          tone === "low" &&
                            "text-teal-700 dark:text-teal-400"
                        )}
                      >
                        {formatPercent(card.utilization)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          tone === "high" && "bg-rose-600 dark:bg-rose-400",
                          tone === "mid" && "bg-amber-500",
                          tone === "low" && "bg-teal-600 dark:bg-teal-400"
                        )}
                        style={{
                          width: `${Math.min(100, Math.max(card.utilization, 1))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Limit</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatINR(card.credit_limit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Statement</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatINR(card.statement_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min due</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatINR(card.minimum_due)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Interest</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatPercent(card.interest_rate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Next statement</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatDisplayDate(card.next_statement_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {card.has_payable_statement
                          ? "Statement due"
                          : "Next due"}
                      </p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatDisplayDate(
                          card.has_payable_statement
                            ? card.statement_due_date
                            : card.next_due_date
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreditCardForm
        open={formOpen}
        onOpenChange={setFormOpen}
        card={editing}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Remove credit card?"
        description={
          deleting
            ? `"${deleting.bank} ${deleting.card_name}" will be deactivated.`
            : undefined
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
  icon: typeof CreditCard;
  accent: "default" | "positive" | "teal" | "amber";
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
