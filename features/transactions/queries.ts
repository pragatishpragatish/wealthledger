import { requireUser } from "@/lib/auth";
import type { Account, Category, Transaction, TransactionType } from "@/types";

export type TransactionSort =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc";

export type GetTransactionsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: TransactionType | "all";
  accountId?: string;
  from?: string;
  to?: string;
  sort?: TransactionSort;
};

export type TransactionsResult = {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type TxRow = {
  id: string;
  user_id: string;
  type: TransactionType;
  date: string;
  amount: number | string;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  merchant: string | null;
  notes: string | null;
  payment_method: Transaction["payment_method"];
  receipt_url: string | null;
  is_recurring: boolean;
  recurring_frequency: Transaction["recurring_frequency"];
  credit_card_id: string | null;
  created_at: string;
  updated_at: string;
  category: Category | Category[] | null;
  account: Account | Account[] | null;
  to_account: Account | Account[] | null;
  transaction_tags?: { tag: { id: string; name: string; color: string | null; user_id: string; created_at: string } | null }[];
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapTransaction(row: TxRow): Transaction {
  const tags =
    row.transaction_tags
      ?.map((tt) => tt.tag)
      .filter((t): t is NonNullable<typeof t> => Boolean(t)) ?? [];

  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    date: row.date,
    amount: Number(row.amount),
    category_id: row.category_id,
    account_id: row.account_id,
    to_account_id: row.to_account_id,
    merchant: row.merchant,
    notes: row.notes,
    payment_method: row.payment_method,
    receipt_url: row.receipt_url,
    is_recurring: row.is_recurring,
    recurring_frequency: row.recurring_frequency,
    credit_card_id: row.credit_card_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: one(row.category),
    account: one(row.account)
      ? {
          ...one(row.account)!,
          opening_balance: Number(one(row.account)!.opening_balance),
          current_balance: Number(one(row.account)!.current_balance),
        }
      : null,
    to_account: one(row.to_account)
      ? {
          ...one(row.to_account)!,
          opening_balance: Number(one(row.to_account)!.opening_balance),
          current_balance: Number(one(row.to_account)!.current_balance),
        }
      : null,
    tags,
  };
}

const SELECT = `
  *,
  category:categories(*),
  account:accounts!transactions_account_id_fkey(*),
  to_account:accounts!transactions_to_account_id_fkey(*),
  transaction_tags(tag:tags(*))
`;

export async function getTransactions(
  params: GetTransactionsParams = {}
): Promise<TransactionsResult> {
  const {
    page = 1,
    pageSize = 20,
    search,
    type = "all",
    accountId,
    from,
    to,
    sort = "date_desc",
  } = params;

  const { supabase, user } = await requireUser();
  const fromIdx = (Math.max(page, 1) - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  let query = supabase
    .from("transactions")
    .select(SELECT, { count: "exact" })
    .eq("user_id", user.id);

  if (type && type !== "all") {
    query = query.eq("type", type);
  }
  if (accountId) {
    query = query.or(
      `account_id.eq.${accountId},to_account_id.eq.${accountId}`
    );
  }
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  if (search?.trim()) {
    const q = search.trim();
    query = query.or(
      `merchant.ilike.%${q}%,notes.ilike.%${q}%`
    );
  }

  switch (sort) {
    case "date_asc":
      query = query
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });
      break;
    case "amount_desc":
      query = query.order("amount", { ascending: false });
      break;
    case "amount_asc":
      query = query.order("amount", { ascending: true });
      break;
    case "date_desc":
    default:
      query = query
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(fromIdx, toIdx);
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    transactions: ((data ?? []) as unknown as TxRow[]).map(mapTransaction),
    total,
    page: Math.max(page, 1),
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getTransactionFiltersData(): Promise<{
  accounts: Pick<
    Account,
    "id" | "name" | "bank_name" | "current_balance" | "account_type"
  >[];
  categories: Pick<Category, "id" | "name" | "kind" | "color">[];
}> {
  const { supabase, user } = await requireUser();

  const [accountsRes, categoriesRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, bank_name, current_balance, account_type")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name, kind, color")
      .eq("user_id", user.id)
      .order("sort_order")
      .order("name"),
  ]);

  if (accountsRes.error) throw new Error(accountsRes.error.message);
  if (categoriesRes.error) throw new Error(categoriesRes.error.message);

  return {
    accounts: (accountsRes.data ?? []).map((a) => ({
      ...a,
      account_type: a.account_type as Account["account_type"],
      current_balance: Number(a.current_balance),
    })),
    categories: categoriesRes.data ?? [],
  };
}
