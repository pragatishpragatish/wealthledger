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
import {
  INVESTMENT_ENTRY_PRESETS,
  INVESTMENT_PLATFORMS,
  INVESTMENT_TYPES,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toDateString } from "@/utils/date";
import { formatINR, formatPercent } from "@/utils/currency";
import {
  investmentSchema,
  resolveInvestmentAmounts,
  type InvestmentFormValues,
} from "@/features/investments/schemas";
import {
  createInvestment,
  updateInvestment,
} from "@/features/investments/actions";
import type { InvestmentComputed } from "@/features/investments/queries";
import type { InvestmentType } from "@/types";

type EntryPresetId = (typeof INVESTMENT_ENTRY_PRESETS)[number]["id"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment?: InvestmentComputed | null;
};

function defaults(
  investment?: InvestmentComputed | null
): z.input<typeof investmentSchema> {
  if (investment) {
    return {
      name: investment.name,
      type: investment.type,
      platform: investment.platform,
      purchase_date: investment.purchase_date,
      units: investment.units,
      buy_price: investment.buy_price,
      current_price: investment.current_price,
      invested_amount: investment.invested_amount,
      current_value: investment.current_value,
      maturity_date: investment.maturity_date,
      interest_rate: investment.interest_rate,
      notes: investment.notes,
      is_active: investment.is_active,
    };
  }
  return {
    name: "",
    type: "mutual_funds",
    platform: "Groww",
    purchase_date: toDateString(new Date()),
    units: undefined,
    buy_price: undefined,
    current_price: undefined,
    invested_amount: undefined,
    current_value: undefined,
    maturity_date: null,
    interest_rate: null,
    notes: null,
    is_active: true,
  };
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>;
}

