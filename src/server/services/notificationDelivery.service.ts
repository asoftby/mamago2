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
 *
 * ─── Retry Policy ────────────────────────────────────────────────────────────
 *
 * FAILED deliveries can be retried with exponential backoff:
 *   - Max 3 attempts
 *   - Backoff: 1s, 2s, 4s
 *   - Only retry transient errors (network, timeout)
 *   - Don't retry: SKIPPED, CHANNEL_DISABLED, TELEGRAM_NOT_CONNECTED
 *
 * ─── Deduplication ───────────────────────────────────────────────────────────
 *
 * Deduplication is handled at the notification creation level:
 *   - BOOKING_CREATED: one per booking (unique constraint)
 *   - BOOKING_STALE: max 1 per 24h per booking
 *   - BOOKING_NEEDS_ATTENTION: max 1 per 24h per booking
 *   - BOOKING_CONFIRMED/CANCELLED/COMPLETED: one per status change
 *   - BOOKING_FEEDBACK_REQUEST: one per booking completion
 */

import prisma from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";
import type { Notification, NotificationType, NotificationDelivery } from "@prisma/client";
import { sendEmail } from "@/lib/email/emailAdapter";
import { buildNotificationEmailTemplate } from "@/lib/email/notificationEmailTemplates";
import { resolveNotificationChannels } from "@/lib/notifications/resolveNotificationChannels";
import type { UserForChannelResolution } from "@/lib/notifications/resolveNotificationChannels";
import { getActiveTelegramConnectionForCurrentEnvironment } from "@/server/services/telegram/telegramConnection.service";
import { TelegramChannel, type TelegramParseMode, type TelegramReplyMarkup } from "@/server/services/telegram/TelegramChannel";
import { renderNotificationTelegramMessage } from "@/server/services/telegram/TelegramTemplateRenderer";
import { isOneTimeNotificationType } from "./notificationDedup.service";
import {
  buildLegacyTemplatePayload,
  renderNotification as renderNotificationTemplate,
} from "@/server/notifications/template-render.service";
import { toPlainText } from "@/server/notifications/template-render-core";

/**
 * Текст telegram-сообщения: шаблонный рендер (override из БД → дефолт реестра,
 * переменные HTML-эскейпнуты → parse_mode HTML); при null — текущий
 * plain-рендер из TelegramTemplateRenderer. Кнопки всегда из текущего
 * рендера (CTA вне шаблонов, ограничение v1).
 */
async function buildTelegramMessageForNotification(notification: Notification): Promise<{
  text: string;
  replyMarkup?: TelegramReplyMarkup;
  parseMode?: TelegramParseMode;
}> {
  const fallback = renderNotificationTelegramMessage(notification);
  const templated = await renderNotificationTemplate(
    notification.type,
    "TELEGRAM",
    buildLegacyTemplatePayload(notification),
  );

  if (!templated) return fallback;

  return {
    text: templated.subject ? `${templated.subject}\n\n${templated.body}` : templated.body,
    replyMarkup: fallback.replyMarkup,
    parseMode: "HTML",
  };
}

function buildDeliveryDedupeKey(
  notification: Notification,
  channel: "EMAIL" | "TELEGRAM",
): string | null {
  if (
    !notification.entityType ||
    !notification.entityId ||
    !isOneTimeNotificationType(notification.type as NotificationType)
  ) {
    return null;
  }

  return [
    notification.userId,
    notification.type,
    notification.entityType,
    notification.entityId,
    channel,
  ].join(":");
}

