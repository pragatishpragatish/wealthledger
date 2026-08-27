import { requireUser } from "@/lib/auth";
import type { Account, Investment } from "@/types";
import {
  summarizeInvestments,
  type InvestmentComputed,
  type InvestmentContribution,
  type InvestmentsPageData,
  type InvestmentsSummary,
} from "@/features/investments/summary";

export type {
  InvestmentComputed,
  InvestmentContribution,
  InvestmentsPageData,
  InvestmentsSummary,
} from "@/features/investments/summary";
export { summarizeInvestments } from "@/features/investments/summary";

export type InvestmentFundingAccount = Pick<
  Account,
  "id" | "name" | "bank_name" | "current_balance" | "account_type"
>;

export type InvestmentsPageDataWithAccounts = InvestmentsPageData & {
  accounts: InvestmentFundingAccount[];
};

function mapInvestment(
  row: Record<string, unknown>,
  contributions: InvestmentContribution[] = []
): InvestmentComputed {
  const invested_amount = Number(row.invested_amount);
  const current_value = Number(row.current_value);
  const gain = Math.round((current_value - invested_amount) * 100) / 100;
  const gain_percent =
    invested_amount > 0
      ? Math.round((gain / invested_amount) * 10000) / 100
      : 0;

  return {
    ...(row as unknown as Investment),
    units: Number(row.units),
    buy_price: Number(row.buy_price),
    current_price: Number(row.current_price),
    invested_amount,
    current_value,
    symbol: (row.symbol as string | null) ?? null,
    last_priced_at: (row.last_priced_at as string | null) ?? null,
    interest_rate:
      row.interest_rate == null ? null : Number(row.interest_rate),
    is_sip: Boolean(row.is_sip),
    sip_amount: Number(row.sip_amount ?? 0),
    sip_day: row.sip_day == null ? null : Number(row.sip_day),
    sip_frequency:
      (row.sip_frequency as Investment["sip_frequency"]) ?? null,
    sip_start_date: (row.sip_start_date as string | null) ?? null,
    gain,
    gain_percent,
    contributions,
    contribution_count: contributions.length,
  };
}

export async function getInvestments(opts?: {
  includeInactive?: boolean;
}): Promise<InvestmentComputed[]> {
  const { supabase, user } = await requireUser();

  let query = supabase
    .from("investments")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const investments = data ?? [];
  const ids = investments.map((row) => row.id as string);

  const contributionsByInvestment = new Map<string, InvestmentContribution[]>();

  if (ids.length > 0) {
    const { data: txRows, error: txError } = await supabase
      .from("investment_transactions")
      .select("id, investment_id, date, type, units, price, amount, notes")
      .eq("user_id", user.id)
      .in("investment_id", ids)
      .in("type", ["buy", "sip"])
      .order("date", { ascending: false });

    if (txError) throw new Error(txError.message);

    for (const row of txRows ?? []) {
      const item: InvestmentContribution = {
        id: row.id as string,
        investment_id: row.investment_id as string,
        date: row.date as string,
        type: row.type as string,
        units: Number(row.units ?? 0),
        price: Number(row.price ?? 0),
        amount: Number(row.amount),
        notes: (row.notes as string | null) ?? null,
      };
      const list = contributionsByInvestment.get(item.investment_id) ?? [];
      list.push(item);
      contributionsByInvestment.set(item.investment_id, list);
    }
  }

  return investments.map((row) =>
    mapInvestment(
      row as Record<string, unknown>,
      contributionsByInvestment.get(row.id as string) ?? []
    )
  );
}

export async function getInvestmentsPageData(): Promise<InvestmentsPageDataWithAccounts> {
  const { supabase, user } = await requireUser();
  const [investments, accountsRes] = await Promise.all([
    getInvestments(),
    supabase
      .from("accounts")
      .select("id, name, bank_name, current_balance, account_type")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("bank_name")
      .order("name"),
  ]);

  if (accountsRes.error) throw new Error(accountsRes.error.message);

  return {
    investments,
    summary: summarizeInvestments(investments),
    accounts: (accountsRes.data ?? []).map((a) => ({
      id: a.id as string,
      name: a.name as string,
      bank_name: a.bank_name as string,
      current_balance: Number(a.current_balance),
      account_type: a.account_type as Account["account_type"],
    })),
  };
}
