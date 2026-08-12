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
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS, RECURRING_FREQUENCIES } from "@/lib/constants";
import { toDateString } from "@/utils/date";
import { expenseSchema } from "@/features/expenses/schemas";
import { createExpense, updateExpense } from "@/features/expenses/actions";
import type { ExpenseRow } from "@/features/expenses/queries";

type AccountOption = {
  id: string;
  name: string;
  bank_name: string;
};

type CreditCardOption = {
  id: string;
  bank: string;
  card_name: string;
  last_four: string | null;
};

type CategoryOption = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseRow | null;
  accounts: AccountOption[];
  creditCards: CreditCardOption[];
  categories: CategoryOption[];
};

function sourceValue(accountId: string | null, cardId: string | null) {
  if (cardId) return `card:${cardId}`;
  if (accountId) return `account:${accountId}`;
  return null;
}

function parseSource(value: string | null): {
  account_id: string | null;
  credit_card_id: string | null;
} {
  if (!value) return { account_id: null, credit_card_id: null };
  if (value.startsWith("card:")) {
    return { account_id: null, credit_card_id: value.slice(5) };
  }
  if (value.startsWith("account:")) {
    return { account_id: value.slice(8), credit_card_id: null };
  }
  return { account_id: null, credit_card_id: null };
}

function defaults(
  expense?: ExpenseRow | null
): z.input<typeof expenseSchema> {
  if (expense) {
    return {
      date: expense.date,
      amount: expense.amount,
      category_id: expense.category_id,
      account_id: expense.account_id ?? null,
      credit_card_id: expense.credit_card_id ?? null,
      merchant: expense.merchant,
      payment_method: expense.payment_method,
      notes: expense.notes,
      tags: expense.tags.map((t) => t.name).join(", ") || undefined,
      receipt_url: expense.receipt_url,
      is_recurring: expense.is_recurring,
      recurring_frequency: expense.recurring_frequency,
    };
  }
  return {
    date: toDateString(new Date()),
    amount: undefined,
    category_id: null,
    account_id: null,
    credit_card_id: null,
    merchant: null,
    payment_method: null,
    notes: null,
    tags: undefined,
    receipt_url: null,
    is_recurring: false,
    recurring_frequency: null,
  };
}

function cardLabel(c: CreditCardOption) {
  const last = c.last_four ? ` ·••• ${c.last_four}` : "";
  return `${c.card_name} (${c.bank})${last}`;
}

export function ExpenseForm({
  open,
  onOpenChange,
  expense,
  accounts,
  creditCards,
  categories,
}: Props) {
  const isEdit = Boolean(expense);
  const [pending, startTransition] = useTransition();
  const canSubmit = accounts.length > 0 || creditCards.length > 0;

  const sourceItems = useMemo(() => {
    const items: { value: string; label: string }[] = [];
    for (const a of accounts) {
      items.push({
        value: `account:${a.id}`,
        label: `${a.name} · ${a.bank_name}`,
      });
    }
    for (const c of creditCards) {
      items.push({
        value: `card:${c.id}`,
        label: `Card · ${cardLabel(c)}`,
      });
    }
    return items;
  }, [accounts, creditCards]);

  const form = useForm<z.input<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaults(expense),
  });

  const isRecurring = form.watch("is_recurring");
  const accountId = form.watch("account_id");
  const creditCardId = form.watch("credit_card_id");
  const paidFrom = sourceValue(
    accountId && accountId !== "" ? accountId : null,
    creditCardId && creditCardId !== "" ? creditCardId : null
  );

  useEffect(() => {
    if (open) form.reset(defaults(expense));
  }, [open, expense, form]);

  function onSubmit(values: z.input<typeof expenseSchema>) {
    startTransition(async () => {
      const result =
        isEdit && expense
          ? await updateExpense(expense.id, values)
          : await createExpense(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Expense updated" : "Expense recorded");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            Log spending from a bank account or credit card.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid max-h-[70vh] gap-4 overflow-y-auto py-1"
          autoComplete="off"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount (₹)</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0"
                {...form.register("amount")}
                aria-invalid={!!form.formState.errors.amount}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                {...form.register("date")}
                aria-invalid={!!form.formState.errors.date}
              />
              {form.formState.errors.date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.date.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Controller
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? null}
                    onValueChange={(v) => field.onChange(v ?? null)}
                    items={categories.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Paid from</Label>
              <Select
                value={paidFrom}
                onValueChange={(v) => {
                  const parsed = parseSource(v);
                  form.setValue("account_id", parsed.account_id, {
                    shouldValidate: true,
                  });
                  form.setValue("credit_card_id", parsed.credit_card_id, {
                    shouldValidate: true,
                  });
                  if (parsed.credit_card_id && !form.getValues("payment_method")) {
                    form.setValue("payment_method", "card");
                  }
                }}
                items={sourceItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Account or credit card" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Bank accounts</SelectLabel>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={`account:${a.id}`}>
                          {a.name} · {a.bank_name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {creditCards.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Credit cards</SelectLabel>
                      {creditCards.map((c) => (
                        <SelectItem key={c.id} value={`card:${c.id}`}>
                          {cardLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.account_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.account_id.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-merchant">Merchant</Label>
              <Input
                id="expense-merchant"
                placeholder="e.g. Swiggy, Amazon"
                {...form.register("merchant")}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Controller
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <Select
                    value={field.value ?? null}
                    onValueChange={(v) => field.onChange(v ?? null)}
                    items={Object.fromEntries(
                      PAYMENT_METHODS.map((p) => [p.value, p.label])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-tags">Tags</Label>
            <Input
              id="expense-tags"
              placeholder="Comma-separated, e.g. travel, work"
              {...form.register("tags")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-receipt">Receipt URL</Label>
            <Input
              id="expense-receipt"
              type="url"
              placeholder="https://..."
              {...form.register("receipt_url")}
              aria-invalid={!!form.formState.errors.receipt_url}
            />
            {form.formState.errors.receipt_url && (
              <p className="text-xs text-destructive">
                {form.formState.errors.receipt_url.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
            <Controller
              control={form.control}
              name="is_recurring"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                  id="expense-recurring"
                />
              )}
            />
            <Label htmlFor="expense-recurring" className="font-normal">
              Recurring expense
            </Label>
          </div>

          {isRecurring && (
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Controller
                control={form.control}
                name="recurring_frequency"
                render={({ field }) => (
                  <Select
                    value={field.value ?? null}
                    onValueChange={(v) => field.onChange(v ?? null)}
                    items={Object.fromEntries(
                      RECURRING_FREQUENCIES.map((f) => [f.value, f.label])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRING_FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.recurring_frequency && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.recurring_frequency.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="expense-notes">Notes</Label>
            <Textarea
              id="expense-notes"
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
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