export function InvestmentForm({ open, onOpenChange, investment }: Props) {
  const isEdit = Boolean(investment);
  const [pending, startTransition] = useTransition();

  const form = useForm<
    z.input<typeof investmentSchema>,
    unknown,
    InvestmentFormValues
  >({
    resolver: zodResolver(investmentSchema),
    defaultValues: defaults(investment),
  });

  const type = form.watch("type") as InvestmentType;
  const units = Number(form.watch("units") ?? 0);
  const buyPrice = Number(form.watch("buy_price") ?? 0);
  const currentPrice = Number(form.watch("current_price") ?? 0);
  const invested = Number(form.watch("invested_amount") ?? 0);
  const currentValue = Number(form.watch("current_value") ?? 0);
  const platform = form.watch("platform");

  const preview = resolveInvestmentAmounts({
    units,
    buy_price: buyPrice,
    current_price: currentPrice,
    invested_amount: invested,
    current_value: currentValue,
  });

  const showUnits =
    type === "stocks" ||
    type === "etf" ||
    type === "mutual_funds" ||
    type === "gold" ||
    type === "silver" ||
    type === "crypto";
  const showRate =
    type === "fd" ||
    type === "rd" ||
    type === "ppf" ||
    type === "epf" ||
    type === "nps" ||
    type === "bonds";
  const showMaturity = type === "fd" || type === "rd" || type === "bonds";

  useEffect(() => {
    if (open) form.reset(defaults(investment));
  }, [open, investment, form]);

  useEffect(() => {
    if (units > 0 && buyPrice > 0) {
      form.setValue(
        "invested_amount",
        Math.round(units * buyPrice * 100) / 100,
        { shouldValidate: false }
      );
    }
  }, [units, buyPrice, form]);

  useEffect(() => {
    if (units > 0 && currentPrice > 0) {
      form.setValue(
        "current_value",
        Math.round(units * currentPrice * 100) / 100,
        { shouldValidate: false }
      );
    }
  }, [units, currentPrice, form]);

  function applyPreset(presetId: EntryPresetId) {
    const preset = INVESTMENT_ENTRY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    form.setValue("type", preset.type);
    if (preset.id === "fd") form.setValue("type", "fd");
    if (preset.id === "retirement") form.setValue("type", "ppf");
    if (preset.id === "gold") form.setValue("type", "gold");
  }

  function onSubmit(values: InvestmentFormValues) {
    startTransition(async () => {
      const result =
        isEdit && investment
          ? await updateInvestment(investment.id, values)
          : await createInvestment(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Investment updated" : "Investment added");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit investment" : "Add investment"}
          </DialogTitle>
          <DialogDescription>
            Create a holding once, then use “Add money” anytime to log more
            purchases with their dates.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid max-h-[75vh] gap-4 overflow-y-auto py-1"
          autoComplete="off"
        >
          {!isEdit && (
            <div className="space-y-2">
              <Label>What are you adding?</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {INVESTMENT_ENTRY_PRESETS.map((p) => {
                  const selected = type === p.type ||
                    (p.id === "retirement" &&
                      ["ppf", "epf", "nps"].includes(type)) ||
                    (p.id === "fd" && (type === "fd" || type === "rd")) ||
                    (p.id === "gold" &&
                      (type === "gold" || type === "silver")) ||
                    (p.id === "other" &&
                      (type === "bonds" || type === "real_estate"));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition-colors",
                        selected
                          ? "border-teal-600/40 bg-teal-500/10"
                          : "border-border/60 hover:bg-muted/50"
                      )}
                    >
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="inv-name">Name</Label>
              <Input
                id="inv-name"
                placeholder="e.g. Parag Parikh Flexi Cap"
                {...form.register("name")}
                aria-invalid={!!form.formState.errors.name}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Platform</Label>
              <Controller
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v || null)}
                    items={Object.fromEntries(
                      INVESTMENT_PLATFORMS.map((p) => [p, p])
                    )}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {platform === "Other" && (
                <Input
                  placeholder="Platform name"
                  value={
                    INVESTMENT_PLATFORMS.includes(
                      platform as (typeof INVESTMENT_PLATFORMS)[number]
                    )
                      ? ""
                      : (platform ?? "")
                  }
                  onChange={(e) => form.setValue("platform", e.target.value)}
                />
              )}
            </div>

            {isEdit && (
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
                        INVESTMENT_TYPES.map((t) => [t.value, t.label])
                      )}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVESTMENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inv-invested">Invested amount (₹)</Label>
              <Input
                id="inv-invested"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1000"
                {...form.register("invested_amount")}
                aria-invalid={!!form.formState.errors.invested_amount}
              />
              <FieldHint>
                First purchase now — add more later with “Add money”
              </FieldHint>
              {form.formState.errors.invested_amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.invested_amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-value">Current value (₹)</Label>
              <Input
                id="inv-value"
                type="number"
                step="0.01"
                min="0"
                placeholder="Today’s value"
                {...form.register("current_value")}
              />
              <FieldHint>Leave blank to match invested for now</FieldHint>
            </div>
          </div>

          {showUnits && (
            <details className="rounded-xl border border-border/60 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Advanced · Units &amp; NAV / price (optional)
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="inv-units">Units</Label>
                  <Input
                    id="inv-units"
                    type="number"
                    step="any"
                    min="0"
                    {...form.register("units")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-buy">
                    {type === "mutual_funds" ? "Avg buy NAV" : "Buy price"}
                  </Label>
                  <Input
                    id="inv-buy"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("buy_price")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-nav">
                    {type === "mutual_funds" ? "Current NAV" : "Current price"}
                  </Label>
                  <Input
                    id="inv-nav"
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("current_price")}
                  />
                </div>
              </div>
            </details>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inv-purchase">
                {showMaturity ? "Start date" : "Purchase date"}
              </Label>
              <Input
                id="inv-purchase"
                type="date"
                {...form.register("purchase_date")}
              />
            </div>
            {showMaturity && (
              <div className="space-y-2">
                <Label htmlFor="inv-maturity">Maturity date</Label>
                <Input
                  id="inv-maturity"
                  type="date"
                  {...form.register("maturity_date")}
                />
              </div>
            )}
            {showRate && (
              <div className="space-y-2">
                <Label htmlFor="inv-rate">Interest rate %</Label>
                <Input
                  id="inv-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 7.1"
                  {...form.register("interest_rate")}
                />
              </div>
            )}
            {(type === "ppf" || type === "epf" || type === "nps") && (
              <div className="space-y-2">
                <Label>Sub-type</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        if (v != null) field.onChange(v);
                      }}
                      items={{ ppf: "PPF", epf: "EPF", nps: "NPS" }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ppf">PPF</SelectItem>
                        <SelectItem value="epf">EPF</SelectItem>
                        <SelectItem value="nps">NPS</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
            {(type === "fd" || type === "rd") && (
              <div className="space-y-2">
                <Label>Deposit type</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        if (v != null) field.onChange(v);
                      }}
                      items={{ fd: "Fixed Deposit", rd: "Recurring Deposit" }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fd">Fixed Deposit</SelectItem>
                        <SelectItem value="rd">Recurring Deposit</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
            {(type === "gold" || type === "silver") && (
              <div className="space-y-2">
                <Label>Metal</Label>
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        if (v != null) field.onChange(v);
                      }}
                      items={{ gold: "Gold", silver: "Silver" }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs">
            <p className="text-muted-foreground">Preview</p>
            <p
              className={`mt-1 text-sm font-medium tabular-nums ${
                preview.gain >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatINR(preview.gain)} ({formatPercent(preview.gain_percent)})
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Value {formatINR(preview.current_value)} · Cost{" "}
              {formatINR(preview.invested_amount)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea
              id="inv-notes"
              placeholder="Optional — folio no., goal tag, etc."
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
              {isEdit ? "Save changes" : "Add investment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
