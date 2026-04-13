export { metadata } from "@/app/settings/page";
import { renderSettingsPage } from "@/features/settings/server/renderers";

export default async function BusinessSettingsPage() {
  return renderSettingsPage("BUSINESS");
}