async function shouldSuppressDuplicateDelivery(
  notification: Notification,
  channel: "EMAIL" | "TELEGRAM",
  currentNotificationId: string,
): Promise<boolean> {
  const dedupeKey = buildDeliveryDedupeKey(notification, channel);
  if (!dedupeKey) return false;

  const existing = await prisma.notificationDelivery.findFirst({
    where: {
      channel,
      dedupeKey,
      notificationId: { not: currentNotificationId },
      status: { in: ["PENDING", "SENT", "SKIPPED"] },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

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
        dedupeKey: buildDeliveryDedupeKey(notification, "EMAIL"),
        errorMessage: enabled ? null : "CHANNEL_DISABLED",
      },
      update: {},
    });
    deliveryId = delivery.id;
  } catch (e) {
    console.error("[delivery:email] Failed to create delivery record:", e);
    Sentry.captureException(e, {
      tags: {
        area: "notifications",
        channel: "email",
        stage: "delivery_record_create",
      },
      extra: {
        notificationId: notification.id,
        notificationType: notification.type,
        userId: user.id,
      },
    });
    return;
  }

  if (!enabled || !user.email) return;

  if (
    await shouldSuppressDuplicateDelivery(
      notification,
      "EMAIL",
      notification.id,
    )
  ) {
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "SKIPPED",
        errorMessage: "DUPLICATE_DELIVERY_SUPPRESSED",
      },
    });
    return;
  }

  // Build and send: шаблонный рендер (override → дефолт), null → текущий текст
  const templated = await renderNotificationTemplate(
    notification.type,
    "EMAIL",
    buildLegacyTemplatePayload(notification),
  );

  const template = buildNotificationEmailTemplate(
    notification.type as NotificationType,
    templated?.subject ?? notification.title,
    templated ? toPlainText(templated.body, 4000) : notification.body,
    notification.entityId,
    notification.ctaAction,
    templated?.body ?? null,
  );

  const result = await sendEmail({ to: user.email, ...template });

  try {
    if (result.ok) {
      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: "SENT", sentAt: new Date(), errorMessage: null },
      });
    } else if (
      result.error === "EMAIL_DISABLED" ||
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
    Sentry.captureException(e, {
      tags: {
        area: "notifications",
        channel: "email",
        stage: "delivery_record_update",
      },
      extra: {
        notificationId: notification.id,
        notificationType: notification.type,
        userId: user.id,
        deliveryId,
      },
    });
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
        dedupeKey: buildDeliveryDedupeKey(notification, "TELEGRAM"),
        errorMessage: enabled ? null : "CHANNEL_DISABLED",
      },
      update: {},
    });
    deliveryId = delivery.id;
  } catch (e) {
    console.error("[delivery:telegram] Failed to record:", e);
    Sentry.captureException(e, {
      tags: {
        area: "notifications",
        channel: "telegram",
        stage: "delivery_record_create",
      },
      extra: {
        notificationId,
        notificationType: notification.type,
        userId: notification.userId,
      },
    });
    return;
  }

  if (!enabled) return;

  if (
    await shouldSuppressDuplicateDelivery(
      notification,
      "TELEGRAM",
      notification.id,
    )
  ) {
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "SKIPPED",
        errorMessage: "DUPLICATE_DELIVERY_SUPPRESSED",
      },
    });
    return;
  }

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

    const rendered = await buildTelegramMessageForNotification(notification);
    const channel = new TelegramChannel();
    await channel.sendMessage({
      chatId: connection.telegramChatId,
      text: rendered.text,
      replyMarkup: rendered.replyMarkup,
      parseMode: rendered.parseMode,
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
    Sentry.captureException(e, {
      tags: {
        area: "notifications",
        channel: "telegram",
        stage: "send",
      },
      extra: {
        notificationId,
        notificationType: notification.type,
        userId: notification.userId,
        deliveryId,
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

// ── Retry Policy ──────────────────────────────────────────────────────────────

/**
 * Determines if a delivery error is transient (can be retried).
 * Transient errors: network timeouts, temporary service unavailability
 * Permanent errors: invalid recipient, bot not configured, channel disabled
 */
function isTransientError(errorMessage: string | null): boolean {
  if (!errorMessage) return false;
  
  // Permanent errors — don't retry
  const permanentErrors = [
    "CHANNEL_DISABLED",
    "TELEGRAM_NOT_CONNECTED",
    "EMAIL_DISABLED",
    "EMAIL_NOT_CONFIGURED",
    "EMAIL_PROVIDER_NOT_IMPLEMENTED",
    "TELEGRAM_BOT_NOT_CONFIGURED",
    // Reconciled stale PENDING: the original send may have actually succeeded
    // before the crash, so auto-retry risks a double-send. Manual resend only.
    STALE_PENDING_ERROR,
  ];
  
  if (permanentErrors.some(err => errorMessage.includes(err))) {
    return false;
  }
  
  // Transient errors — retry
  const transientPatterns = [
    "timeout",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "temporarily unavailable",
  ];
  
  return transientPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Retry a failed delivery with exponential backoff.
 * Max 3 attempts, backoff: 1s, 2s, 4s
 */
export async function retryFailedDelivery(
  deliveryId: string,
  maxAttempts = 3,
): Promise<boolean> {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: { notification: true },
  });

  if (!delivery || !delivery.notification) {
    console.warn("[delivery:retry] Delivery or notification not found:", deliveryId);
    return false;
  }

  // Only retry FAILED deliveries
  if (delivery.status !== "FAILED") {
    console.warn("[delivery:retry] Delivery not in FAILED status:", deliveryId, delivery.status);
    return false;
  }

  // Check if error is transient
  if (!isTransientError(delivery.errorMessage)) {
    console.warn("[delivery:retry] Error is permanent, not retrying:", deliveryId, delivery.errorMessage);
    return false;
  }

  // Count previous attempts
  const attempts = 1;
  if (attempts > maxAttempts) {
    console.warn("[delivery:retry] Max attempts exceeded:", deliveryId, attempts);
    return false;
  }

  // Calculate backoff delay
  const delayMs = Math.pow(2, attempts - 1) * 1000;
  await new Promise(resolve => setTimeout(resolve, delayMs));

  // Retry based on channel
  try {
    if (delivery.channel === "EMAIL") {
      const user = await prisma.user.findUnique({
        where: { id: delivery.userId },
        select: { id: true, email: true, role: true },
      });

      if (!user?.email) {
        await prisma.notificationDelivery.update({
          where: { id: deliveryId },
          data: { status: "SKIPPED", errorMessage: "NO_EMAIL" },
        });
        return false;
      }

      const templated = await renderNotificationTemplate(
        delivery.notification.type,
        "EMAIL",
        buildLegacyTemplatePayload(delivery.notification),
      );

      const template = buildNotificationEmailTemplate(
        delivery.notification.type as NotificationType,
        templated?.subject ?? delivery.notification.title,
        templated ? toPlainText(templated.body, 4000) : delivery.notification.body,
        delivery.notification.entityId,
        delivery.notification.ctaAction,
        templated?.body ?? null,
      );

      const result = await sendEmail({ to: user.email, ...template });

      if (result.ok) {
        await prisma.notificationDelivery.update({
          where: { id: deliveryId },
          data: { status: "SENT", sentAt: new Date(), errorMessage: null },
        });
        return true;
      } else {
        await prisma.notificationDelivery.update({
          where: { id: deliveryId },
          data: { status: "FAILED", errorMessage: result.error ?? "Unknown error" },
        });
        return false;
      }
    } else if (delivery.channel === "TELEGRAM") {
      const connection = await getActiveTelegramConnectionForCurrentEnvironment(delivery.userId);
      if (!connection?.isActive) {
        await prisma.notificationDelivery.update({
          where: { id: deliveryId },
          data: { status: "SKIPPED", errorMessage: "TELEGRAM_NOT_CONNECTED" },
        });
        return false;
      }

      const rendered = await buildTelegramMessageForNotification(delivery.notification);
      const channel = new TelegramChannel();
      await channel.sendMessage({
        chatId: connection.telegramChatId,
        text: rendered.text,
        replyMarkup: rendered.replyMarkup,
        parseMode: rendered.parseMode,
      });

      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: "SENT", sentAt: new Date(), errorMessage: null },
      });
      return true;
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: "FAILED", errorMessage: errorMsg },
    });
    Sentry.captureException(e, {
      tags: {
        area: "notifications",
        channel: delivery.channel.toLowerCase(),
        stage: "retry",
      },
      extra: {
        deliveryId,
        notificationId: delivery.notificationId,
        notificationType: delivery.notification.type,
        userId: delivery.userId,
        attempts,
      },
    });
    return false;
  }

  return false;
}

