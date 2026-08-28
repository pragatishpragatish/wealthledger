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
  resolveTradeAmounts,
  supportsUnitTrades,
  withdrawalSchema,
  type WithdrawalFormValues,
} from "@/features/investments/schemas";
import { sellInvestmentUnits } from "@/features/investments/actions";
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

export function WithdrawalForm({
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

  const form = useForm<
    z.input<typeof withdrawalSchema>,
    unknown,
    WithdrawalFormValues
  >({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      date: toDateString(new Date()),
      amount: undefined,
      units: undefined,
      price: undefined,
      notes: null,
      account_id: null,
      credit_account: true,
      close_if_empty: true,
    },
  });

  const creditAccount = useWatch({
    control: form.control,
    name: "credit_account",
  });
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
    if (!open || !investment) return;
    const matched =
      fundingKind === "broker"
        ? matchBrokerWalletByPlatform(fundingAccounts, investment.platform)
        : null;
    form.reset({
      date: toDateString(new Date()),
      amount: undefined,
      units: undefined,
      price: investment.current_price || undefined,
      notes: null,
      account_id: matched?.id ?? fundingAccounts[0]?.id ?? null,
      credit_account: true,
      close_if_empty: true,
    });
  }, [open, form, fundingAccounts, fundingKind, investment]);

  function sellAll() {
    if (!investment?.units) return;
    form.setValue("units", investment.units, { shouldValidate: true });
    const price =
      Number(form.getValues("price")) || investment.current_price || 0;
    if (price > 0) {
      form.setValue("amount", Math.round(investment.units * price * 100) / 100, {
        shouldValidate: true,
      });
    }
  }

  function onSubmit(values: WithdrawalFormValues) {
    if (!investment) return;
    startTransition(async () => {
      const result = await sellInvestmentUnits(investment.id, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const trade = resolveTradeAmounts(values);
      toast.success(
        `Sold ${trade.units} units · ${formatINR(trade.amount)} from ${investment.name}`
      );
      onOpenChange(false);
    });
  }

  const canTrade = investment ? supportsUnitTrades(investment.type) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            Withdraw from {investment?.name ?? "investment"}
          </DialogTitle>
          <DialogDescription>
            Partial or full sell / redemption. Cost basis uses average buy
            price; remaining units keep the updated average.
          </DialogDescription>
        </DialogHeader>

        {!canTrade ? (
          <p className="py-4 text-sm text-muted-foreground">
            Unit withdrawals are available for stocks, ETFs, mutual funds, and
            crypto.
          </p>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-1"
            autoComplete="off"
          >
            {investment && (
              <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Holding{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {investment.units}
                </span>{" "}
                units · avg cost{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {formatINR(investment.buy_price, { precise: true })}
                </span>{" "}
                · value{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {formatINR(investment.current_value)}
                </span>
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wd-date">Date</Label>
                <Input id="wd-date" type="date" {...form.register("date")} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="wd-units">Units to sell</Label>
                  <button
                    type="button"
                    className="text-[11px] text-teal-700 hover:underline dark:text-teal-400"
                    onClick={sellAll}
                  >
                    Sell all
                  </button>
                </div>
                <Input
                  id="wd-units"
                  type="number"
                  step="any"
                  min="0"
                  max={investment?.units}
                  placeholder="e.g. 10"
                  {...form.register("units")}
                />
                {form.formState.errors.units && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.units.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wd-price">Sale price / NAV</Label>
                <Input
                  id="wd-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Per unit"
                  {...form.register("price")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wd-amount">Proceeds (₹)</Label>
                <Input
                  id="wd-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Auto from units × price"
                  {...form.register("amount")}
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>
            </div>

            {preview.units > 0 && preview.amount > 0 ? (
              <p className="text-xs text-muted-foreground">
                Will sell{" "}
                <span className="tabular-nums text-foreground">
                  {preview.units}
                </span>{" "}
                units for{" "}
                <span className="tabular-nums text-foreground">
                  {formatINR(preview.amount)}
                </span>
                {investment && preview.units >= investment.units - 1e-9
                  ? " · closes holding"
                  : null}
              </p>
            ) : null}

            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    Credit{" "}
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
                    checked={creditAccount !== false}
                    onChange={(e) =>
                      form.setValue("credit_account", e.target.checked)
                    }
                  />
                  Credit now
                </label>
              </div>
              {creditAccount !== false ? (
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
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border"
                  checked={form.watch("close_if_empty") !== false}
                  onChange={(e) =>
                    form.setValue("close_if_empty", e.target.checked)
                  }
                />
                Close holding if units reach zero
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wd-notes">Notes</Label>
              <Textarea
                id="wd-notes"
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
                Confirm withdrawal
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
