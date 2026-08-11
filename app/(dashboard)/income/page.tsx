import { getIncomePageData } from "@/features/income/queries";
import { IncomeView } from "@/features/income/income-view";

export const metadata = { title: "Income · WealthLedger" };

export default async function IncomePage() {
  const data = await getIncomePageData();
  return <IncomeView data={data} />;
}
