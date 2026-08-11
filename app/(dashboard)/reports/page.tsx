import dynamic from "next/dynamic";
import { generateReport } from "@/features/reports/queries";
import type { ReportPeriodType } from "@/features/reports/types";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Reports · WealthLedger" };

const ReportsView = dynamic(
  () =>
    import("@/features/reports/reports-view").then((m) => ({
      default: m.ReportsView,
    })),
  {
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    ),
  }
);

type SearchParams = Promise<{
  period?: string;
  year?: string;
  month?: string;
}>;

function parsePeriodType(value?: string): ReportPeriodType {
  if (value === "yearly") return "yearly";
  if (value === "financial_year") return "financial_year";
  return "monthly";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const periodType = parsePeriodType(params.period);
  const year = params.year ? Number(params.year) : undefined;
  const month = params.month ? Number(params.month) : undefined;

  const report = await generateReport({
    periodType,
    year: Number.isFinite(year) ? year : undefined,
    month: Number.isFinite(month) ? month : undefined,
  });

  return <ReportsView report={report} />;
}
