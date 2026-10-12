import { renderPrivacySettingsPage } from "@/features/settings/server/renderers";

export { metadata } from "@/app/settings/privacy/page";

export default async function BusinessPrivacySettingsPage() {
  return renderPrivacySettingsPage("BUSINESS");
}
