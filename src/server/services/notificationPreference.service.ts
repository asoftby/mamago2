/**
 * Notification Preference Service
 * Server-only — do not import in client components.
 */

import prisma from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import {
  getNotificationDefaults,
  notificationDefaultsByRole,
  type ChannelDefaults,
} from "@/lib/notifications/notificationDefaults";

export type PreferenceRow = {
  notificationType: NotificationType;
  /** Effective resolved value (default merged with override) */
  inApp: boolean;
  email: boolean;
  telegram: boolean;
  /** Whether the user has an explicit override stored */
  isOverridden: boolean;
};

/**
 * Return all preferences for a user, merging role defaults with stored overrides.
 * Every NotificationType relevant to the user's role is included.
 */
export async function getPreferences(userId: string, role: string): Promise<PreferenceRow[]> {
  const roleDefaults = notificationDefaultsByRole[role] ?? notificationDefaultsByRole["USER"];

  // Load all stored overrides for this user in one query
  const stored = await prisma.userNotificationPreference.findMany({
    where: { userId },
    select: {
      notificationType: true,
      inAppEnabled: true,
      emailEnabled: true,
      telegramEnabled: true,
    },
  });

  const overrideMap = new Map(stored.map((r) => [r.notificationType, r]));

  return (Object.keys(roleDefaults) as NotificationType[]).map((type) => {
    const defaults: ChannelDefaults = getNotificationDefaults(role, type);
    const override = overrideMap.get(type);

    return {
      notificationType: type,
      inApp:    override?.inAppEnabled    ?? defaults.inApp,
      email:    override?.emailEnabled    ?? defaults.email,
      telegram: override?.telegramEnabled ?? defaults.telegram,
      isOverridden: !!override,
    };
  });
}

export type UpdatePreferenceInput = {
  inAppEnabled?:    boolean | null;
  emailEnabled?:    boolean | null;
  telegramEnabled?: boolean | null;
};

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
    create: { userId, notificationType, ...data },
    update: data,
  });
}
