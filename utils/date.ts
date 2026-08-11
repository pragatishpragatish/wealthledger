import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";

export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDisplayDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy");
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM");
}

export function formatMonthYear(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM yyyy");
}

export function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: toDateString(startOfMonth(now)),
    end: toDateString(endOfMonth(now)),
  };
}

export function getMonthRange(monthsAgo: number): { start: string; end: string } {
  const date = subMonths(new Date(), monthsAgo);
  return {
    start: toDateString(startOfMonth(date)),
    end: toDateString(endOfMonth(date)),
  };
}

export function getLastNMonthsLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = subMonths(new Date(), n - 1 - i);
    return format(d, "MMM");
  });
}

/** Next occurrence of a day-of-month (1–28) from today */
export function nextDueDate(dayOfMonth: number): Date {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  let candidate = new Date(year, month, dayOfMonth);
  if (candidate < today) {
    candidate = new Date(year, month + 1, dayOfMonth);
  }
  return candidate;
}

/**
 * Indian Financial Year helpers (1 Apr → 31 Mar).
 * `startYear` is the calendar year when the FY begins (April).
 * Example: FY 2025-26 → startYear 2025 → 2025-04-01 to 2026-03-31
 */
export function getIndianFYStartYear(date: Date = new Date()): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 4 ? year : year - 1;
}

export function formatIndianFYLabel(startYear: number): string {
  const endShort = String(startYear + 1).slice(-2);
  return `FY ${startYear}-${endShort}`;
}

export function getIndianFYRange(startYear: number): {
  start: Date;
  end: Date;
  label: string;
} {
  return {
    start: new Date(startYear, 3, 1), // 1 Apr
    end: new Date(startYear + 1, 2, 31), // 31 Mar
    label: formatIndianFYLabel(startYear),
  };
}

/** Calendar quarter helpers (Q1=Jan–Mar … Q4=Oct–Dec) */
export function getCalendarQuarter(date: Date = new Date()): {
  year: number;
  quarter: number;
  key: string;
  label: string;
  rangeLabel: string;
} {
  const year = date.getFullYear();
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  const ranges = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"] as const;
  const rangeLabel = ranges[quarter - 1];
  return {
    year,
    quarter,
    key: `${year}-Q${quarter}`,
    label: `Q${quarter} ${year}`,
    rangeLabel,
  };
}

/** Recent Indian FYs for selectors (current first). */
export function listIndianFYOptions(count = 6): {
  startYear: number;
  label: string;
}[] {
  const current = getIndianFYStartYear();
  return Array.from({ length: count }, (_, i) => {
    const startYear = current - i;
    return { startYear, label: formatIndianFYLabel(startYear) };
  });
}
