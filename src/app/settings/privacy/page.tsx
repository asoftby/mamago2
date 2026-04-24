import { renderPrivacySettingsPage } from "@/features/settings/server/renderers";

export const metadata = { title: "Конфиденциальность | mamaGo" };

export default async function UnifiedPrivacySettingsPage() {
  return renderPrivacySettingsPage("USER");
}
