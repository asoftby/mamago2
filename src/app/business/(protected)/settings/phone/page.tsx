export { metadata } from "@/app/settings/phone/page";
import { renderPhoneSettingsPage } from "@/features/settings/server/renderers";

export default async function BusinessPhoneSettingsPage() {
  return renderPhoneSettingsPage("BUSINESS");
}
