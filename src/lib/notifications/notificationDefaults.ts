/**
 * Notification Defaults by Role
 *
 * Defines default channel preferences per NotificationType per Role.
 * Used when UserNotificationPreference row is absent (NULL = use this default).
 *
 * Channels:
 *   inApp    — always true for actionable types; false only for low-signal noise
 *   email    — true for high-signal events (moderation decisions, verification)
 *   telegram — false everywhere until Telegram adapter is implemented
 */

import type { NotificationType } from "@prisma/client";

export type ChannelDefaults = {
  inApp: boolean;
  email: boolean;
  telegram: boolean;
};

export type NotificationDefaultsMap = Record<NotificationType, ChannelDefaults>;

// ── Shared presets ────────────────────────────────────────────────────────────

const MODERATION_DECISION: ChannelDefaults = { inApp: true,  email: true,  telegram: false };
const MODERATION_REQUEST:  ChannelDefaults = { inApp: true,  email: true,  telegram: false };
const SYSTEM_REMINDER:     ChannelDefaults = { inApp: true,  email: false, telegram: false };
const SILENT:              ChannelDefaults = { inApp: false, email: false, telegram: false };

// ── Role defaults ─────────────────────────────────────────────────────────────

/**
 * Regular family user.
 * Only receives SYSTEM (plan reminders etc.).
 * Business/moderation types are irrelevant — silenced.
 */
const USER_DEFAULTS: NotificationDefaultsMap = {
  // Place
  PLACE_APPROVED:              SILENT,
  PLACE_NEEDS_CHANGES:         SILENT,
  PLACE_REJECTED:              SILENT,
  PLACE_UPDATE_APPROVED:       SILENT,
  PLACE_UPDATE_NEEDS_REVISION: SILENT,
  PLACE_UPDATE_REJECTED:       SILENT,
  // Activity
  ACTIVITY_APPROVED:           SILENT,
  ACTIVITY_NEEDS_CHANGES:      SILENT,
  ACTIVITY_REJECTED:           SILENT,
  // Offer
  OFFER_APPROVED:              SILENT,
  OFFER_NEEDS_CHANGES:         SILENT,
  OFFER_REJECTED:              SILENT,
  // Business verification
  BUSINESS_VERIFIED:           SILENT,
  BUSINESS_REJECTED:           SILENT,
  BUSINESS_NEEDS_INFO:         SILENT,
  WELCOME:                     SYSTEM_REMINDER,
  REMINDER:                    SYSTEM_REMINDER,
  RECOMMENDATION:              SYSTEM_REMINDER,
  SYSTEM:                      SYSTEM_REMINDER,
};

/**
 * Business owner.
 * Receives all moderation decisions and verification outcomes via in-app + email.
 */
const BUSINESS_OWNER_DEFAULTS: NotificationDefaultsMap = {
  // Place
  PLACE_APPROVED:              MODERATION_DECISION,
  PLACE_NEEDS_CHANGES:         MODERATION_REQUEST,
  PLACE_REJECTED:              MODERATION_REQUEST,
  PLACE_UPDATE_APPROVED:       MODERATION_DECISION,
  PLACE_UPDATE_NEEDS_REVISION: MODERATION_REQUEST,
  PLACE_UPDATE_REJECTED:       MODERATION_REQUEST,
  // Activity
  ACTIVITY_APPROVED:           MODERATION_DECISION,
  ACTIVITY_NEEDS_CHANGES:      MODERATION_REQUEST,
  ACTIVITY_REJECTED:           MODERATION_REQUEST,
  // Offer
  OFFER_APPROVED:              MODERATION_DECISION,
  OFFER_NEEDS_CHANGES:         MODERATION_REQUEST,
  OFFER_REJECTED:              MODERATION_REQUEST,
  // Business verification
  BUSINESS_VERIFIED:           MODERATION_DECISION,
  BUSINESS_REJECTED:           MODERATION_REQUEST,
  BUSINESS_NEEDS_INFO:         MODERATION_REQUEST,
  WELCOME:                     SYSTEM_REMINDER,
  REMINDER:                    SYSTEM_REMINDER,
  RECOMMENDATION:              SYSTEM_REMINDER,
  SYSTEM:                      SYSTEM_REMINDER,
};

/**
 * Moderator.
 * Receives only SYSTEM reminders (moderation queue is their job, not a notification).
 */
const MODERATOR_DEFAULTS: NotificationDefaultsMap = {
  PLACE_APPROVED:              SILENT,
  PLACE_NEEDS_CHANGES:         SILENT,
  PLACE_REJECTED:              SILENT,
  PLACE_UPDATE_APPROVED:       SILENT,
  PLACE_UPDATE_NEEDS_REVISION: SILENT,
  PLACE_UPDATE_REJECTED:       SILENT,
  ACTIVITY_APPROVED:           SILENT,
  ACTIVITY_NEEDS_CHANGES:      SILENT,
  ACTIVITY_REJECTED:           SILENT,
  OFFER_APPROVED:              SILENT,
  OFFER_NEEDS_CHANGES:         SILENT,
  OFFER_REJECTED:              SILENT,
  BUSINESS_VERIFIED:           SILENT,
  BUSINESS_REJECTED:           SILENT,
  BUSINESS_NEEDS_INFO:         SILENT,
  WELCOME:                     SYSTEM_REMINDER,
  REMINDER:                    SYSTEM_REMINDER,
  RECOMMENDATION:              SYSTEM_REMINDER,
  SYSTEM:                      SYSTEM_REMINDER,
};

/**
 * Admin.
 * Same as moderator — admin actions are intentional, no need to notify self.
 */
const ADMIN_DEFAULTS: NotificationDefaultsMap = {
  ...MODERATOR_DEFAULTS,
};

// ── Public map ────────────────────────────────────────────────────────────────

export const notificationDefaultsByRole: Record<string, NotificationDefaultsMap> = {
  USER:           USER_DEFAULTS,
  BUSINESS_OWNER: BUSINESS_OWNER_DEFAULTS,
  MODERATOR:      MODERATOR_DEFAULTS,
  ADMIN:          ADMIN_DEFAULTS,
};

/**
 * Resolve effective channel defaults for a given role + type.
 * Falls back to SYSTEM_REMINDER if role is unknown.
 */
export function getNotificationDefaults(
  role: string,
  type: NotificationType,
): ChannelDefaults {
  return notificationDefaultsByRole[role]?.[type] ?? SYSTEM_REMINDER;
}
