import { getGoalsPageData } from "@/features/goals/queries";
import { GoalsView } from "@/features/goals/goals-view";

export const metadata = { title: "Goals · WealthLedger" };

export default async function GoalsPage() {
  const data = await getGoalsPageData();
  return <GoalsView data={data} />;
}
