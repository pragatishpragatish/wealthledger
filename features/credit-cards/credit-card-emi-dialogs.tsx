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
import { calculateEMI } from "@/lib/calculations/loan";
import {
  convertToEmiSchema,
  recordEmiPaymentSchema,
  type ConvertToEmiValues,
  type RecordEmiPaymentValues,
} from "@/features/credit-cards/schemas";
import {
  convertPurchaseToEmi,
  recordCreditCardEmiPayment,
} from "@/features/credit-cards/actions";
import type { Account, CreditCardEmi, CreditCardTransaction } from "@/types";

type ConvertProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  outstanding: number;
  purchases: CreditCardTransaction[];
};

export function ConvertToEmiDialog({
  open,
  onOpenChange,
  cardId,
  outstanding,
  purchases,
}: ConvertProps) {
  const [pending, startTransition] = useTransition();
  const convertible = purchases.filter(
    (p) => !p.is_payment && !p.converted_to_emi
  );

  const form = useForm<
    z.input<typeof convertToEmiSchema>,
    unknown,
    ConvertToEmiValues
  >({
    resolver: zodResolver(convertToEmiSchema),
    defaultValues: {
      source_transaction_id: null,
      description: "",
      principal: undefined,
      interest_rate: undefined,
      tenure_months: undefined,
      processing_fee: undefined,
      start_date: toDateString(new Date()),
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      source_transaction_id: null,
      description: "",
      principal: undefined,
      interest_rate: undefined,
      tenure_months: undefined,
      processing_fee: undefined,
      start_date: toDateString(new Date()),
    });
  }, [open, form]);

  const principal = Number(useWatch({ control: form.control, name: "principal" }) || 0);
  const rate = Number(useWatch({ control: form.control, name: "interest_rate" }) || 0);
  const tenure = Number(useWatch({ control: form.control, name: "tenure_months" }) || 0);
  const previewEmi =
    principal > 0 && tenure > 0 ? calculateEMI(principal, rate, tenure) : 0;
  const words =
    principal > 0 ? amountInWords(principal) : null;

  function onSelectPurchase(id: string) {
    if (id === "__none__") {
      form.setValue("source_transaction_id", null);
      return;
    }
    const purchase = convertible.find((p) => p.id === id);
    if (!purchase) return;
    form.setValue("source_transaction_id", id);
    form.setValue(
      "description",
      purchase.merchant || purchase.description || "Card purchase"
    );
    form.setValue("principal", purchase.amount, { shouldValidate: true });
  }

  function onSubmit(values: ConvertToEmiValues) {
    if (values.principal > outstanding + 0.001) {
      toast.error("Principal cannot exceed outstanding");
      return;
    }
    startTransition(async () => {
      const result = await convertPurchaseToEmi(cardId, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Converted to EMI");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Convert to EMI</DialogTitle>
          <DialogDescription>
            Split a purchase (or custom amount) into monthly installments.
            Outstanding on the card stays until you record EMI payments.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label>Source purchase (optional)</Label>
            <Select
              value={
                (form.watch("source_transaction_id") as string | null) ??
                "__none__"
              }
              onValueChange={(v) => {
                if (v != null) onSelectPurchase(v);
              }}
              items={{
                __none__: "Custom amount",
                ...Object.fromEntries(
                  convertible.map((p) => [
                    p.id,
                    `${p.date} · ${p.merchant || p.description || "Purchase"} · ${formatINR(p.amount)}`,
                  ])
                ),
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Custom amount" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Custom amount</SelectItem>
                {convertible.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.date} · {p.merchant || p.description || "Purchase"} ·{" "}
                    {formatINR(p.amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="e.g. Phone EMI"
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Principal (₹)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                placeholder="e.g. 40000"
                {...form.register("principal")}
              />
              {words ? (
                <p className="text-[11px] text-muted-foreground">{words}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Interest % p.a.</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                placeholder="e.g. 14"
                {...form.register("interest_rate")}
              />
            </div>
            <div className="space-y-2">
              <Label>Tenure (months)</Label>
              <Input
                type="number"
                min={1}
                step={1}
                placeholder="e.g. 12"
                {...form.register("tenure_months")}
              />
            </div>
            <div className="space-y-2">
              <Label>Processing fee (₹)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="Optional"
                {...form.register("processing_fee")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Start date</Label>
            <Input type="date" {...form.register("start_date")} />
          </div>

          {previewEmi > 0 ? (
            <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
              Estimated EMI:{" "}
              <span className="font-semibold tabular-nums">
                {formatINR(previewEmi)}
              </span>
              /month
            </p>
          ) : null}

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
              Create EMI
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type PayEmiProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  emi: CreditCardEmi | null;
  accounts: Account[];
};

export function RecordEmiPaymentDialog({
  open,
  onOpenChange,
  cardId,
  emi,
  accounts,
}: PayEmiProps) {
  const [pending, startTransition] = useTransition();

  const form = useForm<
    z.input<typeof recordEmiPaymentSchema>,
    unknown,
    RecordEmiPaymentValues
  >({
    resolver: zodResolver(recordEmiPaymentSchema),
    defaultValues: {
      emi_id: emi?.id ?? "",
      account_id: accounts[0]?.id ?? "",
      date: toDateString(new Date()),
      notes: null,
    },
  });

  useEffect(() => {
    if (!open || !emi) return;
    form.reset({
      emi_id: emi.id,
      account_id: accounts[0]?.id ?? "",
      date: toDateString(new Date()),
      notes: null,
    });
  }, [open, emi, accounts, form]);

  const words = useMemo(
    () => (emi ? amountInWords(emi.emi_amount) : null),
    [emi]
  );

  function onSubmit(values: RecordEmiPaymentValues) {
    startTransition(async () => {
      const result = await recordCreditCardEmiPayment(cardId, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("EMI payment recorded");
      onOpenChange(false);
    });
  }

  if (!emi) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Pay EMI</DialogTitle>
          <DialogDescription>
            {emi.description} · installment {emi.emis_paid + 1}/
            {emi.tenure_months}
          </DialogDescription>
        </DialogHeader>

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add an account to pay this EMI from.
          </p>
        ) : (
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <input type="hidden" {...form.register("emi_id")} />

            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">EMI amount</p>
              <p className="font-heading text-lg font-semibold tabular-nums">
                {formatINR(emi.emi_amount)}
              </p>
              {words ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{words}</p>
              ) : null}
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
                          {a.bank_name} · {a.name} (
                          {formatINR(a.current_balance)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" {...form.register("date")} />
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
                Record EMI
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
