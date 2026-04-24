import "server-only";

import prisma from "@/lib/prisma";
import type {
  PreparedNotificationPayload,
  SendNotificationResult,
  SendNotificationInput,
} from "@/lib/notifications/domainContracts";
import { getEffectiveNotificationChannelsForType } from "@/server/services/notificationSettings.service";
import { sendEmailNotification, skipEmailNotification } from "./email-delivery";
import { buildNotificationDedupeKey, hasSuccessfulNotificationDelivery } from "./notification-dedupe";
import { sendInAppNotification, skipInAppNotification } from "./in-app-delivery";
import { renderNotificationContent } from "./notification-renderer";
import { sendTelegramNotification, skipTelegramNotification } from "./telegram-delivery";
import { getActiveTelegramConnectionForCurrentEnvironment } from "@/server/services/telegram/telegramConnection.service";
import { sendNotificationCore } from "./notification-service-core";
import { resolveNotificationTypeForScenario } from "./notification-scenario";

export async function prepareNotification(
  input: SendNotificationInput,
): Promise<PreparedNotificationPayload> {
  const dedupeKey = buildNotificationDedupeKey({
    scenario: input.scenario,
    userId: input.userId,
    eventId: input.context.activityId ?? input.context.planItemId,
  });

  const alreadySent = await hasSuccessfulNotificationDelivery({
    scenario: input.scenario,
    dedupeKey,
  });

  return {
    scenario: input.scenario,
    userId: input.userId,
    dedupeKey,
    content: renderNotificationContent(input.scenario, input.context),
    context: input.context,
    shouldSend: !alreadySent,
    skipReason: alreadySent ? "DUPLICATE_ALREADY_SENT" : null,
  };
}

export async function sendNotification(
  input: SendNotificationInput,
): Promise<SendNotificationResult> {
  return sendNotificationCore(input, {
    prepareNotificationFn: prepareNotification,
    getChannelPreferencesFn: async (nextInput) =>
      getEffectiveNotificationChannelsForType({
        userId: nextInput.userId,
        notificationType: resolveNotificationTypeForScenario(nextInput.scenario),
      }),
    sendInAppNotificationFn: sendInAppNotification,
    skipInAppNotificationFn: skipInAppNotification,
    findUserFn: async (userId: string) =>
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      }),
    getTelegramConnectionFn: getActiveTelegramConnectionForCurrentEnvironment,
    sendTelegramNotificationFn: sendTelegramNotification,
    skipTelegramNotificationFn: skipTelegramNotification,
    sendEmailNotificationFn: sendEmailNotification,
    skipEmailNotificationFn: skipEmailNotification,
  });
}
