import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";

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

/** `yyyy-MM` key for a calendar month. */
export function getMonthKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM");
}

export function parseMonthKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(key)) return null;
  const [y, m] = key.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  return new Date(y, m - 1, 1);
}

export function formatMonthKeyLabel(key: string): string {
  const d = parseMonthKey(key);
  return d ? format(d, "MMMM yyyy") : key;
}

export function shiftMonthKey(key: string, delta: number): string {
  const d = parseMonthKey(key) ?? new Date();
  return getMonthKey(addMonths(d, delta));
}

/** Inclusive start/end date strings for a `yyyy-MM` month. */
export function getMonthBoundsFromKey(key: string): {
  start: string;
  end: string;
} {
  const d = parseMonthKey(key) ?? startOfMonth(new Date());
  return {
    start: toDateString(startOfMonth(d)),
    end: toDateString(endOfMonth(d)),
  };
}

/** Inclusive range spanning fromMonth…toMonth (`yyyy-MM`). */
export function getBoundsForMonthSpan(
  fromMonth: string,
  toMonth: string
): { start: string; end: string } {
  let startKey = fromMonth;
  let endKey = toMonth;
  if (startKey > endKey) {
    [startKey, endKey] = [endKey, startKey];
  }
  const start = getMonthBoundsFromKey(startKey).start;
  const end = getMonthBoundsFromKey(endKey).end;
  return { start, end };
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

/** Local calendar day at 00:00 (avoids time-of-day skew). */
export function startOfLocalDay(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Build a date for `day` in a given month, clamping to the last day when
 * the month is shorter (e.g. billing day 31 in February → 28/29).
 * `monthIndex` is 0-based; may be out of range (JS Date rolls over).
 */
export function clampDayOfMonth(
  year: number,
  monthIndex: number,
  day: number
): Date {
  const safeDay = Number.isFinite(day) ? Math.trunc(day) : 1;
  const requested = Math.min(31, Math.max(1, safeDay));
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(requested, lastDay));
}

/**
 * Next occurrence of a day-of-month from `from` (used for EMI / simple schedules).
 * Prefer {@link getCreditCardCycle} for credit cards (billing + due days).
 */
export function nextDueDate(dayOfMonth: number, from: Date = new Date()): Date {
  const today = startOfLocalDay(from);
  const year = today.getFullYear();
  const month = today.getMonth();
  let candidate = clampDayOfMonth(year, month, dayOfMonth);
  if (candidate < today) {
    candidate = clampDayOfMonth(year, month + 1, dayOfMonth);
  }
  return candidate;
}

export type CreditCardCycle = {
  /** Next statement generation date (unbilled spend lands here). */
  nextStatementDate: Date;
  /** Payment due date tied to {@link nextStatementDate}. */
  nextDueDate: Date;
  /** Most recent statement that has already been generated (incl. today). */
  lastStatementDate: Date;
  /** Payment due date for {@link lastStatementDate}. */
  currentStatementDueDate: Date;
};

/**
 * Credit-card billing cycle from statement day + due day.
 *
 * - Before billing day: next statement is this month's billing day.
 * - On/after billing day: next statement is next month's billing day.
 * - Due day is always in the same calendar month as its statement
 *   (clamped for short months).
 */
export function getCreditCardCycle(
  billingDay: number,
  dueDay: number,
  from: Date = new Date()
): CreditCardCycle {
  const today = startOfLocalDay(from);
  const year = today.getFullYear();
  const month = today.getMonth();

  const billingThisMonth = clampDayOfMonth(year, month, billingDay);

  const nextStatementDate =
    today < billingThisMonth
      ? billingThisMonth
      : clampDayOfMonth(year, month + 1, billingDay);

  const nextDueDateValue = clampDayOfMonth(
    nextStatementDate.getFullYear(),
    nextStatementDate.getMonth(),
    dueDay
  );

  const lastStatementDate = clampDayOfMonth(
    nextStatementDate.getFullYear(),
    nextStatementDate.getMonth() - 1,
    billingDay
  );

  const currentStatementDueDate = clampDayOfMonth(
    lastStatementDate.getFullYear(),
    lastStatementDate.getMonth(),
    dueDay
  );

  return {
    nextStatementDate,
    nextDueDate: nextDueDateValue,
    lastStatementDate,
    currentStatementDueDate,
  };
}

/**
 * Date to show for "due" on a card:
 * - If a statement amount is open (> 0), use that statement's due date.
 * - Otherwise use the due date of the *next* statement (unbilled not yet due).
 */
export function getCreditCardDisplayDueDate(
  billingDay: number,
  dueDay: number,
  statementAmount: number,
  from: Date = new Date()
): Date {
  const cycle = getCreditCardCycle(billingDay, dueDay, from);
  if (statementAmount > 0) return cycle.currentStatementDueDate;
  return cycle.nextDueDate;
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
