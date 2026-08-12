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
import { GOAL_TYPES } from "@/lib/constants";
import { goalSchema, type GoalFormValues } from "@/features/goals/schemas";
import { createGoal, updateGoal } from "@/features/goals/actions";
import type { GoalComputed } from "@/features/goals/queries";

const GOAL_COLORS = [
  "#0F766E",
  "#2563EB",
  "#CA8A04",
  "#DB2777",
  "#7C3AED",
  "#EA580C",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: GoalComputed | null;
};

function defaults(goal?: GoalComputed | null): z.input<typeof goalSchema> {
  if (goal) {
    return {
      name: goal.name,
      type: goal.type,
      target_amount: goal.target_amount,
      current_amount: goal.current_amount,
      monthly_contribution: goal.monthly_contribution,
      target_date: goal.target_date,
      color: goal.color,
      notes: goal.notes,
    };
  }
  return {
    name: "",
    type: "custom",
    target_amount: undefined,
    current_amount: undefined,
    monthly_contribution: undefined,
    target_date: null,
    color: GOAL_COLORS[0],
    notes: null,
  };
}

export function GoalForm({ open, onOpenChange, goal }: Props) {
  const isEdit = Boolean(goal);
  const [pending, startTransition] = useTransition();

  const form = useForm<z.input<typeof goalSchema>, unknown, GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: defaults(goal),
  });

  useEffect(() => {
    if (open) form.reset(defaults(goal));
  }, [open, goal, form]);

  function onSubmit(values: GoalFormValues) {
    startTransition(async () => {
      const result =
        isEdit && goal
          ? await updateGoal(goal.id, values)
          : await createGoal(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Goal updated" : "Goal created");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "Add goal"}</DialogTitle>
          <DialogDescription>
            Track savings progress toward a target amount and date.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid max-h-[70vh] gap-4 overflow-y-auto py-1"
         autoComplete="off"
         >
          <div className="space-y-2">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g. Emergency fund"
              {...form.register("name")}
              aria-invalid={!!form.formState.errors.name}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

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
                      if (v != null) field.onChange(v);
                    }}
                    items={Object.fromEntries(
                      GOAL_TYPES.map((t) => [t.value, t.label])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_TYPES.map((t) => (
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
              <Label htmlFor="goal-date">Target date</Label>
              <Input
                id="goal-date"
                type="date"
                {...form.register("target_date")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target (₹)</Label>
              <Input
                id="goal-target"
                type="number"
                step="0.01"
                min="0"
                {...form.register("target_amount")}
                aria-invalid={!!form.formState.errors.target_amount}
              />
              {form.formState.errors.target_amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.target_amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-current">Saved (₹)</Label>
              <Input
                id="goal-current"
                type="number"
                step="0.01"
                min="0"
                {...form.register("current_amount")}
                aria-invalid={!!form.formState.errors.current_amount}
              />
              {form.formState.errors.current_amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.current_amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-monthly">Monthly (₹)</Label>
              <Input
                id="goal-monthly"
                type="number"
                step="0.01"
                min="0"
                {...form.register("monthly_contribution")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      onClick={() => field.onChange(c)}
                      className="size-8 rounded-full border-2 transition-transform hover:scale-105"
                      style={{
                        backgroundColor: c,
                        borderColor:
                          field.value === c ? "var(--foreground)" : "transparent",
                      }}
                    />
                  ))}
                </div>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-notes">Notes</Label>
            <Textarea
              id="goal-notes"
              rows={2}
              placeholder="Optional notes"
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
              {isEdit ? "Save changes" : "Add goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
