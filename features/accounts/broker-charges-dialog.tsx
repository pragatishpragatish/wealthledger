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
  brokerChargesSchema,
  type BrokerChargesFormValues,
} from "@/features/accounts/schemas";
import { recordBrokerCharges } from "@/features/accounts/actions";
import type { Account } from "@/types";

type BrokerWalletAccount = Pick<
  Account,
  "id" | "name" | "bank_name" | "current_balance" | "account_type"
>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BrokerWalletAccount[];
  /** Pre-select a broker wallet when opened from a row action. */
  defaultAccountId?: string | null;
};

export function BrokerChargesDialog({
  open,
  onOpenChange,
  accounts,
  defaultAccountId,
}: Props) {
  const [pending, startTransition] = useTransition();
  const brokers = useMemo(
    () => accounts.filter((a) => a.account_type === "broker_wallet"),
    [accounts]
  );

  const form = useForm<
    z.input<typeof brokerChargesSchema>,
    unknown,
    BrokerChargesFormValues
  >({
    resolver: zodResolver(brokerChargesSchema),
    defaultValues: {
      account_id: defaultAccountId ?? brokers[0]?.id ?? "",
      amount: undefined,
      date: toDateString(new Date()),
      notes: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    const preset =
      defaultAccountId && brokers.some((b) => b.id === defaultAccountId)
        ? defaultAccountId
        : brokers[0]?.id ?? "";
    form.reset({
      account_id: preset,
      amount: undefined,
      date: toDateString(new Date()),
      notes: null,
    });
  }, [open, brokers, defaultAccountId, form]);

  const amountWatch = form.watch("amount");
  const amountNum =
    amountWatch === "" || amountWatch == null ? NaN : Number(amountWatch);
  const words =
    Number.isFinite(amountNum) && amountNum > 0
      ? amountInWords(amountNum)
      : null;

  function onSubmit(values: BrokerChargesFormValues) {
    startTransition(async () => {
      const result = await recordBrokerCharges(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Brokerage & charges recorded");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Brokerage &amp; charges</DialogTitle>
          <DialogDescription>
            Deduct a lump sum from a broker wallet — brokerage, STT, DP fees,
            etc. Logged under one expense category (no split-up).
          </DialogDescription>
        </DialogHeader>

        {brokers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a stock broker wallet under Accounts first, then record charges
            here.
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
              {form.formState.errors.account_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.account_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Total charges (₹)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="e.g. 245.67"
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
              <Textarea
                rows={2}
                placeholder="e.g. March contract note total"
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
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Record charges
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
