import { renderPasswordSettingsPage } from "@/features/settings/server/renderers";

export { metadata } from "@/app/settings/password/page";

export default async function BusinessPasswordSettingsPage() {
  return renderPasswordSettingsPage("BUSINESS");
}
