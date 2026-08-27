/**
 * USER notification event layer.
 *
 * Separates internal domain events (what happened) from user-facing
 * notification types (what the user sees in settings).
 *
 * Events are internal — never shown in UI.
 * Types are user-facing — shown in notification settings as 4 categories.
 *
 * Storage aliases (Prisma enum values → product category meaning):
 *   SYSTEM         = "Аккаунт и безопасность"
 *   REMINDER       = "Напоминания"
 *   RECOMMENDATION = "Рекомендации для вас"
 *   NEWS           = "Новости mamaGo"
 *
 * Legacy types (WELCOME, ANNOUNCEMENT) are compatibility-input only.
 * They are never written as new preference keys and never appear in settings UI.
 */

import type { NotificationType } from "@prisma/client";

export type UserNotificationEvent =
  | "EMAIL_VERIFICATION_REQUIRED"
  | "PHONE_VERIFICATION_REQUIRED"
  | "PASSWORD_CHANGED"
  | "LOGIN_FROM_NEW_DEVICE"
  | "ACCOUNT_CRITICAL_UPDATE"
  | "PLAN_EVENT_TOMORROW"
  | "PLAN_EVENT_TODAY"
  | "PLAN_EVENT_SOON"
  | "NEW_MATCH_FOR_CHILD_PROFILE"
  | "NEW_MATCH_FOR_INTERESTS"
  | "NEW_MATCH_NEARBY"
  | "NEW_FEATURE_RELEASED"
  | "SERVICE_IMPORTANT_ANNOUNCEMENT";

export const USER_EVENT_TO_NOTIFICATION_TYPE: Record<UserNotificationEvent, NotificationType> = {
  EMAIL_VERIFICATION_REQUIRED: "SYSTEM",
  PHONE_VERIFICATION_REQUIRED: "SYSTEM",
  PASSWORD_CHANGED: "SYSTEM",
  LOGIN_FROM_NEW_DEVICE: "SYSTEM",
  ACCOUNT_CRITICAL_UPDATE: "SYSTEM",
  PLAN_EVENT_TOMORROW: "REMINDER",
  PLAN_EVENT_TODAY: "REMINDER",
  PLAN_EVENT_SOON: "REMINDER",
  NEW_MATCH_FOR_CHILD_PROFILE: "RECOMMENDATION",
  NEW_MATCH_FOR_INTERESTS: "RECOMMENDATION",
  NEW_MATCH_NEARBY: "RECOMMENDATION",
  NEW_FEATURE_RELEASED: "NEWS",
  SERVICE_IMPORTANT_ANNOUNCEMENT: "NEWS",
};

export const LEGACY_USER_TYPE_TO_ACTIVE_TYPE: Partial<Record<NotificationType, NotificationType>> = {
  WELCOME: "SYSTEM",
  ANNOUNCEMENT: "NEWS",
} as const;

export function resolveNotificationTypeForEvent(event: UserNotificationEvent): NotificationType {
  return USER_EVENT_TO_NOTIFICATION_TYPE[event];
}

export function normalizeLegacyUserNotificationType(
  type: NotificationType,
): NotificationType {
  return LEGACY_USER_TYPE_TO_ACTIVE_TYPE[type] ?? type;
}

export function isLegacyUserNotificationType(type: NotificationType): boolean {
  return type in LEGACY_USER_TYPE_TO_ACTIVE_TYPE;
}