export async function resendNotificationDelivery(
  deliveryId: string,
): Promise<boolean> {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: { notification: true },
  });

  if (!delivery?.notification) {
    return false;
  }

  try {
    if (delivery.channel === "EMAIL") {
      const user = await prisma.user.findUnique({
        where: { id: delivery.userId },
        select: { email: true },
      });

      if (!user?.email) {
        await prisma.notificationDelivery.update({
          where: { id: deliveryId },
          data: { status: "SKIPPED", errorMessage: "EMAIL_MISSING" },
        });
        return false;
      }

      const template = buildNotificationEmailTemplate(
        delivery.notification.type as NotificationType,
        delivery.notification.title,
        delivery.notification.body,
        delivery.notification.entityId,
        delivery.notification.ctaAction,
      );

      const result = await sendEmail({ to: user.email, ...template });
      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: result.ok
          ? { status: "SENT", sentAt: new Date(), errorMessage: null }
          : { status: "FAILED", errorMessage: result.error ?? "EMAIL_SEND_FAILED" },
      });
      return result.ok;
    }

    if (delivery.channel === "TELEGRAM") {
      await handleTelegram(delivery.notificationId!, true);
      const refreshed = await prisma.notificationDelivery.findUnique({
        where: { id: deliveryId },
        select: { status: true },
      });
      return refreshed?.status === "SENT";
    }
  } catch (error) {
    await prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "DELIVERY_RESEND_FAILED",
      },
    });
  }

  return false;
}

