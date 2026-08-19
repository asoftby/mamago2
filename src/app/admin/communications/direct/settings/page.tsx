import { getDirectPlatformSettings } from "@/server/services/direct/directPlatformSettings.service";
import { DirectSettingsForm } from "./DirectSettingsForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDirectSettingsPage() {
  const settings = await getDirectPlatformSettings();

  return <DirectSettingsForm initialSettings={settings} />;
}
