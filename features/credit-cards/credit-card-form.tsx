"use client";

import { useEffect, useTransition } from "react";
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
import { CREDIT_CARD_REWARD_TYPES } from "@/lib/constants";
import {
  creditCardSchema,
  type CreditCardFormValues,
} from "@/features/credit-cards/schemas";
import {
  createCreditCard,
  updateCreditCard,
} from "@/features/credit-cards/actions";
import type { CreditCardComputed } from "@/features/credit-cards/queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CreditCardComputed | null;
};

function defaults(
  card?: CreditCardComputed | null
): z.input<typeof creditCardSchema> {
  if (card) {
    return {
      bank: card.bank,
      card_name: card.card_name,
      last_four: card.last_four,
      credit_limit: card.credit_limit,
      outstanding: card.outstanding,
      statement_amount: card.statement_amount,
      minimum_due: card.minimum_due,
      paid_amount: card.paid_amount,
      billing_date: card.billing_date,
      due_date: card.due_date,
      interest_rate: card.interest_rate,
      reward_type: card.reward_type,
      notes: card.notes,
      is_active: card.is_active,
    };
  }
  return {
    bank: "",
    card_name: "",
    last_four: null,
    credit_limit: undefined,
    outstanding: undefined,
    statement_amount: undefined,
    minimum_due: undefined,
    paid_amount: undefined,
    billing_date: 1,
    due_date: 15,
    interest_rate: undefined,
    reward_type: "none",
    notes: null,
    is_active: true,
  };
}

export function CreditCardForm({ open, onOpenChange, card }: Props) {
  const isEdit = Boolean(card);
  const [pending, startTransition] = useTransition();

  const form = useForm<
    z.input<typeof creditCardSchema>,
    unknown,
    CreditCardFormValues
  >({
    resolver: zodResolver(creditCardSchema),
    defaultValues: defaults(card),
  });

  useEffect(() => {
    if (open) form.reset(defaults(card));
  }, [open, card, form]);

  function onSubmit(values: CreditCardFormValues) {
    startTransition(async () => {
      const result =
        isEdit && card
          ? await updateCreditCard(card.id, values)
          : await createCreditCard(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Card updated" : "Card added");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit credit card" : "Add credit card"}
          </DialogTitle>
          <DialogDescription>
            Track limits, outstanding, statement dues and rewards.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid max-h-[70vh] gap-4 overflow-y-auto py-1"
         autoComplete="off"
         >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cc-bank">Bank</Label>
              <Input
                id="cc-bank"
                placeholder="e.g. HDFC Bank"
                {...form.register("bank")}
                aria-invalid={!!form.formState.errors.bank}
              />
              {form.formState.errors.bank && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.bank.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-name">Card name</Label>
              <Input
                id="cc-name"
                placeholder="e.g. Regalia"
                {...form.register("card_name")}
                aria-invalid={!!form.formState.errors.card_name}
              />
              {form.formState.errors.card_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.card_name.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cc-last4">Last 4 digits</Label>
              <Input
                id="cc-last4"
                placeholder="1234"
                maxLength={4}
                {...form.register("last_four")}
                aria-invalid={!!form.formState.errors.last_four}
              />
              {form.formState.errors.last_four && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.last_four.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reward type</Label>
              <Controller
                control={form.control}
                name="reward_type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v != null) field.onChange(v);
                    }}
                    items={Object.fromEntries(
                      CREDIT_CARD_REWARD_TYPES.map((r) => [r.value, r.label])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREDIT_CARD_REWARD_TYPES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cc-limit">Credit limit (₹)</Label>
              <Input
                id="cc-limit"
                type="number"
                step="0.01"
                min="0"
                {...form.register("credit_limit")}
                aria-invalid={!!form.formState.errors.credit_limit}
              />
              {form.formState.errors.credit_limit && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.credit_limit.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-outstanding">Outstanding (₹)</Label>
              <Input
                id="cc-outstanding"
                type="number"
                step="0.01"
                min="0"
                {...form.register("outstanding")}
                aria-invalid={!!form.formState.errors.outstanding}
              />
              {form.formState.errors.outstanding && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.outstanding.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cc-statement">Statement (₹)</Label>
              <Input
                id="cc-statement"
                type="number"
                step="0.01"
                min="0"
                {...form.register("statement_amount")}
              />
              <p className="text-[11px] text-muted-foreground">
                Last billed amount — leave 0 for unbilled spend only
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-min">Min due (₹)</Label>
              <Input
                id="cc-min"
                type="number"
                step="0.01"
                min="0"
                {...form.register("minimum_due")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-paid">Paid (₹)</Label>
              <Input
                id="cc-paid"
                type="number"
                step="0.01"
                min="0"
                {...form.register("paid_amount")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cc-billing">Billing day</Label>
              <Input
                id="cc-billing"
                type="number"
                min={1}
                max={31}
                {...form.register("billing_date")}
                aria-invalid={!!form.formState.errors.billing_date}
              />
              <p className="text-[11px] text-muted-foreground">
                Statement generation day each month
              </p>
              {form.formState.errors.billing_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.billing_date.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-due">Due day</Label>
              <Input
                id="cc-due"
                type="number"
                min={1}
                max={31}
                {...form.register("due_date")}
                aria-invalid={!!form.formState.errors.due_date}
              />
              <p className="text-[11px] text-muted-foreground">
                Payment due day in the statement month
              </p>
              {form.formState.errors.due_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.due_date.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-rate">Interest %</Label>
              <Input
                id="cc-rate"
                type="number"
                step="0.01"
                min="0"
                {...form.register("interest_rate")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc-notes">Notes</Label>
            <Textarea
              id="cc-notes"
              placeholder="Optional notes"
              rows={2}
              {...form.register("notes")}
            />
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
