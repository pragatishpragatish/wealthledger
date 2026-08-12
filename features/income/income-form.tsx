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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RECURRING_FREQUENCIES } from "@/lib/constants";
import { toDateString } from "@/utils/date";
import {
  incomeSchema,
  type IncomeFormValues,
} from "@/features/income/schemas";
import { createIncome, updateIncome } from "@/features/income/actions";
import type { IncomeRow } from "@/features/income/queries";

type AccountOption = {
  id: string;
  name: string;
  bank_name: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  income?: IncomeRow | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
};

function defaults(income?: IncomeRow | null): z.input<typeof incomeSchema> {
  if (income) {
    return {
      date: income.date,
      amount: income.amount,
      category_id: income.category_id,
      account_id: income.account_id ?? "",
      notes: income.notes,
      is_recurring: income.is_recurring,
      recurring_frequency: income.recurring_frequency,
    };
  }
  return {
    date: toDateString(new Date()),
    amount: undefined,
    category_id: null,
    account_id: "",
    notes: null,
    is_recurring: false,
    recurring_frequency: null,
  };
}

export function IncomeForm({
  open,
  onOpenChange,
  income,
  accounts,
  categories,
}: Props) {
  const isEdit = Boolean(income);
  const [pending, startTransition] = useTransition();

  const form = useForm<
    z.input<typeof incomeSchema>,
    unknown,
    IncomeFormValues
  >({
    resolver: zodResolver(incomeSchema),
    defaultValues: defaults(income),
  });

  const isRecurring = form.watch("is_recurring");

  useEffect(() => {
    if (open) form.reset(defaults(income));
  }, [open, income, form]);

  function onSubmit(values: IncomeFormValues) {
    startTransition(async () => {
      const result =
        isEdit && income
          ? await updateIncome(income.id, values)
          : await createIncome(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Income updated" : "Income recorded");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit income" : "Add income"}</DialogTitle>
          <DialogDescription>
            Record salary, freelance, rental or other income. Account balance
            updates automatically.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid max-h-[70vh] gap-4 overflow-y-auto py-1"
         autoComplete="off"
         >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="income-amount">Amount (₹)</Label>
              <Input
                id="income-amount"
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
              <Label htmlFor="income-date">Date</Label>
              <Input
                id="income-date"
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
              <Label>Account</Label>
              <Controller
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(v) => {
                      if (v != null) field.onChange(v);
                    }}
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
                  id="income-recurring"
                />
              )}
            />
            <Label htmlFor="income-recurring" className="font-normal">
              Recurring income
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
            <Label htmlFor="income-notes">Notes</Label>
            <Textarea
              id="income-notes"
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
              {isEdit ? "Save changes" : "Add income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
