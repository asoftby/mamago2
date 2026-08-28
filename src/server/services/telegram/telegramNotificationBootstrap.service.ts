import "server-only";

import { NotificationType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveNotificationAudience } from "@/lib/notifications/audience";

export const TELEGRAM_PLAN_NOTIFICATION_TYPES = [
  NotificationType.REMINDER,
  NotificationType.PLAN_TOMORROW_DIGEST,
] as const;

type PreferenceBootstrapStore = {
  createMany(args: {
    data: Prisma.UserNotificationPreferenceCreateManyInput[];
    skipDuplicates: boolean;
  }): Promise<{ count: number }>;
};

/**
 * Enable the useful plan-related Telegram notifications when a user explicitly
 * links Telegram for the first time.
 *
 * Existing preference rows are intentionally preserved via skipDuplicates, so
 * reconnecting Telegram never overrides a user's explicit opt-out.
 */
export async function initializeTelegramPlanNotificationPreferences(
  userId: string,
  store: PreferenceBootstrapStore = prisma.userNotificationPreference,
): Promise<number> {
  const result = await store.createMany({
    data: TELEGRAM_PLAN_NOTIFICATION_TYPES.map((notificationType) => ({
      userId,
      audience: resolveNotificationAudience(notificationType),
      notificationType,
      inAppEnabled: null,
      emailEnabled: null,
      telegramEnabled: true,
    })),
    skipDuplicates: true,
  });

  return result.count;
}
