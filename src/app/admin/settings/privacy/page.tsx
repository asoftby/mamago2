export { metadata } from "@/app/settings/privacy/page";
import { renderPrivacySettingsPage } from "@/features/settings/server/renderers";

export default async function AdminPrivacySettingsPage() {
  return renderPrivacySettingsPage("ADMIN");
}
