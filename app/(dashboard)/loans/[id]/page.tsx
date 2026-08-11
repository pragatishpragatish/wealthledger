import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getLoanById } from "@/features/loans/queries";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Loan details · WealthLedger" };

const LoanDetailView = dynamic(
  () =>
    import("@/features/loans/loan-detail-view").then((m) => ({
      default: m.LoanDetailView,
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

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getLoanById(id);
  if (!data) notFound();
  return <LoanDetailView data={data} />;
}
