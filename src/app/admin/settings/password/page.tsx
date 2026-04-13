export { metadata } from "@/app/settings/password/page";
import { renderPasswordSettingsPage } from "@/features/settings/server/renderers";

export default async function AdminPasswordSettingsPage() {
  return renderPasswordSettingsPage("ADMIN");
}
