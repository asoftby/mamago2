import "server-only";

import { Prisma } from "@prisma/client";
import type {
  NotificationDeliveryOutcome,
  PreparedNotificationPayload,
} from "@/lib/notifications/domainContracts";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import {
  TelegramChannel,
  type TelegramParseMode,
  type TelegramReplyMarkup,
} from "@/server/services/telegram/TelegramChannel";
import {
  createNotificationDeliveryRecord,
  markNotificationDeliveryRecord,
  recordSkippedNotificationDelivery,
} from "./delivery-log";
import { renderNotification } from "./template-render.service";
import { buildScenarioTemplatePayloadCore } from "./template-payload-core";

function toAbsoluteUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${getCanonicalPublicAppUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

async function buildTelegramPayload(prepared: PreparedNotificationPayload): Promise<{
  text: string;
  replyMarkup?: TelegramReplyMarkup;
  parseMode?: TelegramParseMode;
}> {
  // Шаблонный рендер (override из БД → дефолт реестра); переменные уже
  // HTML-эскейпнуты, тело санитизировано → parse_mode HTML.
  // null → текущий plain-text без parse_mode.
  const rendered = await renderNotification(
    prepared.scenario,
    "TELEGRAM",
    buildScenarioTemplatePayloadCore(prepared.scenario, prepared.context),
  );

  const text = rendered
    ? rendered.subject
      ? `${rendered.subject}\n\n${rendered.body}`
      : rendered.body
    : `${prepared.content.title}\n\n${prepared.content.body}`;
  const parseMode: TelegramParseMode | undefined = rendered ? "HTML" : undefined;

  const ctaUrl = toAbsoluteUrl(prepared.content.ctaUrl);
  if (!ctaUrl) return { text, parseMode };

  return {
    text,
    parseMode,
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
    const rendered = await buildTelegramPayload(params.prepared);
    const channel = new TelegramChannel();
    await channel.sendMessage({
      chatId: params.telegramChatId,
      text: rendered.text,
      replyMarkup: rendered.replyMarkup,
      parseMode: rendered.parseMode,
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
