import { SettingsView } from "@/features/settings/settings-view";
import { getProfileAndSettings } from "@/features/settings/queries";

export const metadata = { title: "Settings · WealthLedger" };

export default async function SettingsPage() {
  const { profile, settings } = await getProfileAndSettings();
  return <SettingsView profile={profile} settings={settings} />;
}
