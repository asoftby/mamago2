export { metadata } from "@/app/settings/email/page";
import { renderEmailSettingsPage } from "@/features/settings/server/renderers";

export default async function MeEmailSettingsPage() {
  return renderEmailSettingsPage("USER");
}
