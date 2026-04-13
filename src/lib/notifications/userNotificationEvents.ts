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

// ── Internal event identifiers ────────────────────────────────────────────────

export type UserNotificationEvent =
  // Account / Security → stored as SYSTEM
  | "EMAIL_VERIFICATION_REQUIRED"
  | "PHONE_VERIFICATION_REQUIRED"
  | "PASSWORD_CHANGED"
  | "LOGIN_FROM_NEW_DEVICE"
  | "ACCOUNT_CRITICAL_UPDATE"
  // Reminders → stored as REMINDER
  | "PLAN_EVENT_TOMORROW"
  | "PLAN_EVENT_TODAY"
  | "PLAN_EVENT_SOON"
  // Recommendations → stored as RECOMMENDATION
  | "NEW_MATCH_FOR_CHILD_PROFILE"
  | "NEW_MATCH_FOR_INTERESTS"
  | "NEW_MATCH_NEARBY"
  // News → stored as NEWS
  | "NEW_FEATURE_RELEASED"
  | "SERVICE_IMPORTANT_ANNOUNCEMENT";

// ── Event → settings type mapping ────────────────────────────────────────────

export const USER_EVENT_TO_NOTIFICATION_TYPE: Record<UserNotificationEvent, NotificationType> = {
  // SYSTEM = "Аккаунт и безопасность"
  EMAIL_VERIFICATION_REQUIRED: "SYSTEM",
  PHONE_VERIFICATION_REQUIRED: "SYSTEM",
  PASSWORD_CHANGED:            "SYSTEM",
  LOGIN_FROM_NEW_DEVICE:       "SYSTEM",
  ACCOUNT_CRITICAL_UPDATE:     "SYSTEM",

  // REMINDER = "Напоминания"
  PLAN_EVENT_TOMORROW: "REMINDER",
  PLAN_EVENT_TODAY:    "REMINDER",
  PLAN_EVENT_SOON:     "REMINDER",

  // RECOMMENDATION = "Рекомендации для вас"
  NEW_MATCH_FOR_CHILD_PROFILE: "RECOMMENDATION",
  NEW_MATCH_FOR_INTERESTS:     "RECOMMENDATION",
  NEW_MATCH_NEARBY:            "RECOMMENDATION",

  // NEWS = "Новости mamaGo"
  NEW_FEATURE_RELEASED:           "NEWS",
  SERVICE_IMPORTANT_ANNOUNCEMENT: "NEWS",
};

// ── Legacy type → active type mapping ────────────────────────────────────────
//
// Deterministic mapping for old UserNotificationPreference rows.
// These types are no longer written as new preference keys.
// Used only to normalize existing DB rows at read time.
//
//   WELCOME      → SYSTEM  (was: onboarding/account — maps to security category)
//   ANNOUNCEMENT → NEWS    (was: broadcast announcement — maps to news category)

export const LEGACY_USER_TYPE_TO_ACTIVE_TYPE: Partial<Record<NotificationType, NotificationType>> = {
  WELCOME:      "SYSTEM",
  ANNOUNCEMENT: "NEWS",
} as const;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve the canonical NotificationType for a given internal user event.
 */
export function resolveNotificationTypeForEvent(event: UserNotificationEvent): NotificationType {
  return USER_EVENT_TO_NOTIFICATION_TYPE[event];
}

/**
 * Normalize a legacy USER NotificationType to the active 4-category model.
 * - WELCOME      → SYSTEM
 * - ANNOUNCEMENT → NEWS
 * - All other types pass through unchanged (including non-USER types).
 */
export function normalizeLegacyUserNotificationType(
  type: NotificationType,
): NotificationType {
  return LEGACY_USER_TYPE_TO_ACTIVE_TYPE[type] ?? type;
}

/**
 * Returns true if the type is a legacy-only USER type that should never be
 * written as a new UserNotificationPreference key.
 */
export function isLegacyUserNotificationType(type: NotificationType): boolean {
  return type in LEGACY_USER_TYPE_TO_ACTIVE_TYPE;
}
