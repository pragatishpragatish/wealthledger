import { getBudgetsPageData } from "@/features/budgets/queries";
import { BudgetsView } from "@/features/budgets/budgets-view";
import type { BudgetPeriod } from "@/types";

export const metadata = { title: "Budgets · WealthLedger" };

type SearchParams = Promise<{
  period?: string;
  year?: string;
  month?: string;
}>;

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const period: BudgetPeriod =
    params.period === "yearly" ? "yearly" : "monthly";
  const year = params.year ? Number(params.year) : undefined;
  const month = params.month ? Number(params.month) : undefined;

  const data = await getBudgetsPageData({
    period,
    year: Number.isFinite(year) ? year : undefined,
    month: Number.isFinite(month) ? month : undefined,
  });

  return <BudgetsView data={data} />;
}
