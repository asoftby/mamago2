import "server-only";

import { Prisma } from "@prisma/client";
import type {
  NotificationDeliveryOutcome,
  PreparedNotificationPayload,
} from "@/lib/notifications/domainContracts";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { TelegramChannel, type TelegramReplyMarkup } from "@/server/services/telegram/TelegramChannel";
import {
  createNotificationDeliveryRecord,
  markNotificationDeliveryRecord,
  recordSkippedNotificationDelivery,
} from "./delivery-log";

function toAbsoluteUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${getCanonicalPublicAppUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

function buildTelegramPayload(prepared: PreparedNotificationPayload): {
  text: string;
  replyMarkup?: TelegramReplyMarkup;
} {
  const ctaUrl = toAbsoluteUrl(prepared.content.ctaUrl);
  const text = `${prepared.content.title}\n\n${prepared.content.body}`;

  if (!ctaUrl) return { text };

  return {
    text,
    replyMarkup: {
      inline_keyboard: [[{ text: prepared.content.ctaLabel ?? "Открыть", url: ctaUrl }]],
    },
  };
}

export async function sendTelegramNotification(params: {
  userId: string;
  notificationId: string | null;
  telegramChatId: string;
  prepared: PreparedNotificationPayload;
}): Promise<NotificationDeliveryOutcome> {
  const payloadJson: Prisma.InputJsonValue = {
    scenario: params.prepared.scenario,
    text: params.prepared.content.title,
    body: params.prepared.content.body,
    ctaLabel: params.prepared.content.ctaLabel,
    ctaUrl: toAbsoluteUrl(params.prepared.content.ctaUrl),
  };

  const delivery = await createNotificationDeliveryRecord({
    userId: params.userId,
    notificationId: params.notificationId,
    prepared: params.prepared,
    channel: "TELEGRAM",
    status: "PENDING",
    payloadJson,
  });

  try {
    const rendered = buildTelegramPayload(params.prepared);
    const channel = new TelegramChannel();
    await channel.sendMessage({
      chatId: params.telegramChatId,
      text: rendered.text,
      replyMarkup: rendered.replyMarkup,
    });

    await markNotificationDeliveryRecord(delivery.id, {
      status: "SENT",
      sentAt: new Date(),
    });

    return {
      channel: "TELEGRAM",
      status: "SENT",
      deliveryId: delivery.id,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "TELEGRAM_SEND_FAILED";

    await markNotificationDeliveryRecord(delivery.id, {
      status: "FAILED",
      errorMessage,
    });

    return {
      channel: "TELEGRAM",
      status: "FAILED",
      deliveryId: delivery.id,
      errorMessage,
    };
  }
}

export async function skipTelegramNotification(params: {
  userId: string;
  notificationId?: string | null;
  prepared: PreparedNotificationPayload;
  reason: "USER_DISABLED_CHANNEL" | "CHANNEL_NOT_CONNECTED";
}): Promise<NotificationDeliveryOutcome> {
  return recordSkippedNotificationDelivery({
    userId: params.userId,
    notificationId: params.notificationId,
    prepared: params.prepared,
    channel: "TELEGRAM",
    reason: params.reason,
    payloadJson: {
      scenario: params.prepared.scenario,
      text: params.prepared.content.title,
    },
  });
}
