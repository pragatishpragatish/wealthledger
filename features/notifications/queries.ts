"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { Notification } from "@/types";

export async function listNotifications(limit = 30): Promise<Notification[]> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((n) => ({
    ...n,
    metadata: (n.metadata ?? {}) as Record<string, unknown>,
  })) as Notification[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { supabase, user } = await requireUser();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type NotificationActionResult = {
  error?: string;
  success?: boolean;
};

export async function markNotificationRead(
  id: string
): Promise<NotificationActionResult> {
  if (!id) return { error: "Notification id is required" };

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}
