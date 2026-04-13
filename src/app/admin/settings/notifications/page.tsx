export { metadata } from "@/app/settings/notifications/page";
import { renderNotificationSettingsPage } from "@/features/settings/server/renderers";

export default async function AdminNotificationSettingsPage() {
  return renderNotificationSettingsPage("ADMIN");
}
