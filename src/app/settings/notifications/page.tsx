import { renderNotificationSettingsPage } from "@/features/settings/server/renderers";

export const metadata = { title: "Каналы уведомлений | mamaGo" };

export default async function UnifiedNotificationSettingsPage() {
  return renderNotificationSettingsPage("USER");
}
