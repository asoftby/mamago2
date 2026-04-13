/**
 * Notification preference persistence primitives.
 *
 * Canonical notification settings reads now live in
 * `notificationSettings.service.ts`. This file remains as the low-level
 * persistence layer for override writes and compatibility adapters.
 */

import prisma from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import { resolveNotificationAudience } from "@/lib/notifications/audience";

export type PreferenceRow = {
  notificationType: NotificationType;
  inApp: boolean;
  email: boolean;
  telegram: boolean;
  isOverridden: boolean;
};

export type UpdatePreferenceInput = {
  inAppEnabled?:    boolean | null;
  emailEnabled?:    boolean | null;
  telegramEnabled?: boolean | null;
};

export type NotificationPreferenceChannel = "IN_APP" | "EMAIL" | "TELEGRAM";

/**
 * Upsert a single preference override for the current user.
 * Passing null for a field resets it to role default.
 * If all three fields are null after update, the row is deleted (clean reset).
 */
export async function updatePreference(
  userId: string,
  notificationType: NotificationType,
  values: UpdatePreferenceInput,
): Promise<void> {
  const data = {
    inAppEnabled:    values.inAppEnabled    ?? null,
    emailEnabled:    values.emailEnabled    ?? null,
    telegramEnabled: values.telegramEnabled ?? null,
  };

  // If all fields are null → delete the override row (full reset to defaults)
  const allNull = data.inAppEnabled === null && data.emailEnabled === null && data.telegramEnabled === null;
  if (allNull) {
    await prisma.userNotificationPreference.deleteMany({
      where: { userId, notificationType },
    });
    return;
  }

  await prisma.userNotificationPreference.upsert({
    where: { userId_notificationType: { userId, notificationType } },
    create: {
      userId,
      audience: resolveNotificationAudience(notificationType),
      notificationType,
      ...data,
    },
    update: {
      ...data,
      audience: resolveNotificationAudience(notificationType),
    },
  });
}

/**
 * Patch a single channel override without disturbing the other stored values.
 * Used by the new immediate-save settings UI (`PATCH /api/notifications/settings`).
 */
export async function updatePreferenceChannel(
  userId: string,
  notificationType: NotificationType,
  channel: NotificationPreferenceChannel,
  enabled: boolean,
): Promise<void> {
  const existing = await prisma.userNotificationPreference.findUnique({
    where: {
      userId_notificationType: {
        userId,
        notificationType,
      },
    },
    select: {
      id: true,
      inAppEnabled: true,
      emailEnabled: true,
      telegramEnabled: true,
    },
  });

  const nextData = {
    inAppEnabled: existing?.inAppEnabled ?? null,
    emailEnabled: existing?.emailEnabled ?? null,
    telegramEnabled: existing?.telegramEnabled ?? null,
  };

  if (channel === "IN_APP") {
    nextData.inAppEnabled = enabled;
  } else if (channel === "EMAIL") {
    nextData.emailEnabled = enabled;
  } else {
    nextData.telegramEnabled = enabled;
  }

  await prisma.userNotificationPreference.upsert({
    where: {
      userId_notificationType: {
        userId,
        notificationType,
      },
    },
    create: {
      userId,
      audience: resolveNotificationAudience(notificationType),
      notificationType,
      ...nextData,
    },
    update: {
      ...nextData,
      audience: resolveNotificationAudience(notificationType),
    },
  });
}