// ── Stale PENDING reconciliation ──────────────────────────────────────────────

// Must not contain "timeout" — isTransientError() pattern-matches that
// substring and would route the row into the automatic retry path.
export const STALE_PENDING_ERROR = "STALE_PENDING_RECONCILED";
export const STALE_PENDING_THRESHOLD_MINUTES = 10;

/**
 * Marks deliveries stuck in PENDING as FAILED.
 *
 * A row stays PENDING forever when the process dies between the upsert and the
 * post-send status update (observed with short-lived tsx scripts). Such a row
 * also suppresses future deliveries with the same dedupeKey, so it must be
 * resolved one way or another.
 *
 * We deliberately do NOT auto-resend here: the crash may have happened after a
 * successful sendMessage but before the SENT update, so an automatic retry
 * could double-send. FAILED + STALE_PENDING_RECONCILED surfaces the row in the
 * admin diagnostics where it can be resent manually; the message is listed as
 * permanent in isTransientError(), so the automatic retry path skips it.
 */
export async function reconcileStalePendingDeliveries(
  olderThanMinutes = STALE_PENDING_THRESHOLD_MINUTES,
): Promise<number> {
  const threshold = new Date(Date.now() - olderThanMinutes * 60_000);
  const result = await prisma.notificationDelivery.updateMany({
    where: {
      status: "PENDING",
      channel: { in: ["EMAIL", "TELEGRAM"] },
      createdAt: { lt: threshold },
    },
    data: { status: "FAILED", errorMessage: STALE_PENDING_ERROR },
  });

  if (result.count > 0) {
    console.warn(
      `[delivery:reconcile] Marked ${result.count} stale PENDING deliveries as FAILED (older than ${olderThanMinutes}m)`,
    );
  }

  return result.count;
}

// ── Delivery Diagnostics ──────────────────────────────────────────────────────

export interface DeliveryStats {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface DeliveryStatsByChannel {
  inApp: DeliveryStats;
  email: DeliveryStats;
  telegram: DeliveryStats;
}

/**
 * Get delivery statistics for a user.
 */
export async function getDeliveryStats(userId: string): Promise<DeliveryStatsByChannel> {
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { userId },
    select: { channel: true, status: true },
  });

  const stats: DeliveryStatsByChannel = {
    inApp: { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0 },
    email: { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0 },
    telegram: { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0 },
  };

  for (const delivery of deliveries) {
    const channelKey = delivery.channel === "IN_APP" ? "inApp" : delivery.channel.toLowerCase() as keyof DeliveryStatsByChannel;
    const stat = stats[channelKey];
    
    stat.total++;
    if (delivery.status === "SENT") stat.sent++;
    else if (delivery.status === "FAILED") stat.failed++;
    else if (delivery.status === "SKIPPED") stat.skipped++;
    else if (delivery.status === "PENDING") stat.pending++;
  }

  return stats;
}

/**
 * Get latest failed deliveries for a user.
 */
export async function getLatestFailedDeliveries(
  userId: string,
  limit = 10,
): Promise<Array<NotificationDelivery & { notification: Notification | null }>> {
  return prisma.notificationDelivery.findMany({
    where: { userId, status: "FAILED" },
    include: { notification: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get latest Telegram failures.
 */
export async function getLatestTelegramFailures(
  limit = 10,
): Promise<Array<NotificationDelivery & { notification: Notification | null }>> {
  return prisma.notificationDelivery.findMany({
    where: { channel: "TELEGRAM", status: "FAILED" },
    include: { notification: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get latest email failures.
 */
export async function getLatestEmailFailures(
  limit = 10,
): Promise<Array<NotificationDelivery & { notification: Notification | null }>> {
  return prisma.notificationDelivery.findMany({
    where: { channel: "EMAIL", status: "FAILED" },
    include: { notification: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
