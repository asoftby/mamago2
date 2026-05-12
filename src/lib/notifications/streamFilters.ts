import type { NotificationType } from "@prisma/client";
import {
  NOTIFICATION_REGISTRY,
  getNotificationTypesForSurface,
  type NotificationSurface,
} from "./notificationRegistry";

/**
 * USER stream: types included in the personal notification feed query.
 *
 * Active USER settings categories (storage aliases):
 *   SYSTEM         = "Аккаунт и безопасность"
 *   REMINDER       = "Напоминания"
 *   RECOMMENDATION = "Рекомендации для вас"
 *   NEWS           = "Новости mamaGo"
 *
 * Legacy types kept for existing DB rows only — not part of settings UI:
 *   WELCOME      — onboarding record; hidden from feed when Telegram connected
 *   ANNOUNCEMENT — legacy broadcast; maps to NEWS in settings normalization
 */
export const NOTIFICATION_TYPES_USER: NotificationType[] = Object.values(NOTIFICATION_REGISTRY)
  .filter((entry) => entry.surface === "USER")
  .map((entry) => entry.type as NotificationType);

/** Бизнес: модерация мест/активностей/предложений + верификация + новости от админа */
export const NOTIFICATION_TYPES_BUSINESS: NotificationType[] = Object.values(NOTIFICATION_REGISTRY)
  .filter((entry) => entry.surface === "BUSINESS")
  .map((entry) => entry.type as NotificationType);

/** Админ: модерация и системные операции */
export const NOTIFICATION_TYPES_ADMIN: NotificationType[] = Object.values(NOTIFICATION_REGISTRY)
  .filter((entry) => entry.surface === "ADMIN")
  .map((entry) => entry.type as NotificationType);

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Получить типы уведомлений для конкретного stream
 */
export function getNotificationTypesForStream(
  stream: "user" | "business" | "admin"
): NotificationType[] {
  const surfaceMap: Record<string, NotificationSurface> = {
    user: "USER",
    business: "BUSINESS",
    admin: "ADMIN",
  };
  
  const surface = surfaceMap[stream];
  if (!surface) return [];
  
  return Object.values(NOTIFICATION_REGISTRY)
    .filter((entry) => entry.surface === surface)
    .map((entry) => entry.type as NotificationType);
}

// ─── Dev Validation ───────────────────────────────────────────────────────────

/**
 * Dev-only validation: проверить соответствие stream filters и registry
 */
if (process.env.NODE_ENV === "development") {
  const allStreamTypes = [
    ...NOTIFICATION_TYPES_USER,
    ...NOTIFICATION_TYPES_BUSINESS,
    ...NOTIFICATION_TYPES_ADMIN,
  ];
  
  const registryTypes = Object.keys(NOTIFICATION_REGISTRY);
  const missingInRegistry = allStreamTypes.filter(type => !registryTypes.includes(type));
  
  if (missingInRegistry.length > 0) {
    console.warn(
      "[streamFilters] Types in stream filters but missing in registry:",
      missingInRegistry
    );
  }
  
  // Проверка соответствия surface
  const surfaceChecks = [
    { stream: "USER", types: NOTIFICATION_TYPES_USER },
    { stream: "BUSINESS", types: NOTIFICATION_TYPES_BUSINESS },
    { stream: "ADMIN", types: NOTIFICATION_TYPES_ADMIN },
  ];
  
  surfaceChecks.forEach(({ stream, types }) => {
    types.forEach(type => {
      const entry = NOTIFICATION_REGISTRY[type];
      if (entry && entry.surface !== stream) {
        console.warn(
          `[streamFilters] Type ${type} in ${stream} stream but has surface ${entry.surface} in registry`
        );
      }
    });
  });
  
  // Проверка booking типов в BUSINESS stream
  const bookingTypes = NOTIFICATION_TYPES_BUSINESS.filter(t => t.startsWith("BOOKING_"));
  if (bookingTypes.length === 3) {
    console.debug("[streamFilters] ✅ All 3 BOOKING types present in BUSINESS stream");
  } else {
    console.warn(
      `[streamFilters] Expected 3 BOOKING types in BUSINESS stream, found ${bookingTypes.length}:`,
      bookingTypes
    );
  }
}
