/**
 * Notification Deduplication Service
 *
 * Ensures notifications are not duplicated within specified time windows.
 * Deduplication is applied at notification creation time.
 *
 * ─── Deduplication Rules ──────────────────────────────────────────────────────
 *
 * BOOKING_CREATED:
 *   - One per booking (unique constraint: entityType=BOOKING, entityId=bookingId)
 *   - Triggered when booking is created
 *   - No time window (one-time event)
 *
 * BOOKING_STALE:
 *   - Max 1 per 24h per booking
 *   - Triggered by scheduled job or lazy check
 *   - Dedup window: 24 hours
 *
 * BOOKING_NEEDS_ATTENTION:
 *   - Max 1 per 24h per booking
 *   - Triggered by scheduled job or lazy check
 *   - Dedup window: 24 hours
 *
 * BOOKING_CONFIRMED:
 *   - One per status change (NEW → CONFIRMED)
 *   - Triggered when business confirms booking
 *   - No time window (one-time event)
 *
 * BOOKING_CANCELLED:
 *   - One per status change (NEW|CONFIRMED → REJECTED)
 *   - Triggered when business rejects booking
 *   - No time window (one-time event)
 *
 * BOOKING_COMPLETED:
 *   - One per status change (CONFIRMED → COMPLETED)
 *   - Triggered when booking is completed
 *   - No time window (one-time event)
 *
 * BOOKING_FEEDBACK_REQUEST:
 *   - One per booking completion
 *   - Triggered after BOOKING_COMPLETED
 *   - No time window (one-time event)
 *
 * ─── Implementation ───────────────────────────────────────────────────────────
 *
 * Deduplication is checked before calling createNotification().
 * If a duplicate is detected, the function returns null without creating a notification.
 */

