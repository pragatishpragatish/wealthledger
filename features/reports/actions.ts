"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { FinancialReport } from "@/features/reports/types";

export type ReportActionResult = {
  error?: string;
  success?: boolean;
  id?: string;
};

export async function saveReport(
  report: FinancialReport
): Promise<ReportActionResult> {
  if (!report?.periodStart || !report?.periodEnd) {
    return { error: "Invalid report data" };
  }

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: user.id,
      name: report.label,
      report_type: report.periodType,
      period_start: report.periodStart,
      period_end: report.periodEnd,
      data: report as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/reports");
  return { success: true, id: data.id };
}
