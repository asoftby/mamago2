import { renderProfileSettingsPage } from "@/features/settings/server/renderers";

export { metadata } from "@/app/settings/account/page";

export default async function BusinessAccountSettingsPage() {
  return renderProfileSettingsPage("BUSINESS");
}
