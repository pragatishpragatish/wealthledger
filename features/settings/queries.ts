import { requireUser } from "@/lib/auth";
import type { Profile, Settings } from "@/types";

export async function getProfileAndSettings(): Promise<{
  profile: Profile;
  settings: Settings;
}> {
  const { supabase, user } = await requireUser();

  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("settings").select("*").eq("user_id", user.id).single(),
    ]);

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "Profile not found");
  }
  if (settingsError || !settings) {
    throw new Error(settingsError?.message ?? "Settings not found");
  }

  return {
    profile: profile as Profile,
    settings: {
      ...settings,
      notify_investment_update:
        (settings as { notify_investment_update?: boolean })
          .notify_investment_update ?? true,
      large_expense_threshold: Number(settings.large_expense_threshold),
    } as Settings,
  };
}
