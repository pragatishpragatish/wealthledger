import { getExpensesPageData } from "@/features/expenses/queries";
import { ExpensesView } from "@/features/expenses/expenses-view";

export const metadata = { title: "Expenses · WealthLedger" };

type SearchParams = Promise<{
  range?: string;
}>;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const data = await getExpensesPageData({
    chartRangeParam: params.range,
  });
  return <ExpensesView data={data} />;
}
