export { metadata } from "@/app/settings/company/page";
import { renderCompanySettingsPage } from "@/features/settings/server/renderers";

export default async function BusinessCompanySettingsPage() {
  return renderCompanySettingsPage("BUSINESS");
}
