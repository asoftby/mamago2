import "server-only";

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { mapParentBookingRow, PARENT_BOOKING_SELECT } from "./parentBookings.service";
import { notifyUserBookingExpired } from "@/server/services/notification.service";

/**
 * Expire unanswered STANDARD requests by server time (cron, never a browser
 * timer). `updateMany` is conditioned on status NEW and the deadline, so a
 * repeat run or a race with a business confirmation cannot overwrite a result.
 * Capacity counts only NEW/CONFIRMED, so seats free up with the status change;
 * resource holds are released in the same transaction.
 */
const NOTIFY_RETRY_WINDOW_MS = 7 * 86_400_000;

export interface ExpireStandardOptions {
  /** Injectable for failure tests; defaults to the real client notification. */
  notify?: typeof notifyUserBookingExpired;
}

export async function expireStandardRequests(
  limit = 50, now = new Date(), options: ExpireStandardOptions = {},
) {
  const due = await prisma.bookingRequest.findMany({
    where: {
      kind: "STANDARD", status: BookingStatus.NEW, source: null,
      responseDueAt: { lte: now },
    },
    orderBy: { responseDueAt: "asc" },
    take: Math.min(100, Math.max(1, limit)),
    select: { id: true },
  });
  let expired = 0;
  for (const request of due) {
    const didExpire = await prisma.$transaction(async (tx) => {
      const changed = await tx.bookingRequest.updateMany({
        where: {
          id: request.id, kind: "STANDARD", status: BookingStatus.NEW,
          responseDueAt: { lte: now },
        },
        data: { status: BookingStatus.EXPIRED, lastActivityAt: now },
      });
      if (changed.count !== 1) return false;
      await tx.bookingAllocation.updateMany({
        where: { bookingRequestId: request.id, status: "HELD" },
        data: { status: "RELEASED" },
      });
      await tx.bookingActivity.create({
        data: {
          bookingId: request.id, type: "REQUEST_EXPIRED", actorType: "SYSTEM",
          payload: { reason: "RESPONSE_DEADLINE" },
        },
      });
      return true;
    });
    if (didExpire) expired++;
  }
  // Notification intent is durable: the REQUEST_EXPIRED/RESPONSE_DEADLINE activity
  // is written in the same transaction as the status change. Delivery is retried
  // independently on every run until a notification exists (7-day window), so a
  // failed send never loses the message and a repeat run never duplicates it.
  const notified = await deliverExpiryNotifications(limit, now, options.notify ?? notifyUserBookingExpired);
  return { expired, notified };
}

async function deliverExpiryNotifications(
  limit: number, now: Date, notify: typeof notifyUserBookingExpired,
) {
  const activities = await prisma.bookingActivity.findMany({
    where: {
      type: "REQUEST_EXPIRED",
      payload: { path: ["reason"], equals: "RESPONSE_DEADLINE" },
      createdAt: { gte: new Date(now.getTime() - NOTIFY_RETRY_WINDOW_MS) },
      booking: { kind: "STANDARD", status: BookingStatus.EXPIRED, userId: { not: null } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { bookingId: true },
  });
  const ids = [...new Set(activities.map((activity) => activity.bookingId))];
  if (!ids.length) return 0;
  const already = new Set((await prisma.notification.findMany({
    where: { entityType: "BOOKING", entityId: { in: ids }, type: "BOOKING_CANCELLED", audience: "USER" },
    select: { entityId: true },
  })).map((row) => row.entityId));
  const pendingIds = ids.filter((id) => !already.has(id)).slice(0, Math.min(100, Math.max(1, limit)));
  if (!pendingIds.length) return 0;
  const rows = await prisma.bookingRequest.findMany({
    where: { id: { in: pendingIds } },
    select: { ...PARENT_BOOKING_SELECT, userId: true },
  });
  // Public contacts come from the same mapper as "My bookings" (EXPIRED never
  // uses the private business phone); one query for the whole batch.
  let notified = 0;
  for (const row of rows) {
    const item = mapParentBookingRow(row);
    const userId = row.userId;
    if (!userId) continue;
    try {
      const created = await notify({
        userId, bookingId: row.id, publicationTitle: item.display.title ?? null,
        organizerPhone: item.organizerPhone, organizerMessageUrl: item.organizerMessageUrl,
      });
      if (created) notified++;
    } catch (error) {
      // Retried on the next run; the status change and intent are already committed.
      console.error("[standard-expiry] notification failed", row.id, error);
    }
  }
  return notified;
}
