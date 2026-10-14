import { renderPhoneSettingsPage } from "@/features/settings/server/renderers";

export { metadata } from "@/app/settings/phone/page";

export default async function BusinessPhoneSettingsPage() {
  return renderPhoneSettingsPage("BUSINESS");
}
