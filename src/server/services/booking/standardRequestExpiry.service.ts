import "server-only";

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { notifyUserBookingExpired } from "@/server/services/notification.service";

/**
 * Expire unanswered STANDARD requests by server time (cron, never a browser
 * timer). `updateMany` is conditioned on status NEW and the deadline, so a
 * repeat run or a race with a business confirmation cannot overwrite a result.
 * Capacity counts only NEW/CONFIRMED, so seats free up with the status change;
 * resource holds are released in the same transaction.
 */
export async function expireStandardRequests(limit = 50, now = new Date()) {
  const due = await prisma.bookingRequest.findMany({
    where: {
      kind: "STANDARD", status: BookingStatus.NEW, source: null,
      responseDueAt: { lte: now },
    },
    orderBy: { responseDueAt: "asc" },
    take: Math.min(100, Math.max(1, limit)),
    select: {
      id: true, userId: true,
      offer: { select: { title: true } },
      activity: { select: { title: true } },
      place: { select: { title: true } },
    },
  });
  const expiredRows: typeof due = [];
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
    if (didExpire) expiredRows.push(request);
  }
  let notified = 0;
  for (const request of expiredRows) {
    if (!request.userId) continue;
    try {
      const created = await notifyUserBookingExpired({
        userId: request.userId, bookingId: request.id,
        publicationTitle: request.offer?.title ?? request.activity?.title ?? request.place?.title ?? null,
      });
      if (created) notified++;
    } catch (error) {
      // The status change is already committed; never fail the cron batch.
      console.error("[standard-expiry] notification failed", request.id, error);
    }
  }
  return { expired: expiredRows.length, notified };
}
