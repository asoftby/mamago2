export { metadata } from "@/app/settings/page";
import { renderSettingsPage } from "@/features/settings/server/renderers";

export default async function AdminSettingsPage() {
  return renderSettingsPage("ADMIN");
}
