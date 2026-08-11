import dynamic from "next/dynamic";
import { getNetWorthPageData } from "@/features/net-worth/queries";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Net Worth · WealthLedger" };

const NetWorthView = dynamic(
  () =>
    import("@/features/net-worth/net-worth-view").then((m) => ({
      default: m.NetWorthView,
    })),
  {
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    ),
  }
);

export default async function NetWorthPage() {
  const data = await getNetWorthPageData();
  return <NetWorthView data={data} />;
}
