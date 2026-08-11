"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { PAYMENT_METHODS } from "@/lib/constants";
import { toDateString } from "@/utils/date";
import type { Account, Category, Transaction } from "@/types";
import {
  transactionSchema,
  type TransactionFormValues,
} from "@/features/transactions/schemas";
import {
  createTransaction,
  updateTransaction,
} from "@/features/transactions/actions";

type AccountOption = Pick<
  Account,
  "id" | "name" | "bank_name" | "current_balance"
>;
type CategoryOption = Pick<Category, "id" | "name" | "kind" | "color">;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
};

const TYPE_OPTIONS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
  { value: "adjustment", label: "Adjustment" },
] as const;

function defaults(tx?: Transaction | null): TransactionFormValues {
  if (tx) {
    return {
      type: tx.type,
      date: tx.date,
      amount: tx.amount,
      category_id: tx.category_id,
      account_id: tx.account_id,
      to_account_id: tx.to_account_id,
      merchant: tx.merchant,
      notes: tx.notes,
      payment_method: tx.payment_method,
      tags: tx.tags?.map((t) => t.name).join(", ") || undefined,
    };
  }
  return {
    type: "expense",
    date: toDateString(new Date()),
    amount: 0,
    category_id: null,
    account_id: null,
    to_account_id: null,
    merchant: null,
    notes: null,
    payment_method: null,
    tags: undefined,
  };
}

export function TransactionForm({
  open,
  onOpenChange,
  transaction,
  accounts,
  categories,
}: Props) {
  const isEdit = Boolean(transaction);
  const [pending, startTransition] = useTransition();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: defaults(transaction),
  });

  const type = form.watch("type");

  const filteredCategories = useMemo(() => {
    if (type === "income") {
      return categories.filter((c) => c.kind === "income");
    }
    if (type === "expense") {
      return categories.filter((c) => c.kind === "expense");
    }
    return categories;
  }, [categories, type]);

  useEffect(() => {
    if (open) {
      form.reset(defaults(transaction));
    }
  }, [open, transaction, form]);

  function onSubmit(values: TransactionFormValues) {
    startTransition(async () => {
      const result =
        isEdit && transaction
          ? await updateTransaction(transaction.id, values)
          : await createTransaction(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Transaction updated" : "Transaction added");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit transaction" : "Add transaction"}
          </DialogTitle>
          <DialogDescription>
            Record income, expense, transfer or balance adjustment.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid max-h-[70vh] gap-4 overflow-y-auto py-1"
         autoComplete="off"
         >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v == null) return;
                      field.onChange(v);
                      form.setValue("category_id", null);
                      if (v !== "transfer") {
                        form.setValue("to_account_id", null);
                      }
                    }}
                    items={Object.fromEntries(
                      TYPE_OPTIONS.map((t) => [t.value, t.label])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
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

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              {...form.register("amount")}
              aria-invalid={!!form.formState.errors.amount}
            />
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive">
                {form.formState.errors.amount.message}
              </p>
            )}
            {type === "adjustment" && (
              <p className="text-xs text-muted-foreground">
                Adjustment credits the selected account by this amount.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                {type === "transfer" ? "From account" : "Account"}
              </Label>
              <Controller
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? null}
                    onValueChange={(v) =>
                      field.onChange(v === "" || v == null ? null : v)
                    }
                    items={accounts.map((a) => ({
                      value: a.id,
                      label: `${a.name} · ${a.bank_name}`,
                    }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} · {a.bank_name}
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

            {type === "transfer" && (
              <div className="space-y-2">
                <Label>To account</Label>
                <Controller
                  control={form.control}
                  name="to_account_id"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? null}
                      onValueChange={(v) =>
                        field.onChange(v === "" || v == null ? null : v)
                      }
                      items={accounts.map((a) => ({
                        value: a.id,
                        label: `${a.name} · ${a.bank_name}`,
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} · {a.bank_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.to_account_id && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.to_account_id.message}
                  </p>
                )}
              </div>
            )}

            {(type === "income" || type === "expense") && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Controller
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? null}
                      onValueChange={(v) =>
                        field.onChange(v === "" || v == null ? null : v)
                      }
                      items={filteredCategories.map((c) => ({
                        value: c.id,
                        label: c.name,
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>

          {type !== "transfer" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant / Payee</Label>
                <Input
                  id="merchant"
                  placeholder="Optional"
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
                      onValueChange={(v) =>
                        field.onChange(v === "" || v == null ? null : v)
                      }
                      items={Object.fromEntries(
                        PAYMENT_METHODS.map((m) => [m.value, m.label])
                      )}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              placeholder="Comma-separated, e.g. rent, monthly"
              {...form.register("tags")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
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
            <Button type="submit" disabled={pending || accounts.length === 0}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
