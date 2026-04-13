import type { NotificationAudience, NotificationType } from "@prisma/client";
import { resolveNotificationAudienceForType } from "./settingsDomain";

export function resolveNotificationAudience(
  type: NotificationType,
): NotificationAudience {
  return resolveNotificationAudienceForType(type);
}
