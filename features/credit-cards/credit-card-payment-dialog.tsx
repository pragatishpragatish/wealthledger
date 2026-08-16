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
  creditCardPaymentSchema,
  type CreditCardPaymentValues,
} from "@/features/credit-cards/schemas";
import { payCreditCard } from "@/features/credit-cards/actions";
import type { Account } from "@/types";
import type { CreditCardComputed } from "@/features/credit-cards/queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCardComputed;
  accounts: Account[];
};

type Preset = "full" | "statement" | "minimum" | "custom";

export function CreditCardPaymentDialog({
  open,
  onOpenChange,
  card,
  accounts,
}: Props) {
  const [pending, startTransition] = useTransition();

  const form = useForm<
    z.input<typeof creditCardPaymentSchema>,
    unknown,
    CreditCardPaymentValues
  >({
    resolver: zodResolver(creditCardPaymentSchema),
    defaultValues: {
      account_id: accounts[0]?.id ?? "",
      amount: undefined,
      date: toDateString(new Date()),
      notes: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      account_id: accounts[0]?.id ?? "",
      amount: undefined,
      date: toDateString(new Date()),
      notes: null,
    });
  }, [open, accounts, form]);

  const amountWatch = form.watch("amount");
  const amountNum =
    amountWatch === "" || amountWatch == null ? NaN : Number(amountWatch);
  const words =
    Number.isFinite(amountNum) && amountNum > 0
      ? amountInWords(amountNum)
      : null;

  function applyPreset(preset: Preset) {
    const map: Record<Preset, number | undefined> = {
      full: card.outstanding > 0 ? card.outstanding : undefined,
      statement:
        card.statement_amount > 0 ? card.statement_amount : undefined,
      minimum: card.minimum_due > 0 ? card.minimum_due : undefined,
      custom: undefined,
    };
    const value = map[preset];
    if (value != null) {
      form.setValue("amount", value, { shouldValidate: true });
    } else if (preset === "custom") {
      form.setValue("amount", undefined as unknown as number);
    }
  }

  function onSubmit(values: CreditCardPaymentValues) {
    startTransition(async () => {
      const result = await payCreditCard(card.id, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Payment recorded");
      onOpenChange(false);
    });
  }

  const presets = useMemo(
    () =>
      [
        {
          id: "full" as const,
          label: "Pay in full",
          hint: formatINR(card.outstanding),
          disabled: card.outstanding <= 0,
        },
        {
          id: "statement" as const,
          label: "Statement",
          hint: formatINR(card.statement_amount),
          disabled: card.statement_amount <= 0,
        },
        {
          id: "minimum" as const,
          label: "Minimum due",
          hint: formatINR(card.minimum_due),
          disabled: card.minimum_due <= 0,
        },
      ] as const,
    [card]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Pay card</DialogTitle>
          <DialogDescription>
            Debit an account to reduce outstanding on {card.bank}{" "}
            {card.card_name}.
          </DialogDescription>
        </DialogHeader>

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a bank or wallet account first, then come back to pay this card.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={p.disabled}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                  <span className="ml-1 text-muted-foreground tabular-nums">
                    {p.hint}
                  </span>
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label>From account</Label>
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
                      accounts.map((a) => [
                        a.id,
                        `${a.bank_name} · ${a.name} (${formatINR(a.current_balance)})`,
                      ])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.bank_name} · {a.name} ({formatINR(a.current_balance)})
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
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                placeholder="e.g. 15000"
                {...form.register("amount")}
              />
              {words ? (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {words}
                </p>
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
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Record payment
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
