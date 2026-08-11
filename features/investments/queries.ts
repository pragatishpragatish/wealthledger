import { requireUser } from "@/lib/auth";
import { INVESTMENT_TYPES } from "@/lib/constants";
import type { AllocationPoint, Investment } from "@/types";

const TYPE_COLORS: Record<string, string> = {
  stocks: "#0F766E",
  mutual_funds: "#2563EB",
  etf: "#0891B2",
  fd: "#CA8A04",
  rd: "#D97706",
  ppf: "#7C3AED",
  epf: "#9333EA",
  nps: "#4F46E5",
  gold: "#EAB308",
  silver: "#64748B",
  crypto: "#EA580C",
  bonds: "#059669",
  real_estate: "#BE185D",
};

export type InvestmentComputed = Investment & {
  gain: number;
  gain_percent: number;
};

export type InvestmentsSummary = {
  portfolioValue: number;
  invested: number;
  profitLoss: number;
  profitLossPercent: number;
  count: number;
  allocation: AllocationPoint[];
};

export type InvestmentsPageData = {
  investments: InvestmentComputed[];
  summary: InvestmentsSummary;
};

function mapInvestment(row: Record<string, unknown>): InvestmentComputed {
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

  return (data ?? []).map((row) =>
    mapInvestment(row as Record<string, unknown>)
  );
}

export async function getInvestmentsPageData(): Promise<InvestmentsPageData> {
  const investments = await getInvestments();

  const portfolioValue = investments.reduce((s, i) => s + i.current_value, 0);
  const invested = investments.reduce((s, i) => s + i.invested_amount, 0);
  const profitLoss = Math.round((portfolioValue - invested) * 100) / 100;
  const profitLossPercent =
    invested > 0 ? Math.round((profitLoss / invested) * 10000) / 100 : 0;

  const byType = new Map<string, number>();
  for (const inv of investments) {
    byType.set(inv.type, (byType.get(inv.type) ?? 0) + inv.current_value);
  }

  const labelMap = Object.fromEntries(
    INVESTMENT_TYPES.map((t) => [t.value, t.label])
  ) as Record<string, string>;

  const allocation: AllocationPoint[] = Array.from(byType.entries())
    .filter(([, value]) => value > 0)
    .map(([type, value]) => ({
      name: labelMap[type] ?? type,
      value: Math.round(value * 100) / 100,
      color: TYPE_COLORS[type] ?? "#0F766E",
    }))
    .sort((a, b) => b.value - a.value);

  return {
    investments,
    summary: {
      portfolioValue,
      invested,
      profitLoss,
      profitLossPercent,
      count: investments.length,
      allocation,
    },
  };
}
