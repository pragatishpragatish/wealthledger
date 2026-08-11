"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { toDateString } from "@/utils/date";
import { formatINR } from "@/utils/currency";
import {
  contributionSchema,
  type ContributionFormValues,
} from "@/features/investments/schemas";
import { addInvestmentContribution } from "@/features/investments/actions";
import type { InvestmentComputed } from "@/features/investments/queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: InvestmentComputed | null;
};

export function ContributionForm({ open, onOpenChange, investment }: Props) {
  const [pending, startTransition] = useTransition();

  const form = useForm<
    z.input<typeof contributionSchema>,
    unknown,
    ContributionFormValues
  >({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      date: toDateString(new Date()),
      amount: 0,
      units: 0,
      price: 0,
      notes: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date: toDateString(new Date()),
        amount: 0,
        units: 0,
        price: 0,
        notes: null,
      });
    }
  }, [open, form]);

  function onSubmit(values: ContributionFormValues) {
    if (!investment) return;
    startTransition(async () => {
      const result = await addInvestmentContribution(investment.id, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added ${formatINR(values.amount)} to ${investment.name}`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Add to {investment?.name ?? "investment"}</DialogTitle>
          <DialogDescription>
            Log another purchase into the same fund. Each entry keeps its own
            date so you can track top-ups over time.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 py-1"
          autoComplete="off"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contrib-date">Date</Label>
              <Input
                id="contrib-date"
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
            <div className="space-y-2">
              <Label htmlFor="contrib-amount">Amount (₹)</Label>
              <Input
                id="contrib-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1000"
                {...form.register("amount")}
                aria-invalid={!!form.formState.errors.amount}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
          </div>

          <details className="rounded-xl border border-border/60 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Units &amp; NAV (optional)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contrib-units">Units bought</Label>
                <Input
                  id="contrib-units"
                  type="number"
                  step="any"
                  min="0"
                  {...form.register("units")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contrib-price">NAV / price</Label>
                <Input
                  id="contrib-price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("price")}
                />
              </div>
            </div>
          </details>

          <div className="space-y-2">
            <Label htmlFor="contrib-notes">Notes</Label>
            <Textarea
              id="contrib-notes"
              rows={2}
              placeholder="Optional"
              {...form.register("notes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !investment}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Add contribution
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
