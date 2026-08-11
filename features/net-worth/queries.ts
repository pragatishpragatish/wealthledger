import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import type {
  ChartPoint,
  NetWorthSnapshot,
} from "@/types";

export type NetWorthLive = {
  totalCash: number;
  totalInvestments: number;
  creditCardOutstanding: number;
  loanOutstanding: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

export type NetWorthBreakdownItem = {
  id: string;
  label: string;
  subtitle?: string;
  amount: number;
  kind: "asset" | "liability";
};

export type NetWorthPageData = {
  live: NetWorthLive;
  snapshots: NetWorthSnapshot[];
  trend: ChartPoint[];
  assetItems: NetWorthBreakdownItem[];
  liabilityItems: NetWorthBreakdownItem[];
};

export async function computeLiveNetWorth(): Promise<{
  live: NetWorthLive;
  assetItems: NetWorthBreakdownItem[];
  liabilityItems: NetWorthBreakdownItem[];
}> {
  const { supabase, user } = await requireUser();

  const [accountsRes, investmentsRes, loansRes, cardsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, bank_name, current_balance, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("investments")
      .select("id, name, type, current_value, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("loans")
      .select("id, name, bank, outstanding_principal, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("credit_cards")
      .select("id, bank, card_name, outstanding, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
  ]);

  if (accountsRes.error) throw new Error(accountsRes.error.message);
  if (investmentsRes.error) throw new Error(investmentsRes.error.message);
  if (loansRes.error) throw new Error(loansRes.error.message);
  if (cardsRes.error) throw new Error(cardsRes.error.message);

  const accounts = accountsRes.data ?? [];
  const investments = investmentsRes.data ?? [];
  const loans = loansRes.data ?? [];
  const cards = cardsRes.data ?? [];

  const totalCash = accounts.reduce(
    (s, a) => s + Number(a.current_balance),
    0
  );
  const totalInvestments = investments.reduce(
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
  const totalAssets = totalCash + totalInvestments;
  const totalLiabilities = creditCardOutstanding + loanOutstanding;

  const assetItems: NetWorthBreakdownItem[] = [
    ...accounts.map((a) => ({
      id: `cash-${a.id}`,
      label: a.name,
      subtitle: a.bank_name,
      amount: Number(a.current_balance),
      kind: "asset" as const,
    })),
    ...investments.map((i) => ({
      id: `inv-${i.id}`,
      label: i.name,
      subtitle: i.type.replaceAll("_", " "),
      amount: Number(i.current_value),
      kind: "asset" as const,
    })),
  ].sort((a, b) => b.amount - a.amount);

  const liabilityItems: NetWorthBreakdownItem[] = [
    ...cards.map((c) => ({
      id: `cc-${c.id}`,
      label: `${c.bank} ${c.card_name}`,
      subtitle: "Credit card",
      amount: Number(c.outstanding),
      kind: "liability" as const,
    })),
    ...loans.map((l) => ({
      id: `loan-${l.id}`,
      label: l.name,
      subtitle: l.bank,
      amount: Number(l.outstanding_principal),
      kind: "liability" as const,
    })),
  ].sort((a, b) => b.amount - a.amount);

  return {
    live: {
      totalCash,
      totalInvestments,
      creditCardOutstanding,
      loanOutstanding,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    },
    assetItems,
    liabilityItems,
  };
}

export async function getNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("snapshot_date", { ascending: true })
    .limit(36);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    ...(row as NetWorthSnapshot),
    total_cash: Number(row.total_cash),
    total_investments: Number(row.total_investments),
    total_assets: Number(row.total_assets),
    total_liabilities: Number(row.total_liabilities),
    credit_card_outstanding: Number(row.credit_card_outstanding),
    loan_outstanding: Number(row.loan_outstanding),
    net_worth: Number(row.net_worth),
  }));
}

export async function getNetWorthPageData(): Promise<NetWorthPageData> {
  const [{ live, assetItems, liabilityItems }, snapshots] = await Promise.all([
    computeLiveNetWorth(),
    getNetWorthSnapshots(),
  ]);

  const trend: ChartPoint[] =
    snapshots.length > 0
      ? snapshots.map((s) => ({
          label: format(new Date(s.snapshot_date), "MMM yy"),
          value: s.net_worth,
          secondary: s.total_assets,
        }))
      : [
          {
            label: format(new Date(), "MMM yy"),
            value: live.netWorth,
            secondary: live.totalAssets,
          },
        ];

  return {
    live,
    snapshots,
    trend,
    assetItems,
    liabilityItems,
  };
}
