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
import {
  budgetSchema,
  type BudgetFormValues,
} from "@/features/budgets/schemas";
import { createBudget, updateBudget } from "@/features/budgets/actions";
import type { BudgetComputed } from "@/features/budgets/queries";
import type { BudgetPeriod, Category } from "@/types";

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: BudgetComputed | null;
  categories: Pick<Category, "id" | "name" | "color" | "icon">[];
  defaultPeriod: BudgetPeriod;
  defaultYear: number;
  defaultMonth: number;
};

function defaults(
  budget: BudgetComputed | null | undefined,
  defaultPeriod: BudgetPeriod,
  defaultYear: number,
  defaultMonth: number
): BudgetFormValues {
  if (budget) {
    return {
      category_id: budget.category_id ?? "",
      period: budget.period,
      year: budget.year,
      month: budget.month,
      amount: budget.amount,
    };
  }
  return {
    category_id: "",
    period: defaultPeriod,
    year: defaultYear,
    month: defaultPeriod === "monthly" ? defaultMonth : null,
    amount: 0,
  };
}

export function BudgetForm({
  open,
  onOpenChange,
  budget,
  categories,
  defaultPeriod,
  defaultYear,
  defaultMonth,
}: Props) {
  const isEdit = Boolean(budget);
  const [pending, startTransition] = useTransition();

  const form = useForm<
    z.input<typeof budgetSchema>,
    unknown,
    BudgetFormValues
  >({
    resolver: zodResolver(budgetSchema),
    defaultValues: defaults(budget, defaultPeriod, defaultYear, defaultMonth),
  });

  const period = form.watch("period");

  useEffect(() => {
    if (open) {
      form.reset(defaults(budget, defaultPeriod, defaultYear, defaultMonth));
    }
  }, [open, budget, defaultPeriod, defaultYear, defaultMonth, form]);

  useEffect(() => {
    if (period === "yearly") {
      form.setValue("month", null);
    } else if (form.getValues("month") == null) {
      form.setValue("month", defaultMonth);
    }
  }, [period, form, defaultMonth]);

  function onSubmit(values: BudgetFormValues) {
    startTransition(async () => {
      const payload = {
        ...values,
        month: values.period === "yearly" ? null : values.month,
      };
      const result =
        isEdit && budget
          ? await updateBudget(budget.id, payload)
          : await createBudget(payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Budget updated" : "Budget created");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "Add budget"}</DialogTitle>
          <DialogDescription>
            Set a spending limit for a category and period.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 py-1"
         autoComplete="off"
         >
          <div className="space-y-2">
            <Label>Category</Label>
            <Controller
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <Select
                  value={field.value || null}
                  onValueChange={(v) => {
                    if (v != null) field.onChange(v);
                  }}
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
            {form.formState.errors.category_id && (
              <p className="text-xs text-destructive">
                {form.formState.errors.category_id.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Period</Label>
              <Controller
                control={form.control}
                name="period"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v === "monthly" || v === "yearly") field.onChange(v);
                    }}
                    items={{ monthly: "Monthly", yearly: "Yearly" }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-year">Year</Label>
              <Input
                id="budget-year"
                type="number"
                min={2000}
                max={2100}
                {...form.register("year")}
                aria-invalid={!!form.formState.errors.year}
              />
              {form.formState.errors.year && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.year.message}
                </p>
              )}
            </div>
          </div>

          {period === "monthly" && (
            <div className="space-y-2">
              <Label>Month</Label>
              <Controller
                control={form.control}
                name="month"
                render={({ field }) => (
                  <Select
                    value={field.value != null ? String(field.value) : null}
                    onValueChange={(v) => {
                      if (v != null) field.onChange(Number(v));
                    }}
                    items={Object.fromEntries(
                      MONTHS.map((m) => [m.value, m.label])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.month && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.month.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="budget-amount">Budget amount (₹)</Label>
            <Input
              id="budget-amount"
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
              {isEdit ? "Save changes" : "Add budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
