import { Suspense } from "react";
import { getDashboardData } from "@/features/dashboard/queries";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { DashboardSkeleton } from "@/features/dashboard/skeleton";

export const metadata = {
  title: "Dashboard · WealthLedger",
  description: "Personal finance overview",
};

async function DashboardContent() {
  const data = await getDashboardData();
  if (!data) return null;
  return <DashboardView data={data} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
