export { metadata } from "@/app/settings/profile/page";
import { renderProfileSettingsPage } from "@/features/settings/server/renderers";

export default async function AdminProfileSettingsPage() {
  return renderProfileSettingsPage("ADMIN");
}
