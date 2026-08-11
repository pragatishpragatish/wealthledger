import { getLoansPageData } from "@/features/loans/queries";
import { LoansView } from "@/features/loans/loans-view";

export const metadata = { title: "Loans · WealthLedger" };

export default async function LoansPage() {
  const data = await getLoansPageData();
  return <LoansView data={data} />;
}
