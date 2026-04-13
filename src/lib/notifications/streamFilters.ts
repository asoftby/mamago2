import type { NotificationType } from "@prisma/client";

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
export const NOTIFICATION_TYPES_USER: NotificationType[] = [
  // Active settings categories
  "SYSTEM",
  "REMINDER",
  "RECOMMENDATION",
  "NEWS",
  // Legacy — existing DB rows only
  "WELCOME",
  "ANNOUNCEMENT",
];

/** Бизнес: модерация мест/активностей/предложений + верификация + новости от админа */
export const NOTIFICATION_TYPES_BUSINESS: NotificationType[] = [
  "PLACE_APPROVED",
  "PLACE_NEEDS_CHANGES",
  "PLACE_REJECTED",
  "PLACE_UPDATE_APPROVED",
  "PLACE_UPDATE_NEEDS_REVISION",
  "PLACE_UPDATE_REJECTED",
  "ACTIVITY_APPROVED",
  "ACTIVITY_NEEDS_CHANGES",
  "ACTIVITY_REJECTED",
  "OFFER_APPROVED",
  "OFFER_NEEDS_CHANGES",
  "OFFER_REJECTED",
  "BUSINESS_VERIFIED",
  "BUSINESS_REJECTED",
  "BUSINESS_NEEDS_INFO",
  "BUSINESS_APPLICATION_CREATED",
  "NEWS",
  "ANNOUNCEMENT",
  "SYSTEM",
];
