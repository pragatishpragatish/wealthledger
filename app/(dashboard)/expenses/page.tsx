import { getExpensesPageData } from "@/features/expenses/queries";
import { ExpensesView } from "@/features/expenses/expenses-view";

export const metadata = { title: "Expenses · WealthLedger" };

export default async function ExpensesPage() {
  const data = await getExpensesPageData();
  return <ExpensesView data={data} />;
}
