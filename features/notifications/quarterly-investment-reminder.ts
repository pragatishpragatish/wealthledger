"use server";

import { createClient } from "@/lib/supabase/server";
import { getCalendarQuarter } from "@/utils/date";
import type { Notification } from "@/types";

const REMINDER_KIND = "quarterly_investment_update";

/**
 * Ensures one unread/created reminder exists per calendar quarter.
 * Safe to call on every authenticated page load — idempotent.
 * Returns the current-quarter reminder if it is still unread (for login dialog).
 */
export async function ensureQuarterlyInvestmentReminder(): Promise<Notification | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Prefer dedicated flag; fall back to true if column not migrated yet
  const enabled =
    settings == null
      ? true
      : ((settings as { notify_investment_update?: boolean })
          .notify_investment_update ?? true);

  if (!enabled) return null;

  const { count: investmentCount } = await supabase
    .from("investments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!investmentCount || investmentCount < 1) return null;

  const quarter = getCalendarQuarter();

  const { data: existingRows } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .contains("metadata", {
      kind: REMINDER_KIND,
      quarterKey: quarter.key,
    })
    .limit(1);

  const existing = existingRows?.[0] as Notification | undefined;

  if (existing) {
    return existing.is_read
      ? null
      : ({
          ...existing,
          metadata: (existing.metadata ?? {}) as Record<string, unknown>,
        } as Notification);
  }

  const title = `Update investment values · ${quarter.label}`;
  const message = `It's ${quarter.label} (${quarter.rangeLabel}). Review your portfolio and update current prices / NAVs so net worth and gains stay accurate.`;

  // Prefer dedicated type; fall back to general if enum value not migrated yet
  const payload = {
    user_id: user.id,
    type: "investment_update" as const,
    title,
    message,
    link: "/investments",
    is_read: false,
    due_date: null as string | null,
    metadata: {
      kind: REMINDER_KIND,
      quarterKey: quarter.key,
      year: quarter.year,
      quarter: quarter.quarter,
    },
  };

  let { data, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    const fallback = { ...payload, type: "general" as const };
    const retry = await supabase
      .from("notifications")
      .insert(fallback)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) return null;

  return {
    ...data,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  } as Notification;
}
