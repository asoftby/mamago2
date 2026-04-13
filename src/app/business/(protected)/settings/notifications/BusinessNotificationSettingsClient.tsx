"use client";

import type { NotificationSettingsSurfaceData } from "@/lib/notifications/settingsDomain";
import { NotificationSettingsTable } from "@/components/business/notifications/NotificationSettingsTable";

interface Props {
  initialData: NotificationSettingsSurfaceData;
  /** Внутри NotificationsModal */
  embedded?: boolean;
}

export function BusinessNotificationSettingsClient({
  initialData,
  embedded = false,
}: Props) {
  return (
    <NotificationSettingsTable
      surface="BUSINESS"
      compact={embedded}
      pageTitle={embedded ? undefined : "Notification Channels"}
      pageDescription={
        embedded
          ? undefined
          : "Управляйте тем, как получать ключевые business-уведомления по модерации, контенту и верификации."
      }
      initialData={initialData}
    />
  );
}
