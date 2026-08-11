import { Suspense } from "react";
import { TransactionsView } from "@/features/transactions/transactions-view";
import {
  getTransactionFiltersData,
  getTransactions,
  type TransactionSort,
} from "@/features/transactions/queries";
import type { TransactionType } from "@/types";
import {
  getBoundsForMonthSpan,
  getMonthBoundsFromKey,
  getMonthKey,
  parseMonthKey,
} from "@/utils/date";

export const metadata = { title: "Transactions · WealthLedger" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function resolvePeriod(sp: Record<string, string | string[] | undefined>): {
  period: "month" | "range";
  month: string;
  fromMonth: string;
  toMonth: string;
  from: string;
  to: string;
} {
  const current = getMonthKey();
  const periodRaw = first(sp.period);
  const hasLegacyDates = Boolean(first(sp.from) || first(sp.to));

  // Custom range: explicit period=range, or legacy from/to without period
  if (periodRaw === "range" || (periodRaw !== "month" && hasLegacyDates && !first(sp.month))) {
    let fromMonth = first(sp.fromMonth);
    let toMonth = first(sp.toMonth);

    // Migrate legacy day dates → month keys when needed
    if (!fromMonth && first(sp.from)) {
      fromMonth = first(sp.from).slice(0, 7);
    }
    if (!toMonth && first(sp.to)) {
      toMonth = first(sp.to).slice(0, 7);
    }

    fromMonth = parseMonthKey(fromMonth) ? fromMonth : current;
    toMonth = parseMonthKey(toMonth) ? toMonth : fromMonth;
    const bounds = getBoundsForMonthSpan(fromMonth, toMonth);
    return {
      period: "range",
      month: current,
      fromMonth,
      toMonth,
      from: bounds.start,
      to: bounds.end,
    };
  }

  // Default / month mode → current month when unset
  const monthRaw = first(sp.month);
  const month = parseMonthKey(monthRaw) ? monthRaw : current;
  const bounds = getMonthBoundsFromKey(month);
  return {
    period: "month",
    month,
    fromMonth: month,
    toMonth: month,
    from: bounds.start,
    to: bounds.end,
  };
}

async function TransactionsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const search = first(sp.search);
  const typeRaw = first(sp.type) || "all";
  const accountId = first(sp.accountId);
  const sort = (first(sp.sort) || "date_desc") as TransactionSort;
  const page = Math.max(1, Number(first(sp.page) || "1") || 1);
  const pageSize = 20;

  const { period, month, fromMonth, toMonth, from, to } = resolvePeriod(sp);

  const validTypes = new Set([
    "all",
    "income",
    "expense",
    "transfer",
    "adjustment",
  ]);
  const type = validTypes.has(typeRaw) ? typeRaw : "all";

  const validSorts = new Set([
    "date_desc",
    "date_asc",
    "amount_desc",
    "amount_asc",
  ]);
  const safeSort = (
    validSorts.has(sort) ? sort : "date_desc"
  ) as TransactionSort;

  const [data, filtersData] = await Promise.all([
    getTransactions({
      page,
      pageSize,
      search: search || undefined,
      type: type as TransactionType | "all",
      accountId: accountId || undefined,
      from,
      to,
      sort: safeSort,
    }),
    getTransactionFiltersData(),
  ]);

  return (
    <TransactionsView
      data={data}
      accounts={filtersData.accounts}
      categories={filtersData.categories}
      filters={{
        search,
        type,
        accountId,
        sort: safeSort,
        period,
        month,
        fromMonth,
        toMonth,
        from,
        to,
      }}
    />
  );
}

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      }
    >
      <TransactionsContent searchParams={searchParams} />
    </Suspense>
  );
}
