import { getCreditCardsPageData } from "@/features/credit-cards/queries";
import { CreditCardsView } from "@/features/credit-cards/credit-cards-view";

export const metadata = { title: "Credit Cards · WealthLedger" };

export default async function CreditCardsPage() {
  const data = await getCreditCardsPageData();
  return <CreditCardsView data={data} />;
}
