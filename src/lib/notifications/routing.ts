import type {
  NotificationApiRow,
  NotificationCategory,
  NotificationStream,
  NotificationViewModel,
} from "@/lib/notifications/types";
export function getNotificationStreamFromType(type: string): NotificationStream {
  if (
    type.startsWith("PLACE_") ||
    type.startsWith("ACTIVITY_") ||
    type.startsWith("OFFER_") ||
    type.startsWith("BUSINESS_")
  ) {
    return "BUSINESS";
  }
  return "USER";
}

export function getNotificationCategoryFromType(type: string): NotificationCategory {
  switch (type) {
    case "PLACE_APPROVED":
    case "PLACE_UPDATE_APPROVED":
    case "ACTIVITY_APPROVED":
    case "OFFER_APPROVED":
    case "BUSINESS_VERIFIED":
      return "MODERATION";
    case "PLACE_NEEDS_CHANGES":
    case "PLACE_REJECTED":
    case "PLACE_UPDATE_NEEDS_REVISION":
    case "PLACE_UPDATE_REJECTED":
    case "ACTIVITY_NEEDS_CHANGES":
    case "ACTIVITY_REJECTED":
    case "OFFER_NEEDS_CHANGES":
    case "OFFER_REJECTED":
    case "BUSINESS_REJECTED":
    case "BUSINESS_NEEDS_INFO":
      return "REQUEST";
    case "NEWS":
    case "ANNOUNCEMENT":
    case "SYSTEM":
    default:
      return "REMINDER";
  }
}

export function getNotificationHref(n: NotificationApiRow): string | null {
  // USER types — no deep link, stay in app
  if (n.type === "WELCOME" || n.type === "REMINDER" || n.type === "RECOMMENDATION") {
    return null;
  }
  if (n.type === "SYSTEM") return null;
  // Broadcast-уведомления: если есть ctaAction — используем его
  if ((n.type === "NEWS" || n.type === "ANNOUNCEMENT") && n.ctaAction) {
    return n.ctaAction;
  }
  if (n.type === "NEWS" || n.type === "ANNOUNCEMENT") {
    return null;
  }
  if (n.entityType === "PLACE" && n.entityId) return `/editor/place/${n.entityId}/edit`;
  if (n.entityType === "ACTIVITY" && n.entityId) return `/editor/event/${n.entityId}/edit`;
  if (n.entityType === "OFFER" && n.entityId) return `/editor/offer/${n.entityId}/edit`;
  if (n.entityType === "BUSINESS") return "/business/verification";

  const t = n.type;
  if (t.startsWith("PLACE_") || t.startsWith("ACTIVITY_") || t.startsWith("OFFER_")) {
    return "/business/dashboard";
  }
  if (t.startsWith("BUSINESS_")) return "/business/verification";

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
    description: row.body,
    isRead: row.isRead,
    createdAt: new Date(row.createdAt),
  };
}
