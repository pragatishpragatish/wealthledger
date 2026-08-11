import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
} from "date-fns";
import { requireUser } from "@/lib/auth";
import { clampDayOfMonth, getCreditCardCycle, toDateString } from "@/utils/date";

export type CalendarEventType =
  | "credit_card"
  | "emi"
  | "maturity"
  | "goal"
  | "income";

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  subtitle?: string;
  amount: number | null;
  date: string;
  href: string;
};

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
};

export type CalendarPageData = {
  year: number;
  month: number;
  monthLabel: string;
  days: CalendarDay[];
  events: CalendarEvent[];
  upcoming: CalendarEvent[];
};

const HORIZON_MONTHS = 3;

export async function getCalendarPageData(opts?: {
  year?: number;
  month?: number;
}): Promise<CalendarPageData> {
  const { supabase, user } = await requireUser();
  const now = new Date();
  const year = opts?.year ?? now.getFullYear();
  const month = opts?.month ?? now.getMonth() + 1;
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const horizonEnd = endOfMonth(addMonths(now, HORIZON_MONTHS));
  const todayStr = toDateString(now);

  const [cardsRes, loansRes, invRes, goalsRes, incomeRes] =
    await Promise.all([
    supabase
      .from("credit_cards")
      .select(
        "id, bank, card_name, billing_date, due_date, outstanding, statement_amount, minimum_due, is_active"
      )
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("loans")
      .select("id, name, bank, emi, start_date, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("investments")
      .select("id, name, type, current_value, maturity_date, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .not("maturity_date", "is", null)
      .lte("maturity_date", toDateString(horizonEnd))
      .gte("maturity_date", todayStr),
    supabase
      .from("goals")
      .select("id, name, target_amount, target_date, is_completed")
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .not("target_date", "is", null)
      .lte("target_date", toDateString(horizonEnd))
      .gte("target_date", todayStr),
    supabase
      .from("transactions")
      .select("id, amount, date, merchant, notes, category:categories(name)")
      .eq("user_id", user.id)
      .eq("type", "income")
      .eq("is_recurring", true)
      .order("date", { ascending: false })
      .limit(50),
  ]);

  if (cardsRes.error) throw new Error(cardsRes.error.message);
  if (loansRes.error) throw new Error(loansRes.error.message);
  if (invRes.error) throw new Error(invRes.error.message);
  if (goalsRes.error) throw new Error(goalsRes.error.message);
  if (incomeRes.error) throw new Error(incomeRes.error.message);

  const events: CalendarEvent[] = [];

  for (const card of cardsRes.data ?? []) {
    const billingDay = Number(card.billing_date);
    const dueDay = Number(card.due_date);
    const statementAmount = Number(card.statement_amount);
    const cycle = getCreditCardCycle(billingDay, dueDay, now);

    // Open statement payment due (only when there is a billed amount).
    if (statementAmount > 0) {
      const due = cycle.currentStatementDueDate;
      if (
        (due >= now || toDateString(due) === todayStr) &&
        due <= horizonEnd
      ) {
        events.push({
          id: `cc-${card.id}-${toDateString(due)}`,
          type: "credit_card",
          title: `${card.bank} ${card.card_name}`,
          subtitle: `Statement due · Min ₹${Number(card.minimum_due).toLocaleString("en-IN")}`,
          amount: statementAmount,
          date: toDateString(due),
          href: "/credit-cards",
        });
      }
    }

    // Upcoming statement generation dates in the horizon (no payment amount).
    for (let i = 0; i < HORIZON_MONTHS + 2; i++) {
      const base = addMonths(
        new Date(
          cycle.nextStatementDate.getFullYear(),
          cycle.nextStatementDate.getMonth(),
          1
        ),
        i
      );
      const statementDate = clampDayOfMonth(
        base.getFullYear(),
        base.getMonth(),
        billingDay
      );
      if (statementDate < now && toDateString(statementDate) !== todayStr) {
        continue;
      }
      if (statementDate > horizonEnd) continue;

      events.push({
        id: `cc-stmt-${card.id}-${toDateString(statementDate)}`,
        type: "credit_card",
        title: `${card.bank} ${card.card_name}`,
        subtitle: "Statement date",
        amount: null,
        date: toDateString(statementDate),
        href: "/credit-cards",
      });
    }
  }

  for (const loan of loansRes.data ?? []) {
    for (let i = 0; i < HORIZON_MONTHS + 1; i++) {
      const base = addMonths(new Date(year, month - 1, 1), i);
      const emiDay = Math.min(parseISO(loan.start_date).getDate(), 28);
      const due = new Date(base.getFullYear(), base.getMonth(), emiDay);
      if (due < now && toDateString(due) !== todayStr) continue;
      if (due > horizonEnd) continue;
      events.push({
        id: `emi-${loan.id}-${toDateString(due)}`,
        type: "emi",
        title: `${loan.name} EMI`,
        subtitle: loan.bank,
        amount: Number(loan.emi),
        date: toDateString(due),
        href: "/loans",
      });
    }
  }

  for (const inv of invRes.data ?? []) {
    if (!inv.maturity_date) continue;
    events.push({
      id: `mat-${inv.id}`,
      type: "maturity",
      title: inv.name,
      subtitle: `${inv.type.replaceAll("_", " ")} maturity`,
      amount: Number(inv.current_value),
      date: inv.maturity_date,
      href: "/investments",
    });
  }

  for (const goal of goalsRes.data ?? []) {
    if (!goal.target_date) continue;
    events.push({
      id: `goal-${goal.id}`,
      type: "goal",
      title: goal.name,
      subtitle: "Goal target",
      amount: Number(goal.target_amount),
      date: goal.target_date,
      href: "/goals",
    });
  }

  // Deduplicate recurring income by category/merchant pattern — take latest sample per day-of-month + label
  const seenIncome = new Set<string>();
  for (const tx of incomeRes.data ?? []) {
    const rawCat = tx.category as
      | { name: string }
      | { name: string }[]
      | null;
    const cat = Array.isArray(rawCat) ? rawCat[0] : rawCat;
    const label = cat?.name ?? tx.merchant ?? "Recurring income";
    const key = `${label}-${parseISO(tx.date).getDate()}`;
    if (seenIncome.has(key)) continue;
    seenIncome.add(key);

    for (let i = 0; i < HORIZON_MONTHS + 1; i++) {
      const base = addMonths(new Date(year, month - 1, 1), i);
      const day = Math.min(parseISO(tx.date).getDate(), 28);
      const due = new Date(base.getFullYear(), base.getMonth(), day);
      if (due < now && toDateString(due) !== todayStr) continue;
      if (due > horizonEnd) continue;
      events.push({
        id: `inc-${tx.id}-${toDateString(due)}`,
        type: "income",
        title: label,
        subtitle: "Recurring income",
        amount: Number(tx.amount),
        date: toDateString(due),
        href: "/income",
      });
    }
  }

  events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Build month grid (Sun–Sat)
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart); // 0 = Sunday
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - startPad);
  const totalCells = Math.ceil((startPad + monthDays.length) / 7) * 7;
  const cells: CalendarDay[] = [];

  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const dateStr = toDateString(d);
    const inMonth = d.getMonth() === monthStart.getMonth();
    cells.push({
      date: dateStr,
      day: d.getDate(),
      inMonth,
      isToday: dateStr === todayStr,
      events: events.filter((e) => e.date === dateStr),
    });
  }

  const upcoming = events.filter((e) => e.date >= todayStr).slice(0, 20);

  return {
    year,
    month,
    monthLabel: format(monthStart, "MMMM yyyy"),
    days: cells,
    events: events.filter(
      (e) => e.date >= toDateString(monthStart) && e.date <= toDateString(monthEnd)
    ),
    upcoming,
  };
}
