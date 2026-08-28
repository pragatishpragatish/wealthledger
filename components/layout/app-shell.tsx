import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { InvestmentReminderHost } from "@/features/notifications/investment-reminder-host";
import type { Profile } from "@/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
  const profile = profileData as Profile | null;
  const unreadCount = count ?? 0;

  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-64">
        <Sidebar />
      </div>
      <div className="flex min-h-svh min-w-0 flex-1 flex-col lg:pl-64">
        <Header profile={profile} unreadCount={unreadCount} />
        <main className="min-w-0 flex-1 px-3 py-4 pb-mobile-nav sm:px-6 sm:py-6 lg:px-8 lg:pb-6">
          {children}
        </main>
        <MobileBottomNav />
      </div>
      <InvestmentReminderHost />
    </div>
  );
}
