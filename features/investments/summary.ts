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

const PLATFORM_COLORS = [
  "#0F766E",
  "#2563EB",
  "#CA8A04",
  "#7C3AED",
  "#EA580C",
  "#0891B2",
  "#BE185D",
  "#059669",
  "#4F46E5",
  "#64748B",
];

export type InvestmentContribution = {
  id: string;
  investment_id: string;
  date: string;
  type: string;
  units: number;
  price: number;
  amount: number;
  notes: string | null;
};

export type InvestmentComputed = Investment & {
  gain: number;
  gain_percent: number;
  contributions: InvestmentContribution[];
  contribution_count: number;
};

export type InvestmentsSummary = {
  portfolioValue: number;
  invested: number;
  profitLoss: number;
  profitLossPercent: number;
  count: number;
  allocation: AllocationPoint[];
  allocationByPlatform: AllocationPoint[];
};

export type InvestmentsPageData = {
  investments: InvestmentComputed[];
  summary: InvestmentsSummary;
};

/** Build portfolio summary + charts from any investment subset (client-safe). */
export function summarizeInvestments(
  investments: InvestmentComputed[]
): InvestmentsSummary {
  const portfolioValue = investments.reduce((s, i) => s + i.current_value, 0);
  const invested = investments.reduce((s, i) => s + i.invested_amount, 0);
  const profitLoss = Math.round((portfolioValue - invested) * 100) / 100;
  const profitLossPercent =
    invested > 0 ? Math.round((profitLoss / invested) * 10000) / 100 : 0;

  const labelMap = Object.fromEntries(
    INVESTMENT_TYPES.map((t) => [t.value, t.label])
  ) as Record<string, string>;

  const byType = new Map<string, number>();
  const byPlatform = new Map<string, number>();
  for (const inv of investments) {
    byType.set(inv.type, (byType.get(inv.type) ?? 0) + inv.current_value);
    const platform = inv.platform?.trim() || "Unspecified";
    byPlatform.set(
      platform,
      (byPlatform.get(platform) ?? 0) + inv.current_value
    );
  }

  const allocation: AllocationPoint[] = Array.from(byType.entries())
    .filter(([, value]) => value > 0)
    .map(([type, value]) => ({
      name: labelMap[type] ?? type,
      value: Math.round(value * 100) / 100,
      color: TYPE_COLORS[type] ?? "#0F766E",
    }))
    .sort((a, b) => b.value - a.value);

  const allocationByPlatform: AllocationPoint[] = Array.from(
    byPlatform.entries()
  )
    .filter(([, value]) => value > 0)
    .map(([name, value], i) => ({
      name,
      value: Math.round(value * 100) / 100,
      color: PLATFORM_COLORS[i % PLATFORM_COLORS.length]!,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    portfolioValue,
    invested,
    profitLoss,
    profitLossPercent,
    count: investments.length,
    allocation,
    allocationByPlatform,
  };
}
