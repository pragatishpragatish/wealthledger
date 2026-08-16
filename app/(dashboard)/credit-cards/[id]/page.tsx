import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getCreditCardById } from "@/features/credit-cards/queries";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Credit card · WealthLedger" };

const CreditCardDetailView = dynamic(
  () =>
    import("@/features/credit-cards/credit-card-detail-view").then((m) => ({
      default: m.CreditCardDetailView,
    })),
  {
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    ),
  }
);

export default async function CreditCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCreditCardById(id);
  if (!data) notFound();
  return <CreditCardDetailView data={data} />;
}
