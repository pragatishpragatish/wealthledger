"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CreditCard,
  FileText,
  Pencil,
  Percent,
  Split,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR, formatPercent } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";
import { CREDIT_CARD_REWARD_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { generateCreditCardStatement } from "@/features/credit-cards/actions";
import { CreditCardForm } from "@/features/credit-cards/credit-card-form";
import { CreditCardPaymentDialog } from "@/features/credit-cards/credit-card-payment-dialog";
import {
  ConvertToEmiDialog,
  RecordEmiPaymentDialog,
} from "@/features/credit-cards/credit-card-emi-dialogs";
import type { CreditCardDetailData } from "@/features/credit-cards/queries";
import type { CreditCardEmi } from "@/types";

const rewardLabel = Object.fromEntries(
  CREDIT_CARD_REWARD_TYPES.map((r) => [r.value, r.label])
) as Record<string, string>;

export function CreditCardDetailView({ data }: { data: CreditCardDetailData }) {
  const {
    card,
    activity,
    emis,
    accounts,
    revolvingBalance,
    estimatedMonthlyInterest,
    totalEmiOutstanding,
    totalMonthlyEmi,
  } = data;

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [payingEmi, setPayingEmi] = useState<CreditCardEmi | null>(null);
  const [pending, startTransition] = useTransition();

  function handleGenerateStatement() {
    startTransition(async () => {
      const result = await generateCreditCardStatement(card.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Statement generated from current outstanding");
    });
  }

  const activeEmis = emis.filter((e) => e.is_active);
  const utilTone =
    card.utilization >= 70
      ? "high"
      : card.utilization >= 40
        ? "mid"
        : "low";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/credit-cards"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="size-4" />
          Credit cards
        </Link>
      </div>

      <PageHeader
        title={card.card_name}
        description={`${card.bank}${card.last_four ? ` · •••• ${card.last_four}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button onClick={() => setPayOpen(true)} disabled={card.outstanding <= 0}>
              <Banknote className="size-4" />
              Pay
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">
          {rewardLabel[card.reward_type] ?? card.reward_type}
        </Badge>
        <Badge variant="outline">{formatPercent(card.interest_rate)} p.a.</Badge>
        {card.has_payable_statement ? (
          <Badge variant="outline">
            Due {formatDisplayDate(card.statement_due_date)}
          </Badge>
        ) : (
          <Badge variant="outline">
            Next stmt {formatDisplayDate(card.next_statement_date)}
          </Badge>
        )}
        {!card.is_active ? <Badge variant="destructive">Inactive</Badge> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Outstanding" value={formatINR(card.outstanding)} />
        <Stat label="Available" value={formatINR(card.available_credit)} />
        <Stat label="Credit limit" value={formatINR(card.credit_limit)} />
        <Stat label="Utilization" value={formatPercent(card.utilization)} />
        <Stat label="Statement" value={formatINR(card.statement_amount)} />
        <Stat label="Minimum due" value={formatINR(card.minimum_due)} />
        <Stat label="Unbilled" value={formatINR(card.unbilled_amount)} />
        <Stat
          label="Est. monthly interest"
          value={formatINR(estimatedMonthlyInterest)}
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Utilization</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              utilTone === "high" && "text-rose-600 dark:text-rose-400",
              utilTone === "mid" && "text-amber-600 dark:text-amber-400",
              utilTone === "low" && "text-teal-700 dark:text-teal-400"
            )}
          >
            {formatPercent(card.utilization)}
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              utilTone === "high" && "bg-rose-600 dark:bg-rose-400",
              utilTone === "mid" && "bg-amber-500",
              utilTone === "low" && "bg-teal-600 dark:bg-teal-400"
            )}
            style={{
              width: `${Math.min(100, Math.max(card.utilization, 1))}%`,
            }}
          />
        </div>
        {revolvingBalance > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Revolving (unpaid statement): {formatINR(revolvingBalance)}. Paying
            only the minimum accrues interest near{" "}
            {formatINR(estimatedMonthlyInterest)}/month at your card rate.
          </p>
        ) : null}
      </div>

      <Tabs defaultValue="activity">
        <TabsList variant="line" className="w-full flex-wrap justify-start">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="emi">EMI plans</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setPayOpen(true)} disabled={card.outstanding <= 0}>
              <Banknote className="size-4" />
              Pay from account
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConvertOpen(true)}
            >
              <Split className="size-4" />
              Convert to EMI
            </Button>
          </div>

          {activity.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No card activity yet"
              description="Expenses paid with this card and payments you record will show up here."
            />
          ) : (
            <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
              {activity.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {tx.merchant || tx.description || (tx.is_payment ? "Payment" : "Charge")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDisplayDate(tx.date)}
                      {tx.category?.name ? ` · ${tx.category.name}` : ""}
                      {tx.is_payment ? " · Payment" : ""}
                      {tx.converted_to_emi ? " · On EMI" : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums font-medium",
                      tx.is_payment
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-700 dark:text-rose-400"
                    )}
                  >
                    {tx.is_payment ? "+" : "−"}
                    {formatINR(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="emi" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Active EMI outstanding {formatINR(totalEmiOutstanding)} · Monthly{" "}
              {formatINR(totalMonthlyEmi)}
            </div>
            <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)}>
              <Split className="size-4" />
              New EMI
            </Button>
          </div>

          {emis.length === 0 ? (
            <EmptyState
              icon={Split}
              title="No EMI plans"
              description="Convert a large purchase into monthly installments."
              action={
                <Button size="sm" onClick={() => setConvertOpen(true)}>
                  Convert to EMI
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {emis.map((emi) => (
                <div
                  key={emi.id}
                  className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{emi.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Started {formatDisplayDate(emi.start_date)} ·{" "}
                        {formatPercent(emi.interest_rate)} p.a. ·{" "}
                        {emi.emis_paid}/{emi.tenure_months} paid
                        {!emi.is_active ? " · Closed" : ""}
                      </p>
                    </div>
                    {emi.is_active ? (
                      <Button
                        size="sm"
                        onClick={() => setPayingEmi(emi)}
                      >
                        Pay EMI
                      </Button>
                    ) : (
                      <Badge variant="secondary">Closed</Badge>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">EMI</p>
                      <p className="font-medium tabular-nums">
                        {formatINR(emi.emi_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Principal</p>
                      <p className="font-medium tabular-nums">
                        {formatINR(emi.principal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Remaining</p>
                      <p className="font-medium tabular-nums">
                        {formatINR(emi.outstanding_principal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Fee</p>
                      <p className="font-medium tabular-nums">
                        {formatINR(emi.processing_fee)}
                      </p>
                    </div>
                  </div>
                  {emi.is_active ? (
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-teal-600 dark:bg-teal-400"
                        style={{
                          width: `${Math.min(
                            100,
                            (emi.emis_paid / Math.max(emi.tenure_months, 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {activeEmis.length === 0 && emis.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              All EMI plans on this card are closed.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="size-4 text-teal-700 dark:text-teal-400" />
                Cycle
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Billing day</dt>
                  <dd className="font-medium">{card.billing_date}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Due day</dt>
                  <dd className="font-medium">{card.due_date}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Next statement</dt>
                  <dd className="font-medium">
                    {formatDisplayDate(card.next_statement_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {card.has_payable_statement ? "Statement due" : "Next due"}
                  </dt>
                  <dd className="font-medium">
                    {formatDisplayDate(
                      card.has_payable_statement
                        ? card.statement_due_date
                        : card.next_due_date
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Percent className="size-4 text-amber-700 dark:text-amber-400" />
                Interest snapshot
              </div>
              <p className="text-sm text-muted-foreground">
                If you carry {formatINR(revolvingBalance)} past the due date,
                roughly {formatINR(estimatedMonthlyInterest)} may accrue in a
                month at {formatPercent(card.interest_rate)} p.a. (illustrative).
              </p>
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                disabled={pending || card.outstanding <= 0}
                onClick={handleGenerateStatement}
              >
                <FileText className="size-4" />
                {pending ? "Updating…" : "Generate statement from outstanding"}
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Sets statement amount to current outstanding and resets paid
                toward statement — use on billing day.
              </p>
            </div>
          </div>

          {card.notes ? (
            <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground shadow-sm">
              {card.notes}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <CreditCardForm
        open={editOpen}
        onOpenChange={setEditOpen}
        card={card}
      />
      <CreditCardPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        card={card}
        accounts={accounts}
      />
      <ConvertToEmiDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        cardId={card.id}
        outstanding={card.outstanding}
        purchases={activity}
      />
      <RecordEmiPaymentDialog
        open={Boolean(payingEmi)}
        onOpenChange={(open) => {
          if (!open) setPayingEmi(null);
        }}
        cardId={card.id}
        emi={payingEmi}
        accounts={accounts}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-heading text-lg font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
