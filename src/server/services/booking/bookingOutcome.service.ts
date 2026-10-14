import "server-only";
import prisma from "@/lib/prisma";
import { BookingKind, BookingStatus } from "@prisma/client";
import { bookingBucket } from "./bookingBucket";
import {
  notifyUserBookingCompleted, notifyUserBookingFeedbackRequest,
} from "@/server/services/notification.service";
import {
  trackBookingCompleted, trackBookingCancelled,
} from "@/server/analytics/trackBookingEvent";

export type BookingOutcome =
  | { outcome: "HELD" }
  | { outcome: "NOT_HELD"; reason: "CLIENT_NO_SHOW" | "CANCELLED_BY_PHONE" };

export class BookingOutcomeError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

/** Завершение прошлого посещения: отмена без REJECTED и без подмены аналитики отказов. */
export async function closePastStandardBooking(input: {
  businessId: string;
  bookingId: string;
  actorId: string;
  actorRole: string;
  outcome: BookingOutcome;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const row = await prisma.bookingRequest.findFirst({
    where: { id: input.bookingId, businessId: input.businessId, kind: BookingKind.STANDARD },
    select: {
      id: true, status: true, createdAt: true, firstResponseAt: true,
      requestedDate: true, endsAt: true, campShiftDateTo: true,
      session: { select: { startsAt: true } },
      offerSession: { select: { startAt: true, endAt: true } },
      userId: true, offer: { select: { id: true, title: true } },
      activity: { select: { title: true } }, place: { select: { title: true } },
    },
  });
  if (!row) throw new BookingOutcomeError(404, "Заявка не найдена");
  if (row.status !== BookingStatus.CONFIRMED) {
    throw new BookingOutcomeError(409, "Эта заявка уже изменена");
  }
  const date = row.endsAt ?? row.offerSession?.endAt ?? row.campShiftDateTo ??
    row.requestedDate ?? row.session?.startsAt ?? row.offerSession?.startAt ?? null;
  const endOfDay = date
    ? new Date(date.toISOString().slice(0, 10) + "T23:59:59.999+03:00")
    : null;
  const serviceEndsAt = row.endsAt ?? row.offerSession?.endAt ?? endOfDay;
  const decision = bookingBucket({
    kind: BookingKind.STANDARD, status: BookingStatus.CONFIRMED,
    createdAt: row.createdAt, firstResponseAt: row.firstResponseAt,
    hasServiceDate: Boolean(date), serviceEndsAt,
  }, now);
  if (decision.action !== "CLOSE_VISIT") {
    throw new BookingOutcomeError(409, "Закрыть можно только прошедшее посещение");
  }

  const nextStatus = input.outcome.outcome === "HELD"
    ? BookingStatus.COMPLETED : BookingStatus.CANCELLED;
  const reason = input.outcome.outcome === "NOT_HELD" ? input.outcome.reason : null;

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.bookingRequest.updateMany({
      where: { id: row.id, businessId: input.businessId,
        kind: BookingKind.STANDARD, status: BookingStatus.CONFIRMED },
      data: { status: nextStatus, lastActivityAt: now,
        ...(nextStatus === BookingStatus.COMPLETED ? { completedAt: now } : {}) },
    });
    if (claimed.count !== 1) throw new BookingOutcomeError(409, "Эта заявка уже изменена");
    await tx.bookingActivity.create({
      data: {
        bookingId: row.id, type: "STATUS_CHANGED", actorType: "BUSINESS",
        actorId: input.actorId,
        payload: { from: BookingStatus.CONFIRMED, to: nextStatus,
          visitOutcome: input.outcome.outcome, reason },
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: input.actorId, actorRole: input.actorRole,
        action: "BOOKING_VISIT_CLOSED", entityType: "BOOKING_REQUEST", entityId: row.id,
        before: { status: BookingStatus.CONFIRMED },
        after: { status: nextStatus, visitOutcome: input.outcome.outcome, reason },
        reason,
        metadata: { businessId: input.businessId, source: "business_visit_outcome" },
      },
    });
    return { id: row.id, status: nextStatus, outcome: input.outcome.outcome, reason };
  });

  const title = row.offer?.title ?? row.activity?.title ?? row.place?.title ?? null;
  if (nextStatus === BookingStatus.COMPLETED) {
    void trackBookingCompleted({
      userId: row.userId, bookingId: row.id, entityType: "OFFER",
      entityId: row.offer?.id ?? "", vertical: "CITY",
      metadata: { status: nextStatus, source: "business_visit_outcome", surface: "web" },
    }).catch((error) => console.error("[bookingOutcome/analytics]", error));
    if (row.userId) {
      const notification = { userId: row.userId, bookingId: row.id, publicationTitle: title };
      void notifyUserBookingCompleted(notification).catch((error) => console.error("[bookingOutcome/notify]", error));
      void notifyUserBookingFeedbackRequest(notification).catch((error) => console.error("[bookingOutcome/feedback]", error));
    }
  } else {
    // No-show is a cancellation AFTER the visit date; do not send a late cancellation
    // notification pretending the upcoming booking had been cancelled in advance.
    void trackBookingCancelled({
      userId: row.userId, bookingId: row.id, entityType: "OFFER",
      entityId: row.offer?.id ?? "", vertical: "CITY",
      metadata: { status: nextStatus, reason, source: "business_visit_outcome", surface: "web" },
    }).catch((error) => console.error("[bookingOutcome/analytics]", error));
  }
  return result;
}
