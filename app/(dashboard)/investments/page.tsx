import { getInvestmentsPageData } from "@/features/investments/queries";
import { InvestmentsView } from "@/features/investments/investments-view";

export const metadata = { title: "Investments · WealthLedger" };

export default async function InvestmentsPage() {
  const data = await getInvestmentsPageData();
  return <InvestmentsView data={data} />;
}
