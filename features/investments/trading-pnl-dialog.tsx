"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { amountInWords } from "@/utils/amount-in-words";
import { formatINR } from "@/utils/currency";
import { toDateString } from "@/utils/date";
import {
  tradingPnlSchema,
  type TradingPnlFormValues,
} from "@/features/investments/schemas";
import { recordBrokerTradingPnl } from "@/features/investments/actions";
import type { InvestmentFundingAccount } from "@/features/investments/queries";

const ACTIVITIES = [
  { value: "fno", label: "F&O" },
  { value: "intraday", label: "Intraday" },
  { value: "other", label: "Other trading" },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: InvestmentFundingAccount[];
};

export function TradingPnlDialog({ open, onOpenChange, accounts }: Props) {
  const [pending, startTransition] = useTransition();
  const brokers = useMemo(
    () => accounts.filter((a) => a.account_type === "broker_wallet"),
    [accounts]
  );

  const form = useForm<
    z.input<typeof tradingPnlSchema>,
    unknown,
    TradingPnlFormValues
  >({
    resolver: zodResolver(tradingPnlSchema),
    defaultValues: {
      account_id: brokers[0]?.id ?? "",
      activity: "intraday",
      result: "profit",
      amount: undefined,
      date: toDateString(new Date()),
      notes: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      account_id: brokers[0]?.id ?? "",
      activity: "intraday",
      result: "profit",
      amount: undefined,
      date: toDateString(new Date()),
      notes: null,
    });
  }, [open, brokers, form]);

  const amountWatch = form.watch("amount");
  const amountNum =
    amountWatch === "" || amountWatch == null ? NaN : Number(amountWatch);
  const words =
    Number.isFinite(amountNum) && amountNum > 0
      ? amountInWords(amountNum)
      : null;

  function onSubmit(values: TradingPnlFormValues) {
    startTransition(async () => {
      const result = await recordBrokerTradingPnl(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        values.result === "profit"
          ? "Trading profit added to broker wallet"
          : "Trading loss deducted from broker wallet"
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Trading P&L</DialogTitle>
          <DialogDescription>
            Adjust a broker wallet for F&O or intraday profit/loss. This does
            not create a long-term holding.
          </DialogDescription>
        </DialogHeader>

        {brokers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a stock broker wallet under Accounts first, then record trading
            P&L here.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label>Broker wallet</Label>
              <Controller
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v != null) field.onChange(v);
                    }}
                    items={Object.fromEntries(
                      brokers.map((a) => [
                        a.id,
                        `${a.bank_name} · ${a.name} (${formatINR(a.current_balance)})`,
                      ])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {brokers.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.bank_name} · {a.name} (
                          {formatINR(a.current_balance)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Activity</Label>
                <Controller
                  control={form.control}
                  name="activity"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        if (v != null) field.onChange(v);
                      }}
                      items={Object.fromEntries(
                        ACTIVITIES.map((a) => [a.value, a.label])
                      )}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITIES.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Result</Label>
                <Controller
                  control={form.control}
                  name="result"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        if (v != null) field.onChange(v);
                      }}
                      items={{
                        profit: "Profit",
                        loss: "Loss",
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profit">Profit</SelectItem>
                        <SelectItem value="loss">Loss</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                placeholder="e.g. 2500"
                {...form.register("amount")}
              />
              {words ? (
                <p className="text-[11px] text-muted-foreground">{words}</p>
              ) : null}
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" {...form.register("date")} />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} {...form.register("notes")} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Record P&L
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
