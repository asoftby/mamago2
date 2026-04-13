/**
 * Shared notification defaults.
 *
 * The notification settings domain is keyed by settings surface:
 * USER, BUSINESS, and ADMIN. Legacy role-based maps remain exported as
 * compatibility adapters for older consumers, but the canonical defaults are
 * now derived from the shared notification settings registry.
 *
 * USER surface now uses 4 categories with distinct channel defaults:
 *   SYSTEM       → USER_SECURITY  (inApp+email)
 *   REMINDER     → USER_REMINDERS (inApp+telegram)
 *   RECOMMENDATION → USER_RECOMMENDATIONS (inApp only)
 *   NEWS         → USER_NEWS      (inApp only)
 */

import type { NotificationType } from "@prisma/client";
import {
  buildLegacyNotificationDefaultsMap,
  getLegacyNotificationDefaults,
  type ChannelDefaults,
} from "./settingsDomain";

export type { ChannelDefaults } from "./settingsDomain";

export type NotificationDefaultsMap = Record<NotificationType, ChannelDefaults>;

export const notificationDefaultsByRole: Record<string, NotificationDefaultsMap> = {
  USER: buildLegacyNotificationDefaultsMap("USER"),
  BUSINESS_OWNER: buildLegacyNotificationDefaultsMap("BUSINESS_OWNER"),
  MODERATOR: buildLegacyNotificationDefaultsMap("MODERATOR"),
  ADMIN: buildLegacyNotificationDefaultsMap("ADMIN"),
};

/**
 * Legacy-compatible accessor used by delivery and older settings flows.
 * The returned defaults are backed by the shared notification settings domain.
 */
export function getNotificationDefaults(
  role: string,
  type: NotificationType,
): ChannelDefaults {
  return getLegacyNotificationDefaults(role, type);
}
