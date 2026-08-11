import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { InvestmentReminderHost } from "@/features/notifications/investment-reminder-host";
import type { Profile } from "@/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let unreadCount = 0;

  if (user) {
    // Fast path: profile + unread only (no reminder work on critical path)
    const [{ data: profileData }, { count }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false),
    ]);
    profile = profileData as Profile | null;
    unreadCount = count ?? 0;
  }

  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64">
        <Sidebar />
      </div>
      <div className="flex min-h-svh flex-1 flex-col lg:pl-64">
        <Header profile={profile} unreadCount={unreadCount} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      {user ? <InvestmentReminderHost /> : null}
    </div>
  );
}
