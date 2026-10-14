import { renderEmailSettingsPage } from "@/features/settings/server/renderers";

export { metadata } from "@/app/settings/email/page";

export default async function BusinessEmailSettingsPage() {
  return renderEmailSettingsPage("BUSINESS");
}
