import { Suspense } from "react";
import { TransactionsView } from "@/features/transactions/transactions-view";
import {
  getTransactionFiltersData,
  getTransactions,
  type TransactionSort,
} from "@/features/transactions/queries";
import type { TransactionType } from "@/types";

export const metadata = { title: "Transactions · WealthLedger" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
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
  const from = first(sp.from);
  const to = first(sp.to);
  const sort = (first(sp.sort) || "date_desc") as TransactionSort;
  const page = Math.max(1, Number(first(sp.page) || "1") || 1);
  const pageSize = 20;

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
      from: from || undefined,
      to: to || undefined,
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
        from,
        to,
        sort: safeSort,
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
