import type {
  NotificationApiRow,
  NotificationCategory,
  NotificationStream,
  NotificationViewModel,
} from "@/lib/notifications/types";
import {
  NOTIFICATION_REGISTRY,
  getNotificationRegistryEntry,
  resolveNotificationHref,
} from "./notificationRegistry";
export function getNotificationStreamFromType(type: string): NotificationStream {
  const entry = getNotificationRegistryEntry(type);
  if (!entry) {
    // Fallback для неизвестных типов
    if (
      type.startsWith("PLACE_") ||
      type.startsWith("ACTIVITY_") ||
      type.startsWith("OFFER_") ||
      type.startsWith("BUSINESS_") ||
      type.startsWith("BOOKING_")
    ) {
      return "BUSINESS";
    }
    return "USER";
  }
  
  // Маппинг surface на stream
  return entry.surface as NotificationStream;
}

export function getNotificationCategoryFromType(type: string): NotificationCategory {
  const entry = getNotificationRegistryEntry(type);
  if (!entry) {
    // Fallback для неизвестных типов
    return "REMINDER";
  }
  
  // Маппинг registry category на NotificationCategory
  switch (entry.category) {
    case "MODERATION":
      // Определяем подкатегорию на основе importance
      if (entry.importance === "HIGH" || entry.importance === "CRITICAL") {
        return entry.type.includes("APPROVED") || entry.type.includes("VERIFIED")
          ? "MODERATION"
          : "REQUEST";
      }
      return "MODERATION";
    case "BOOKING":
      return "REQUEST";
    case "BUSINESS":
      return entry.type.includes("VERIFIED") ? "MODERATION" : "REQUEST";
    case "SYSTEM":
    case "PLAN":
    case "MARKETING":
    case "ADMIN":
    default:
      return "REMINDER";
  }
}

export function getNotificationHref(n: NotificationApiRow): string | null {
  // Сначала пробуем использовать registry resolver
  const registryHref = resolveNotificationHref(n.type, {
    entityType: n.entityType ?? undefined,
    entityId: n.entityId ?? undefined,
    ctaAction: n.ctaAction ?? undefined,
  });
  
  if (registryHref) {
    return registryHref;
  }
  
  // Fallback для специальных случаев и legacy логики
  
  // USER types — no deep link, stay in app
  if (n.type === "WELCOME" || n.type === "RECOMMENDATION") {
    return null;
  }
  if (n.type === "REMINDER" || n.type === "PLAN_TOMORROW_DIGEST") return "/me/plan";
  if (n.type === "SYSTEM") return "/settings";
  
  // Broadcast-уведомления: если есть ctaAction — используем его
  if ((n.type === "NEWS" || n.type === "ANNOUNCEMENT") && n.ctaAction) {
    return n.ctaAction;
  }
  if (n.type === "NEWS" || n.type === "ANNOUNCEMENT") {
    return null;
  }
  
  // Booking: ведём в раздел заявок бизнес-кабинета
  if (n.type === "BOOKING_CREATED" || n.type === "BOOKING_STALE" || n.type === "BOOKING_NEEDS_ATTENTION") {
    return n.ctaAction ?? "/business/bookings";
  }
  
  // Booking: ведём на страницу записей пользователя
  if (
    n.type === "BOOKING_CONFIRMED" ||
    n.type === "BOOKING_CANCELLED" ||
    n.type === "BOOKING_COMPLETED" ||
    n.type === "BOOKING_FEEDBACK_REQUEST"
  ) {
    return "/me/bookings";
  }
  
  // Entity-based routing
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

// ─── Dev Validation ───────────────────────────────────────────────────────────

/**
 * Dev-only validation: проверить href resolution для всех типов
 */
if (process.env.NODE_ENV === "development") {
  const allTypes = Object.keys(NOTIFICATION_REGISTRY);
  const typesWithoutHref: string[] = [];
  const typesWithHref: string[] = [];
  
  allTypes.forEach(type => {
    const entry = NOTIFICATION_REGISTRY[type];
    if (entry.resolveHref) {
      typesWithHref.push(type);
      
      // Проверяем, что resolveHref возвращает string или null
      try {
        const testHref = entry.resolveHref({});
        if (testHref !== null && typeof testHref !== "string") {
          console.warn(
            `[routing] Type ${type} resolveHref returned non-string/non-null:`,
            typeof testHref
          );
        }
      } catch (error) {
        console.warn(`[routing] Type ${type} resolveHref threw error:`, error);
      }
    } else {
      typesWithoutHref.push(type);
    }
  });
  
  console.debug(
    `[routing] Types with href: ${typesWithHref.length}, without href: ${typesWithoutHref.length}`
  );
  
  // Проверка критичных типов
  const criticalTypes = [
    "REMINDER",
    "PLAN_TOMORROW_DIGEST",
    "SYSTEM",
    "BOOKING_CREATED",
    "BOOKING_STALE",
    "BOOKING_NEEDS_ATTENTION",
    "PLACE_APPROVED",
    "PLACE_NEEDS_CHANGES",
  ];
  
  criticalTypes.forEach(type => {
    const entry = NOTIFICATION_REGISTRY[type];
    if (!entry) {
      console.warn(`[routing] Critical type ${type} missing in registry`);
    } else if (!entry.resolveHref) {
      console.debug(`[routing] Critical type ${type} has no resolveHref (using fallback)`);
    }
  });
}
