export { metadata } from "@/app/settings/password/page";
import { renderPasswordSettingsPage } from "@/features/settings/server/renderers";

export default async function BusinessPasswordSettingsPage() {
  return renderPasswordSettingsPage("BUSINESS");
}
