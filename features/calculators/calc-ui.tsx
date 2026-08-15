"use client";

import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { amountInWords } from "@/utils/amount-in-words";

/** Empty / invalid input → 0 for calculator math. */
export function parseAmount(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function CalcField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

type CalcMoneyInputProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  step?: ComponentProps<"input">["step"];
  className?: string;
};

/** Money field: blank by default, amount shown in words underneath. */
export function CalcMoneyInput({
  label,
  hint,
  value,
  onChange,
  placeholder = "e.g. 50000",
  disabled,
  step = 1,
  className,
}: CalcMoneyInputProps) {
  const trimmed = value.trim();
  const amount = parseAmount(value);
  const words =
    trimmed === "" || !Number.isFinite(amount)
      ? null
      : amountInWords(amount);

  return (
    <CalcField label={label} hint={hint}>
      <Input
        type="number"
        min={0}
        step={step}
        inputMode="decimal"
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        autoComplete="off"
      />
      {words ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {words}
        </p>
      ) : null}
    </CalcField>
  );
}

export function CalcStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "default" | "positive" | "teal";
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-heading text-lg font-semibold tabular-nums",
          accent === "positive" &&
            "text-emerald-700 dark:text-emerald-400",
          accent === "teal" && "text-teal-800 dark:text-teal-300"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function CalcToggle({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        checked
          ? "border-teal-600/40 bg-teal-500/10"
          : "border-border/60 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
          checked
            ? "border-teal-600 bg-teal-600 text-white"
            : "border-border"
        )}
        aria-hidden
      >
        {checked ? "✓" : null}
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
