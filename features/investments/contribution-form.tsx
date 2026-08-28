"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toDateString } from "@/utils/date";
import { formatINR } from "@/utils/currency";
import {
  contributionSchema,
  resolveTradeAmounts,
  supportsUnitTrades,
  type ContributionFormValues,
} from "@/features/investments/schemas";
import { addInvestmentContribution } from "@/features/investments/actions";
import {
  filterFundingAccounts,
  fundingHint,
  investmentFundingKind,
  matchBrokerWalletByPlatform,
} from "@/features/investments/funding";
import type { InvestmentComputed } from "@/features/investments/summary";
import type { InvestmentFundingAccount } from "@/features/investments/queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: InvestmentComputed | null;
  accounts?: InvestmentFundingAccount[];
};

export function ContributionForm({
  open,
  onOpenChange,
  investment,
  accounts = [],
}: Props) {
  const [pending, startTransition] = useTransition();
  const fundingKind = investment
    ? investmentFundingKind(investment.type)
    : "bank";
  const fundingAccounts = useMemo(
    () => filterFundingAccounts(accounts, fundingKind),
    [accounts, fundingKind]
  );
  const unitTrades = investment
    ? supportsUnitTrades(investment.type)
    : false;

  const form = useForm<
    z.input<typeof contributionSchema>,
    unknown,
    ContributionFormValues
  >({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      date: toDateString(new Date()),
      amount: undefined,
      units: undefined,
      price: undefined,
      notes: null,
      account_id: null,
      debit_account: true,
    },
  });

  const debitAccount = useWatch({ control: form.control, name: "debit_account" });
  const watchedUnits = useWatch({ control: form.control, name: "units" });
  const watchedPrice = useWatch({ control: form.control, name: "price" });
  const watchedAmount = useWatch({ control: form.control, name: "amount" });

  const preview = useMemo(
    () =>
      resolveTradeAmounts({
        amount: Number(watchedAmount) || 0,
        units: Number(watchedUnits) || 0,
        price: Number(watchedPrice) || 0,
      }),
    [watchedAmount, watchedUnits, watchedPrice]
  );

  useEffect(() => {
    if (!open) return;
    const matched =
      fundingKind === "broker"
        ? matchBrokerWalletByPlatform(
            fundingAccounts,
            investment?.platform
          )
        : null;
    form.reset({
      date: toDateString(new Date()),
      amount: undefined,
      units: undefined,
      price: investment?.current_price || undefined,
      notes: null,
      account_id: matched?.id ?? fundingAccounts[0]?.id ?? null,
      debit_account: true,
    });
  }, [open, form, fundingAccounts, fundingKind, investment?.platform, investment?.current_price]);

  function onSubmit(values: ContributionFormValues) {
    if (!investment) return;
    startTransition(async () => {
      const result = await addInvestmentContribution(investment.id, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const trade = resolveTradeAmounts(values);
      toast.success(
        trade.units > 0
          ? `Added ${trade.units} units · ${formatINR(trade.amount)} to ${investment.name}`
          : `Added ${formatINR(trade.amount)} to ${investment.name}`
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {unitTrades ? "Buy more · " : "Add to "}
            {investment?.name ?? "investment"}
          </DialogTitle>
          <DialogDescription>
            {unitTrades
              ? "Add units at today’s price / NAV. Average cost updates automatically."
              : "Log another purchase into the same holding. Each entry keeps its own date."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 py-1"
          autoComplete="off"
        >
          {investment && unitTrades ? (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Current{" "}
              <span className="font-medium text-foreground tabular-nums">
                {investment.units}
              </span>{" "}
              units · avg{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatINR(investment.buy_price, { precise: true })}
              </span>
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contrib-date">Date</Label>
              <Input
                id="contrib-date"
                type="date"
                {...form.register("date")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contrib-amount">Amount (₹)</Label>
              <Input
                id="contrib-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder={
                  unitTrades ? "Or leave blank if units × price" : "e.g. 5000"
                }
                {...form.register("amount")}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contrib-units">
                {unitTrades ? "Units bought" : "Units (optional)"}
              </Label>
              <Input
                id="contrib-units"
                type="number"
                step="any"
                min="0"
                placeholder={unitTrades ? "e.g. 12.5" : undefined}
                {...form.register("units")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contrib-price">
                {unitTrades ? "Price / NAV" : "Price / NAV (optional)"}
              </Label>
              <Input
                id="contrib-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Per unit"
                {...form.register("price")}
              />
            </div>
          </div>

          {preview.amount > 0 && (preview.units > 0 || preview.price > 0) ? (
            <p className="text-xs text-muted-foreground">
              {preview.units > 0
                ? `Adds ${preview.units} units for ${formatINR(preview.amount)}`
                : `Adds ${formatINR(preview.amount)}`}
              {preview.price > 0
                ? ` @ ${formatINR(preview.price, { precise: true })}`
                : ""}
            </p>
          ) : null}

          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  Paid from{" "}
                  {fundingKind === "broker" ? "broker wallet" : "bank account"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {fundingHint(fundingKind)}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border"
                  checked={debitAccount !== false}
                  onChange={(e) =>
                    form.setValue("debit_account", e.target.checked)
                  }
                />
                Deduct now
              </label>
            </div>
            {debitAccount !== false ? (
              fundingAccounts.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {fundingKind === "broker"
                    ? "No broker wallets available."
                    : "No bank accounts available."}
                </p>
              ) : (
                <Controller
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? null}
                      onValueChange={(v) =>
                        field.onChange(v === "" || v == null ? null : v)
                      }
                      items={Object.fromEntries(
                        fundingAccounts.map((a) => [
                          a.id,
                          `${a.bank_name} · ${a.name} (${formatINR(a.current_balance)})`,
                        ])
                      )}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {fundingAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.bank_name} · {a.name} (
                            {formatINR(a.current_balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )
            ) : null}
            {form.formState.errors.account_id && (
              <p className="text-xs text-destructive">
                {form.formState.errors.account_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrib-notes">Notes</Label>
            <Textarea
              id="contrib-notes"
              rows={2}
              placeholder="Optional"
              {...form.register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !investment}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {unitTrades ? "Buy units" : "Add money"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
