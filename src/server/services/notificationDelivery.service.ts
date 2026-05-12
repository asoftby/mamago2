/**
 * Notification Delivery Service
 *
 * Dispatches a created Notification through resolved delivery channels.
 * Called by notification.service.ts after every createNotification().
 *
 * Flow:
 *   dispatchDelivery(notification, user)
 *     → resolveNotificationChannels(user, type)   — defaults + user overrides + hard guards
 *     → per-channel dispatch (parallel)
 *       IN_APP   → always recorded as SENT (Notification row is the record)
 *       EMAIL    → sendEmail() via emailAdapter; SKIPPED if disabled or not configured
 *       TELEGRAM → SKIPPED (stub until adapter is wired)
 *
 * Never throws. All errors are caught and recorded in NotificationDelivery.
 */

import prisma from "@/lib/prisma";
import type { Notification, NotificationType } from "@prisma/client";
import { sendEmail } from "@/lib/email/emailAdapter";
import { buildNotificationEmailTemplate } from "@/lib/email/notificationEmailTemplates";
import { resolveNotificationChannels } from "@/lib/notifications/resolveNotificationChannels";
import type { UserForChannelResolution } from "@/lib/notifications/resolveNotificationChannels";
import { getActiveTelegramConnectionForCurrentEnvironment } from "@/server/services/telegram/telegramConnection.service";
import { TelegramChannel } from "@/server/services/telegram/TelegramChannel";
import { renderNotificationTelegramMessage } from "@/server/services/telegram/TelegramTemplateRenderer";

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Main entry point. Call after createNotification().
 * Resolves channels for the user, then dispatches in parallel.
 */
export async function dispatchDelivery(
  notification: Notification,
  user: UserForChannelResolution,
): Promise<void> {
  const channels = await resolveNotificationChannels(
    user,
    notification.type as NotificationType,
  );

  await Promise.allSettled([
    handleInApp(notification.id, user.id, channels.inApp),
    handleEmail(notification, user, channels.email),
    handleTelegram(notification.id, channels.telegram),
  ]);
}

// ── IN_APP ────────────────────────────────────────────────────────────────────

async function handleInApp(notificationId: string, userId: string, enabled: boolean): Promise<void> {
  try {
    await prisma.notificationDelivery.upsert({
      where: { notificationId_channel: { notificationId, channel: "IN_APP" } },
      create: {
        userId,
        notificationId,
        channel: "IN_APP",
        status: enabled ? "SENT" : "SKIPPED",
        sentAt: enabled ? new Date() : null,
      },
      update: {},
    });
  } catch (e) {
    console.error("[delivery:in_app] Failed to record:", e);
  }
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────

async function handleEmail(
  notification: Notification,
  user: UserForChannelResolution,
  enabled: boolean,
): Promise<void> {
  // Create delivery record (PENDING or SKIPPED immediately)
  let deliveryId: string;
  try {
    const delivery = await prisma.notificationDelivery.upsert({
      where: { notificationId_channel: { notificationId: notification.id, channel: "EMAIL" } },
      create: {
        userId: user.id,
        notificationId: notification.id,
        channel: "EMAIL",
        status: enabled ? "PENDING" : "SKIPPED",
        errorMessage: enabled ? null : "CHANNEL_DISABLED",
      },
      update: {},
    });
    deliveryId = delivery.id;
  } catch (e) {
    console.error("[delivery:email] Failed to create delivery record:", e);
    return;
  }

  if (!enabled || !user.email) return;

  // Build and send
  const template = buildNotificationEmailTemplate(
    notification.type as NotificationType,
    notification.title,
    notification.body,
    notification.entityId,
  );

  const result = await sendEmail({ to: user.email, ...template });

  try {
    if (result.ok) {
      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: "SENT", sentAt: new Date(), errorMessage: null },
      });
    } else if (
      result.error === "EMAIL_NOT_CONFIGURED" ||
      result.error === "EMAIL_PROVIDER_NOT_IMPLEMENTED"
    ) {
      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: "SKIPPED", errorMessage: result.error },
      });
    } else {
      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: "FAILED", errorMessage: result.error ?? "Unknown error" },
      });
    }
  } catch (e) {
    console.error("[delivery:email] Failed to update delivery record:", e);
  }
}

// ── TELEGRAM ──────────────────────────────────────────────────────────────────

async function handleTelegram(notificationId: string, enabled: boolean): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) return;

  let deliveryId: string;
  try {
    const delivery = await prisma.notificationDelivery.upsert({
      where: { notificationId_channel: { notificationId, channel: "TELEGRAM" } },
      create: {
        userId: notification.userId,
        notificationId,
        channel: "TELEGRAM",
        status: enabled ? "PENDING" : "SKIPPED",
        errorMessage: enabled ? null : "CHANNEL_DISABLED",
      },
      update: {},
    });
    deliveryId = delivery.id;
  } catch (e) {
    console.error("[delivery:telegram] Failed to record:", e);
    return;
  }

  if (!enabled) return;

  try {
    const connection = await getActiveTelegramConnectionForCurrentEnvironment(notification.userId);
    if (!connection?.isActive) {
      console.warn(
        "[delivery:telegram] skipped: TELEGRAM_NOT_CONNECTED",
        { userId: notification.userId, notificationId, type: notification.type }
      );
      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: "SKIPPED", errorMessage: "TELEGRAM_NOT_CONNECTED" },
      });
      return;
    }

    const rendered = renderNotificationTelegramMessage(notification);
    const channel = new TelegramChannel();
    await channel.sendMessage({
      chatId: connection.telegramChatId,
      text: rendered.text,
      replyMarkup: rendered.replyMarkup,
    });

    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: "SENT", sentAt: new Date(), errorMessage: null },
    });
  } catch (e) {
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        errorMessage: e instanceof Error ? e.message : "TELEGRAM_SEND_FAILED",
      },
    });
    console.error(
      "[delivery:telegram] failed",
      { userId: notification.userId, notificationId, type: notification.type, error: e instanceof Error ? e.message : String(e) }
    );
  }
}

export async function forceTelegramDeliveryForNotification(notificationId: string): Promise<void> {
  await handleTelegram(notificationId, true);
}
