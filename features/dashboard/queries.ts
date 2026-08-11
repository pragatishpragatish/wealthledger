import { createClient } from "@/lib/supabase/server";
import { getCurrentMonthRange, getCreditCardCycle, nextDueDate, toDateString } from "@/utils/date";
import { format } from "date-fns";
import type {
  AllocationPoint,
  ChartPoint,
  DashboardSummary,
  UpcomingItem,
} from "@/types";

const CHART_COLORS = [
  "#0F766E",
  "#2563EB",
  "#CA8A04",
  "#DB2777",
  "#7C3AED",
  "#EA580C",
  "#0891B2",
  "#16A34A",
];

export async function getDashboardData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { start, end } = getCurrentMonthRange();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const [
    accountsRes,
    investmentsRes,
    loansRes,
    cardsRes,
    monthTxRes,
    historyTxRes,
    snapshotsRes,
    categoriesRes,
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, current_balance, bank_name, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("investments")
      .select("id, type, current_value, invested_amount, name, maturity_date, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("loans")
      .select("id, name, bank, emi, outstanding_principal, start_date, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("credit_cards")
      .select("id, bank, card_name, outstanding, billing_date, due_date, minimum_due, statement_amount, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("transactions")
      .select("id, type, amount, date, category_id")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("transactions")
      .select("type, amount, date, category_id")
      .eq("user_id", user.id)
      .gte("date", toDateString(sixMonthsAgo))
      .lte("date", end)
      .in("type", ["income", "expense"]),
    supabase
      .from("net_worth_snapshots")
      .select("snapshot_date, net_worth, total_cash, total_investments, total_liabilities")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: true })
      .limit(12),
    supabase
      .from("categories")
      .select("id, name, color, kind")
      .eq("user_id", user.id),
  ]);

  const accounts = accountsRes.data ?? [];
  const investments = investmentsRes.data ?? [];
  const loans = loansRes.data ?? [];
  const cards = cardsRes.data ?? [];
  const monthTx = monthTxRes.data ?? [];
  const historyTx = historyTxRes.data ?? [];
  const snapshots = snapshotsRes.data ?? [];
  const categories = categoriesRes.data ?? [];

  const totalCash = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const investmentsValue = investments.reduce(
    (s, i) => s + Number(i.current_value),
    0
  );
  const creditCardOutstanding = cards.reduce(
    (s, c) => s + Number(c.outstanding),
    0
  );
  const loanOutstanding = loans.reduce(
    (s, l) => s + Number(l.outstanding_principal),
    0
  );
  const totalAssets = totalCash + investmentsValue;
  const totalLiabilities = creditCardOutstanding + loanOutstanding;
  const netWorth = totalAssets - totalLiabilities;

  const monthlyIncome = monthTx
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthlySavings = monthlyIncome - monthlyExpense;
  const savingsRate =
    monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

  const summary: DashboardSummary = {
    netWorth,
    totalCash,
    investments: investmentsValue,
    totalAssets,
    totalLiabilities,
    creditCardOutstanding,
    monthlyIncome,
    monthlyExpense,
    monthlySavings,
    savingsRate,
  };

  // Cash flow / income vs expense by month
  const monthMap = new Map<string, { income: number; expense: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = format(d, "yyyy-MM");
    monthMap.set(key, { income: 0, expense: 0 });
  }
  for (const tx of historyTx) {
    const key = tx.date.slice(0, 7);
    const bucket = monthMap.get(key);
    if (!bucket) continue;
    if (tx.type === "income") bucket.income += Number(tx.amount);
    if (tx.type === "expense") bucket.expense += Number(tx.amount);
  }

  const cashFlow: ChartPoint[] = Array.from(monthMap.entries()).map(
    ([key, v]) => ({
      label: format(new Date(key + "-01"), "MMM"),
      value: v.income - v.expense,
      secondary: v.income,
    })
  );

  const incomeVsExpense: ChartPoint[] = Array.from(monthMap.entries()).map(
    ([key, v]) => ({
      label: format(new Date(key + "-01"), "MMM"),
      value: v.income,
      secondary: v.expense,
    })
  );

  const spendingTrend: ChartPoint[] = Array.from(monthMap.entries()).map(
    ([key, v]) => ({
      label: format(new Date(key + "-01"), "MMM"),
      value: v.expense,
    })
  );

  // Investment allocation
  const allocMap = new Map<string, number>();
  for (const inv of investments) {
    const label = inv.type.replaceAll("_", " ");
    allocMap.set(label, (allocMap.get(label) ?? 0) + Number(inv.current_value));
  }
  const investmentAllocation: AllocationPoint[] = Array.from(
    allocMap.entries()
  ).map(([name, value], i) => ({
    name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    value,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Loan breakdown
  const loanBreakdown: AllocationPoint[] = loans.map((l, i) => ({
    name: l.name,
    value: Number(l.outstanding_principal),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Net worth trend
  const netWorthTrend: ChartPoint[] =
    snapshots.length > 0
      ? snapshots.map((s) => ({
          label: format(new Date(s.snapshot_date), "MMM"),
          value: Number(s.net_worth),
        }))
      : [
          {
            label: format(new Date(), "MMM"),
            value: netWorth,
          },
        ];

  // Spending by category this month
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const spendByCat = new Map<string, number>();
  for (const tx of monthTx.filter((t) => t.type === "expense")) {
    const cat = tx.category_id ? catMap.get(tx.category_id) : null;
    const name = cat?.name ?? "Uncategorized";
    spendByCat.set(name, (spendByCat.get(name) ?? 0) + Number(tx.amount));
  }
  const categorySpend: AllocationPoint[] = Array.from(spendByCat.entries())
    .map(([name, value], i) => ({
      name,
      value,
      color:
        categories.find((c) => c.name === name)?.color ??
        CHART_COLORS[i % CHART_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Upcoming
  const upcoming: UpcomingItem[] = [];

  for (const card of cards) {
    const statementAmount = Number(card.statement_amount);
    // Unbilled outstanding is not a payment due yet.
    if (statementAmount <= 0) continue;

    const cycle = getCreditCardCycle(
      Number(card.billing_date),
      Number(card.due_date)
    );
    upcoming.push({
      id: `cc-${card.id}`,
      type: "credit_card",
      title: `${card.bank} ${card.card_name}`,
      amount: statementAmount,
      dueDate: toDateString(cycle.currentStatementDueDate),
      subtitle: `Min due ${Number(card.minimum_due).toLocaleString("en-IN")}`,
      href: "/credit-cards",
    });
  }

  for (const loan of loans) {
    const startDay = new Date(loan.start_date).getDate();
    const due = nextDueDate(Math.min(startDay, 28));
    upcoming.push({
      id: `emi-${loan.id}`,
      type: "emi",
      title: `${loan.name} EMI`,
      amount: Number(loan.emi),
      dueDate: toDateString(due),
      subtitle: loan.bank,
      href: "/loans",
    });
  }

  for (const inv of investments) {
    if (inv.maturity_date) {
      const mat = new Date(inv.maturity_date);
      const in90 = new Date();
      in90.setDate(in90.getDate() + 90);
      if (mat <= in90) {
        upcoming.push({
          id: `fd-${inv.id}`,
          type: "fd_maturity",
          title: inv.name,
          amount: Number(inv.current_value),
          dueDate: inv.maturity_date,
          subtitle: "Maturity",
          href: "/investments",
        });
      }
    }
  }

  upcoming.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return {
    summary,
    cashFlow,
    incomeVsExpense,
    spendingTrend,
    investmentAllocation,
    loanBreakdown,
    netWorthTrend,
    categorySpend,
    upcoming: upcoming.slice(0, 8),
    bankBalances: accounts.reduce<Record<string, number>>((acc, a) => {
      acc[a.bank_name] = (acc[a.bank_name] ?? 0) + Number(a.current_balance);
      return acc;
    }, {}),
  };
}

export type DashboardData = NonNullable<
  Awaited<ReturnType<typeof getDashboardData>>
>;