import prisma from "@/lib/prisma";
import { NotificationType, type NotificationEntityType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DedupCheckResult {
  isDuplicate: boolean;
  reason?: string;
  lastNotificationId?: string;
}

// ─── Deduplication windows (in hours) ──────────────────────────────────────────

/**
 * Deduplication strategy:
 * - null = one-time event, check for exact duplicate (same userId + type + entityId)
 * - number = time window in hours for reminder notifications
 */
const DEDUP_WINDOWS: Record<NotificationType, number | null> = {
  SYSTEM_INFO: null,
  FEATURE_UPDATE: null,
  BUSINESS_NEWS: null,
  MODERATION_RESULT: null,
  BUSINESS_ACTION_REQUIRED: null,
  BOOKING_REQUEST: null,
  LEAD_CREATED: null,
  PLAN_REMINDER: null,
  UPCOMING_EVENT: null,
  COMMENT_REPLY: null,
  SECURITY_ALERT: null,
  PAYMENT_INFO: null,
  CONTENT_PUBLISHED: null,
  CONTENT_REJECTED: null,
  // One-time booking events (exact dedup)
  BOOKING_CREATED: null,
  BOOKING_CONFIRMED: null,
  BOOKING_CANCELLED: null,
  BOOKING_COMPLETED: null,
  BOOKING_FEEDBACK_REQUEST: null,

  // Reminder notifications (24h window)
  BOOKING_STALE: 24,
  BOOKING_NEEDS_ATTENTION: 24,

  // Moderation approvals/rejections (one-time per entity)
  // These should never duplicate for the same entity
  PLACE_APPROVED: null,
  PLACE_NEEDS_CHANGES: null,
  PLACE_REJECTED: null,
  ACTIVITY_APPROVED: null,
  ACTIVITY_NEEDS_CHANGES: null,
  ACTIVITY_REJECTED: null,
  PLACE_UPDATE_APPROVED: null,
  PLACE_UPDATE_NEEDS_REVISION: null,
  PLACE_UPDATE_REJECTED: null,
  OFFER_APPROVED: null,
  OFFER_NEEDS_CHANGES: null,
  OFFER_REJECTED: null,
  BUSINESS_VERIFIED: null,
  BUSINESS_REJECTED: null,
  BUSINESS_NEEDS_INFO: null,
  // Повторная подача после NEEDS_INFO/REJECTED — легитимное событие: эти типы
  // не one-time (null), иначе delivery-дедуп подавлял бы Telegram/email при
  // ресабмите навсегда. Окно тут только против даблклика по submit; короткий
  // 5-минутный гард для in-app живёт в notification.service.
  BUSINESS_VERIFICATION_SUBMITTED: 1,
  BUSINESS_APPLICATION_CREATED: 1,
  ADMIN_MODERATION_ITEM_CREATED: null,

  // System notifications (no dedup needed)
  WELCOME: null,
  SYSTEM: null,
  REMINDER: null,
  PLAN_TOMORROW_DIGEST: null,
  RECOMMENDATION: null,
  NEWS: null,
  ANNOUNCEMENT: null,
};

export function isOneTimeNotificationType(type: NotificationType): boolean {
  return DEDUP_WINDOWS[type] === null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

// ─── Main dedup check ─────────────────────────────────────────────────────────

/**
 * Check if a notification should be deduplicated.
 *
 * For types with time window (number): check if duplicate exists within window.
 * For one-time events (null): check if any notification with same userId+type+entityId exists.
 *
 * Returns true if a duplicate was found.
 */
export async function checkNotificationDedup(
  userId: string,
  type: NotificationType,
  entityType?: NotificationEntityType | null,
  entityId?: string | null,
): Promise<DedupCheckResult> {
  const dedupWindow = DEDUP_WINDOWS[type];

  // Must have entityId for dedup check
  if (!entityId || !entityType) {
    return { isDuplicate: false };
  }

  // For types with time window, check within that window
  if (dedupWindow !== null) {
    const since = hoursAgo(dedupWindow);

    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type,
        entityType,
        entityId,
        createdAt: { gte: since },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    if (!existing) {
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      reason: `Duplicate within ${dedupWindow}h window`,
      lastNotificationId: existing.id,
    };
  }

  // For one-time events (null window), check for any existing notification
  // This prevents duplicate PLACE_APPROVED, ACTIVITY_REJECTED, etc.
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      entityType,
      entityId,
    },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (!existing) {
    return { isDuplicate: false };
  }

  return {
    isDuplicate: true,
    reason: `One-time notification already sent for this entity`,
    lastNotificationId: existing.id,
  };
}

// ─── Audit functions ──────────────────────────────────────────────────────────

export interface DedupAuditResult {
  type: NotificationType;
  totalCount: number;
  duplicateCount: number;
  duplicatePercentage: number;
}

/**
 * Audit deduplication for a specific notification type.
 * Finds potential duplicates that should have been deduplicated.
 */
export async function auditNotificationDedup(
  type: NotificationType,
): Promise<DedupAuditResult> {
  const dedupWindow = DEDUP_WINDOWS[type];

  if (dedupWindow === null) {
    return {
      type,
      totalCount: 0,
      duplicateCount: 0,
      duplicatePercentage: 0,
    };
  }

  // Find all notifications of this type with entityId
  const notifications = await prisma.notification.findMany({
    where: { type, entityId: { not: null } },
    select: { id: true, userId: true, entityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  let duplicateCount = 0;
  const seen = new Set<string>();

  for (const notif of notifications) {
    const key = `${notif.userId}:${notif.entityId}`;

    if (seen.has(key)) {
      // Check if it's within the dedup window
      const lastNotif = notifications.find(n => `${n.userId}:${n.entityId}` === key && n.id !== notif.id);
      if (lastNotif && notif.createdAt.getTime() - lastNotif.createdAt.getTime() < dedupWindow * 3_600_000) {
        duplicateCount++;
      }
    } else {
      seen.add(key);
    }
  }

  return {
    type,
    totalCount: notifications.length,
    duplicateCount,
    duplicatePercentage: notifications.length > 0 ? (duplicateCount / notifications.length) * 100 : 0,
  };
}

/**
 * Audit all notification types for deduplication issues.
 */
export async function auditAllNotificationDedup(): Promise<DedupAuditResult[]> {
  const types = Object.keys(DEDUP_WINDOWS) as NotificationType[];
  const results: DedupAuditResult[] = [];

  for (const type of types) {
    const result = await auditNotificationDedup(type);
    if (result.totalCount > 0) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Get deduplication statistics for a user.
 */
export async function getUserDedupStats(userId: string): Promise<{
  totalNotifications: number;
  bookingNotifications: number;
  reminderNotifications: number;
}> {
  const [total, booking, reminder] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({
      where: {
        userId,
        type: { in: ["BOOKING_CREATED", "BOOKING_CONFIRMED", "BOOKING_CANCELLED", "BOOKING_COMPLETED", "BOOKING_FEEDBACK_REQUEST"] },
      },
    }),
    prisma.notification.count({
      where: {
        userId,
        type: { in: ["BOOKING_STALE", "BOOKING_NEEDS_ATTENTION"] },
      },
    }),
  ]);

  return {
    totalNotifications: total,
    bookingNotifications: booking,
    reminderNotifications: reminder,
  };
}
