"use client";

import type { CSSProperties, ReactNode } from "react";
import { Tooltip } from "recharts";
import { formatINR } from "@/utils/currency";

/** Solid surface so values stay readable over chart fills/lines. */
export const chartTooltipContentStyle: CSSProperties = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  fontSize: "12px",
  padding: "8px 12px",
  boxShadow: "0 10px 25px -8px rgb(0 0 0 / 0.25)",
};

export const chartTooltipLabelStyle: CSSProperties = {
  color: "var(--muted-foreground)",
  marginBottom: 4,
  fontWeight: 500,
};

export const chartTooltipItemStyle: CSSProperties = {
  color: "var(--popover-foreground)",
};

export const chartTooltipWrapperStyle: CSSProperties = {
  zIndex: 40,
  outline: "none",
  pointerEvents: "none",
};

type PayloadItem = {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number;
  payload?: unknown;
};

type CustomTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: PayloadItem[];
  formatter?: (value: number, name: string) => ReactNode;
  labelFormatter?: (label: string | number) => ReactNode;
};

/**
 * Custom tooltip rendered above the cursor so it doesn’t sit on the series.
 */
export function ChartTooltipBody({
  active,
  label,
  payload,
  formatter,
  labelFormatter,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const title =
    label == null || label === ""
      ? null
      : labelFormatter
        ? labelFormatter(label)
        : String(label);

  return (
    <div
      className="min-w-[8rem] rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
      style={{ transform: "translateY(-12px)" }}
    >
      {title != null && (
        <p className="mb-1.5 font-medium text-muted-foreground">{title}</p>
      )}
      <ul className="space-y-1">
        {payload.map((entry, i) => {
          const raw = entry.value;
          const numeric = Number(Array.isArray(raw) ? raw[0] : raw ?? 0);
          const name = String(entry.name ?? entry.dataKey ?? "Value");
          const display = formatter
            ? formatter(numeric, name)
            : formatINR(numeric);
          return (
            <li
              key={`${name}-${i}`}
              className="flex items-center justify-between gap-4 tabular-nums"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color ?? "var(--primary)" }}
                />
                {name}
              </span>
              <span className="font-medium text-popover-foreground">
                {display}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type ChartTooltipProps = {
  formatter?: (value: number, name: string) => ReactNode;
  labelFormatter?: (label: string | number) => ReactNode;
  /** Currency formatter shortcut (default). */
  currency?: boolean;
};

/** Drop-in Recharts Tooltip with clearer placement + contrast. */
export function ChartTooltip({
  formatter,
  labelFormatter,
  currency = true,
}: ChartTooltipProps = {}) {
  const resolvedFormatter =
    formatter ??
    (currency
      ? (value: number) => formatINR(value)
      : (value: number) => String(value));

  return (
    <Tooltip
      offset={28}
      allowEscapeViewBox={{ x: true, y: true }}
      wrapperStyle={chartTooltipWrapperStyle}
      cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "4 4" }}
      content={
        <ChartTooltipBody
          formatter={resolvedFormatter}
          labelFormatter={labelFormatter}
        />
      }
    />
  );
}
