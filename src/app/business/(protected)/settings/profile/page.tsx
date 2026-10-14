import { renderProfileSettingsPage } from "@/features/settings/server/renderers";

export { metadata } from "@/app/settings/profile/page";

export default async function BusinessProfileSettingsPage() {
  return renderProfileSettingsPage("BUSINESS");
}
