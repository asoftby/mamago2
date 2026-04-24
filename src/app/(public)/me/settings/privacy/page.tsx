export { metadata } from "@/app/settings/privacy/page";
import { renderPrivacySettingsPage } from "@/features/settings/server/renderers";

export default async function MePrivacySettingsPage() {
  return renderPrivacySettingsPage("USER");
}
