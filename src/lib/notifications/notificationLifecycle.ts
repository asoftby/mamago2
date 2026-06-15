import type { NotificationApiRow } from "@/lib/notifications/types";

const ACTION_REQUIRED_ENTITY_IDS = new Set([
  "VERIFY_EMAIL",
  "CONNECT_TELEGRAM",
  "VERIFY_PHONE",
]);

export function isActionRequiredNotificationRow(
  notification: Pick<NotificationApiRow, "entityId" | "metadata" | "type" | "actionRequired">,
): boolean {
  if (notification.actionRequired === true) return true;
  if (notification.type !== "SYSTEM") return false;

  if (notification.entityId && ACTION_REQUIRED_ENTITY_IDS.has(notification.entityId)) {
    return true;
  }

  const kind = notification.metadata?.kind;
  return typeof kind === "string" && ACTION_REQUIRED_ENTITY_IDS.has(kind);
}

export function canArchiveNotificationRow(notification: NotificationApiRow): boolean {
  if (typeof notification.canArchive === "boolean") {
    return notification.canArchive;
  }
  return !isActionRequiredNotificationRow(notification);
}
