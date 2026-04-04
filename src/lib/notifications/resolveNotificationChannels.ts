/**
 * resolveNotificationChannels
 *
 * Determines which delivery channels are enabled for a given user + notification type.
 *
 * Resolution order (highest priority wins):
 *   1. User override  — UserNotificationPreference row (if exists, non-null field)
 *   2. Role default   — notificationDefaultsByRole[role][type]
 *   3. Hard guards    — email requires user.email, telegram requires telegramChatId
 */

import prisma from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";
import { getNotificationDefaults } from "./notificationDefaults";

export type ResolvedChannels = {
  inApp: boolean;
  email: boolean;
  telegram: boolean;
};

export interface UserForChannelResolution {
  id: string;
  role: string;
  email: string | null;
  /** Future field — null until Telegram adapter is wired */
  telegramChatId?: string | null;
}

/**
 * Resolve effective delivery channels for one user + notification type.
 * Never throws — returns safe defaults on any error.
 */
export async function resolveNotificationChannels(
  user: UserForChannelResolution,
  notificationType: NotificationType,
): Promise<ResolvedChannels> {
  // Step 1: role defaults
  const defaults = getNotificationDefaults(user.role, notificationType);

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
  if (!user.telegramChatId) telegram = false;

  return { inApp, email, telegram };
}
