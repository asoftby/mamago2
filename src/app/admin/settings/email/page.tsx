export { metadata } from "@/app/settings/email/page";
import { renderEmailSettingsPage } from "@/features/settings/server/renderers";

export default async function AdminEmailSettingsPage() {
  return renderEmailSettingsPage("ADMIN");
}
