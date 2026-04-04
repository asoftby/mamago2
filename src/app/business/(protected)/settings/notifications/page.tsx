import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getPreferences } from "@/server/services/notificationPreference.service";
import { BusinessNotificationSettingsClient } from "./BusinessNotificationSettingsClient";

export const metadata = { title: "Настройки уведомлений | Кабинет партнёра" };

export default async function BusinessNotificationSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const preferences = await getPreferences(user.id, user.role);

  return <BusinessNotificationSettingsClient initialPreferences={preferences} />;
}
