import { getCalendarPageData } from "@/features/calendar/queries";
import { CalendarView } from "@/features/calendar/calendar-view";

export const metadata = { title: "Calendar · WealthLedger" };

type SearchParams = Promise<{
  year?: string;
  month?: string;
}>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const year = params.year ? Number(params.year) : undefined;
  const month = params.month ? Number(params.month) : undefined;

  const data = await getCalendarPageData({
    year: Number.isFinite(year) ? year : undefined,
    month: Number.isFinite(month) ? month : undefined,
  });

  return <CalendarView data={data} />;
}
