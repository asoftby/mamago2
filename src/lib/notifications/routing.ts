import type {
  NotificationApiRow,
  NotificationCategory,
  NotificationStream,
  NotificationViewModel,
} from "@/lib/notifications/types";

export function getNotificationStreamFromType(type: string): NotificationStream {
  if (type.startsWith("PLACE_") || type.startsWith("ACTIVITY_")) {
    return "BUSINESS";
  }
  return "USER";
}

export function getNotificationCategoryFromType(type: string): NotificationCategory {
  switch (type) {
    case "SYSTEM":
      return "REMINDER";
    case "PLACE_APPROVED":
    case "PLACE_UPDATE_APPROVED":
    case "ACTIVITY_APPROVED":
      return "MODERATION";
    case "PLACE_NEEDS_CHANGES":
    case "PLACE_REJECTED":
    case "PLACE_UPDATE_NEEDS_REVISION":
    case "PLACE_UPDATE_REJECTED":
    case "ACTIVITY_NEEDS_CHANGES":
    case "ACTIVITY_REJECTED":
      return "REQUEST";
    default:
      return "REMINDER";
  }
}

/**
 * Куда вести по тапу: один inbox, маршруты по смыслу уведомления.
 */
export function getNotificationHref(n: NotificationApiRow): string | null {
  if (n.entityType === "PLACE" && n.entityId) {
    return `/editor/place/${n.entityId}/edit`;
  }
  if (n.entityType === "ACTIVITY" && n.entityId) {
    return `/editor/event/${n.entityId}/edit`;
  }
  if (n.entityType === "OFFER" && n.entityId) {
    return `/editor/offer/${n.entityId}/edit`;
  }

  const t = n.type;
  if (t.startsWith("PLACE_") || t.startsWith("ACTIVITY_")) {
    return "/business/dashboard";
  }

  if (t === "SYSTEM") {
    return "/me/plan";
  }

  return null;
}

export function mapApiRowToViewModel(
  row: NotificationApiRow & { userId?: string },
): NotificationViewModel {
  return {
    id: row.id,
    userId: row.userId ?? "",
    type: getNotificationStreamFromType(row.type),
    category: getNotificationCategoryFromType(row.type),
    title: row.title,
    description: row.message,
    isRead: row.isRead,
    createdAt: new Date(row.createdAt),
  };
}
