/**
 * resolveNotificationChannels
 *
 * Determines which delivery channels are enabled for a given user + notification type.
 *
 * Resolution order (highest priority wins):
 *   0. Product kill switch — recommendation delivery is disabled by default
 *   1. User override  — UserNotificationPreference row (if exists, non-null field)
 *   2. Surface default — shared notification settings domain for that type
 *   3. Hard guards    — email requires user.email, telegram requires active TelegramConnection
 */

import prisma from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";
import {
  getNotificationSurfaceDefaults,
  resolveNotificationSettingsSurfaceForType,
} from "./settingsDomain";
import { getActiveTelegramConnectionForCurrentEnvironment } from "@/server/services/telegram/telegramConnection.service";

export type ResolvedChannels = {
  inApp: boolean;
  email: boolean;
  telegram: boolean;
};

export interface UserForChannelResolution {
  id: string;
  role: string;
  email: string | null;
  telegramLinked?: boolean;
}

const RECOMMENDATION_DELIVERY_ENABLED =
  process.env.USER_RECOMMENDATIONS_DELIVERY_ENABLED === "true";

/**
 * Resolve effective delivery channels for one user + notification type.
 * Never throws — returns safe defaults on any error.
 */
export async function resolveNotificationChannels(
  user: UserForChannelResolution,
  notificationType: NotificationType,
): Promise<ResolvedChannels> {
  // Product-level pause: legacy preferences cannot accidentally reactivate
  // recommendation delivery before quality/feedback gates are ready.
  if (notificationType === "RECOMMENDATION" && !RECOMMENDATION_DELIVERY_ENABLED) {
    return { inApp: false, email: false, telegram: false };
  }

  // Step 1: notification surface defaults
  const defaults = getNotificationSurfaceDefaults(
    resolveNotificationSettingsSurfaceForType(notificationType),
    notificationType,
  );

  let inApp    = defaults.inApp;
  let email    = defaults.email;
  let telegram = defaults.telegram;

  // Step 2: apply user overrides (only non-null fields override)
  try {
    const pref = await prisma.userNotificationPreference.findUnique({
      where: {
        userId_notificationType: {
          userId: user.id,
          notificationType,
        },
      },
      select: {
        inAppEnabled:    true,
        emailEnabled:    true,
        telegramEnabled: true,
      },
    });

    if (pref) {
      if (pref.inAppEnabled    !== null) inApp    = pref.inAppEnabled    ?? inApp;
      if (pref.emailEnabled    !== null) email    = pref.emailEnabled    ?? email;
      if (pref.telegramEnabled !== null) telegram = pref.telegramEnabled ?? telegram;
    }
  } catch (e) {
    console.error("[resolveChannels] Failed to load user preferences, using defaults:", e);
  }

  // Step 3: hard guards — channel requires infrastructure
  if (!user.email) email = false;

  if (telegram) {
    const telegramLinked =
      user.telegramLinked ??
      Boolean(await getActiveTelegramConnectionForCurrentEnvironment(user.id));

    if (!telegramLinked) telegram = false;
  }

  return { inApp, email, telegram };
}
