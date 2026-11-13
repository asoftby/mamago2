/**
 * Direct ↔ BookingRequest link.
 *
 * The one exception to "business never writes first": a business member may
 * open the thread for a concrete booking request of their own publication
 * (reply to the customer's request). Everything else in the module is
 * unchanged — customer↛customer, business↛business, no business-first thread
 * without a booking request, guests (BookingRequest.userId = null) have no chat.
 *
 * Exactly one thread per booking request (DirectThread.bookingRequestId is
 * UNIQUE): repeated / concurrent opens return the existing thread.
 */

import prisma from "@/lib/prisma";
import {
  BookingStatus,
  DirectActorType,
  DirectThreadStatus,
  Prisma,
  PublicationType,
} from "@prisma/client";
import { canAccessBusiness } from "@/server/permissions/business-permissions";
import {
  DIRECT_AUDIT_ENTITY,
  DirectAuditAction,
  writeDirectAudit,
} from "./directAudit";
import { createDirectMessage } from "./directMessage.service";
import {
  evaluateDirectTypePolicy,
  getDirectAvailabilityForPublicationType,
  getDirectPlatformSettings,
} from "./directPlatformSettings.service";
import type { ParentBookingsResult } from "@/server/services/booking/parentBookings.service";
import { detectAndRecordContactEscapeSignals } from "./directRiskSignal.service";
import { resolvePublication } from "./directThread.service";

export type BookingDirectErrorCode =
  | "BOOKING_NOT_FOUND"
  | "FORBIDDEN"
  | "GUEST_BOOKING"
  | "POLICY_DISABLED"
  | "PUBLICATION_MISMATCH"
  | "EMPTY_MESSAGE"
  | "NOT_BOOKING_OWNER";

export class BookingDirectError extends Error {
  constructor(
    public readonly code: BookingDirectErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingDirectError";
  }

  get httpStatus(): number {
    switch (this.code) {
      case "BOOKING_NOT_FOUND":
        return 404;
      case "FORBIDDEN":
      case "NOT_BOOKING_OWNER":
        return 403;
      case "EMPTY_MESSAGE":
        return 400;
      default:
        return 409;
    }
  }
}

const bookingSelect = {
  id: true,
  businessId: true,
  userId: true,
  status: true,
  kind: true,
  publicationType: true,
  offerId: true,
  activityId: true,
  placeId: true,
} satisfies Prisma.BookingRequestSelect;

type BookingForDirect = Prisma.BookingRequestGetPayload<{ select: typeof bookingSelect }>;

async function loadBooking(bookingRequestId: string): Promise<BookingForDirect> {
  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: bookingSelect,
  });
  if (!booking) throw new BookingDirectError("BOOKING_NOT_FOUND", "Booking request not found");
  return booking;
}

async function assertPolicyAllows(publicationType: PublicationType) {
  const availability = await getDirectAvailabilityForPublicationType(publicationType);
  if (!availability.available) {
    throw new BookingDirectError(
      "POLICY_DISABLED",
      "Сообщения по этому типу публикации сейчас отключены",
    );
  }
}

/** Resolve publication → business and require it to match the booking's own business. */
async function resolveBookingPublication(booking: BookingForDirect) {
  const resolved = await resolvePublication({
    publicationType: booking.publicationType,
    offerId: booking.offerId,
    activityId: booking.activityId,
    placeId: booking.placeId,
  }).catch(() => null);
  if (!resolved || resolved.business.id !== booking.businessId) {
    throw new BookingDirectError(
      "PUBLICATION_MISMATCH",
      "Публикация заявки недоступна для чата",
    );
  }
  return resolved;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export interface OpenBookingThreadResult {
  threadId: string;
  threadNumber: number;
  /** false → the thread already existed; nothing was written. */
  created: boolean;
  /** Only set when created: the first (BUSINESS) message. */
  firstMessageId: string | null;
  customerUserId: string;
}

/**
 * Business → customer: opens the thread for a booking request with the first
 * message from BUSINESS. `actorUserId` must be an active OWNER/MANAGER of the
 * booking's business (no admin override: an admin must not impersonate a
 * business toward a customer).
 */
export async function openBusinessDirectThreadForBooking(input: {
  bookingRequestId: string;
  actorUserId: string;
  message: string;
}): Promise<OpenBookingThreadResult> {
  const booking = await loadBooking(input.bookingRequestId);

  // 404-like for foreign bookings would leak existence; membership is checked first.
  if (!(await canAccessBusiness(input.actorUserId, booking.businessId))) {
    throw new BookingDirectError("FORBIDDEN", "Forbidden");
  }
  if (!booking.userId) {
    throw new BookingDirectError("GUEST_BOOKING", "У гостевой заявки нет чата");
  }
  if (booking.kind !== "STANDARD") {
    throw new BookingDirectError("PUBLICATION_MISMATCH", "Чат доступен только для обычных заявок");
  }
  if (booking.status === BookingStatus.CANCELLED) {
    throw new BookingDirectError("PUBLICATION_MISMATCH", "Заявка отменена");
  }

  const existing = await prisma.directThread.findUnique({
    where: { bookingRequestId: booking.id },
    select: { id: true, threadNumber: true, customerUserId: true },
  });
  if (existing) {
    return {
      threadId: existing.id,
      threadNumber: existing.threadNumber,
      created: false,
      firstMessageId: null,
      customerUserId: existing.customerUserId,
    };
  }

  await assertPolicyAllows(booking.publicationType);
  const resolved = await resolveBookingPublication(booking);

  if (resolved.owner.userId === booking.userId) {
    throw new BookingDirectError("FORBIDDEN", "Нельзя открыть чат с самим собой");
  }

  const body = input.message.trim();
  if (!body) throw new BookingDirectError("EMPTY_MESSAGE", "Введите сообщение");

  const now = new Date();
  let thread;
  try {
    thread = await prisma.directThread.create({
      data: {
        publicationType: booking.publicationType,
        offerId: booking.offerId,
        activityId: booking.activityId,
        placeId: booking.placeId,
        businessId: booking.businessId,
        customerUserId: booking.userId,
        bookingRequestId: booking.id,
        status: DirectThreadStatus.OPEN,
        lastMessageAt: now,
        lastMessageBy: DirectActorType.BUSINESS,
        messages: {
          create: {
            senderType: DirectActorType.BUSINESS,
            senderUserId: input.actorUserId,
            body,
            createdAt: now,
          },
        },
      },
      include: { messages: { select: { id: true } } },
    });
  } catch (error) {
    // Concurrent open of the same booking: the UNIQUE index decides the winner.
    if (isUniqueViolation(error)) {
      const winner = await prisma.directThread.findUnique({
        where: { bookingRequestId: booking.id },
        select: { id: true, threadNumber: true, customerUserId: true },
      });
      if (winner) {
        return {
          threadId: winner.id,
          threadNumber: winner.threadNumber,
          created: false,
          firstMessageId: null,
          customerUserId: winner.customerUserId,
        };
      }
    }
    throw error;
  }

  const firstMessageId = thread.messages[0]?.id ?? null;

  await writeDirectAudit({
    action: DirectAuditAction.THREAD_CREATED,
    entityType: DIRECT_AUDIT_ENTITY.THREAD,
    entityId: thread.id,
    actorId: input.actorUserId,
    actorRole: "BUSINESS",
    after: {
      threadNumber: thread.threadNumber,
      businessId: booking.businessId,
      publicationType: booking.publicationType,
      offerId: booking.offerId,
      activityId: booking.activityId,
      placeId: booking.placeId,
      bookingRequestId: booking.id,
      initiatedBy: "BUSINESS",
    },
  });

  // Same contact-escape detection the regular send path runs; signal-only.
  if (firstMessageId) {
    await detectAndRecordContactEscapeSignals({
      messageId: firstMessageId,
      threadId: thread.id,
      businessId: booking.businessId,
      customerUserId: booking.userId,
      body,
    });
  }

  return {
    threadId: thread.id,
    threadNumber: thread.threadNumber,
    created: true,
    firstMessageId,
    customerUserId: booking.userId,
  };
}

export interface CustomerBookingThreadResult extends OpenBookingThreadResult {
  /** Present when the thread existed and the text was appended as a CUSTOMER message. */
  appendedMessageId: string | null;
}

/**
 * Customer → organizer, from "Мои записи" (e.g. after the organizer didn't
 * respond and the request EXPIRED). The booking must belong to the customer.
 * If a thread for this booking already exists (opened by the business, or a
 * double submit) the text is appended there instead of creating a duplicate.
 */
export async function openCustomerDirectThreadForBooking(input: {
  bookingRequestId: string;
  customerUserId: string;
  message: string;
}): Promise<CustomerBookingThreadResult> {
  const booking = await loadBooking(input.bookingRequestId);
  if (booking.userId !== input.customerUserId) {
    throw new BookingDirectError("NOT_BOOKING_OWNER", "Forbidden");
  }
  const body = input.message.trim();
  if (!body) throw new BookingDirectError("EMPTY_MESSAGE", "Введите сообщение");

  const append = async (existing: { id: string; threadNumber: number; customerUserId: string }) => {
    const msg = await createDirectMessage({
      threadId: existing.id,
      senderType: DirectActorType.CUSTOMER,
      senderUserId: input.customerUserId,
      body,
    });
    return {
      threadId: existing.id,
      threadNumber: existing.threadNumber,
      created: false,
      firstMessageId: null,
      customerUserId: existing.customerUserId,
      appendedMessageId: msg.id,
    };
  };

  const existing = await prisma.directThread.findUnique({
    where: { bookingRequestId: booking.id },
    select: { id: true, threadNumber: true, customerUserId: true },
  });
  if (existing) return append(existing);

  await assertPolicyAllows(booking.publicationType);
  const resolved = await resolveBookingPublication(booking);
  if (resolved.owner.userId === input.customerUserId) {
    throw new BookingDirectError("FORBIDDEN", "Нельзя открыть чат с самим собой");
  }

  const now = new Date();
  try {
    const thread = await prisma.directThread.create({
      data: {
        publicationType: booking.publicationType,
        offerId: booking.offerId,
        activityId: booking.activityId,
        placeId: booking.placeId,
        businessId: booking.businessId,
        customerUserId: input.customerUserId,
        bookingRequestId: booking.id,
        status: DirectThreadStatus.OPEN,
        lastMessageAt: now,
        lastMessageBy: DirectActorType.CUSTOMER,
        messages: {
          create: {
            senderType: DirectActorType.CUSTOMER,
            senderUserId: input.customerUserId,
            body,
            createdAt: now,
          },
        },
      },
      include: { messages: { select: { id: true } } },
    });
    await writeDirectAudit({
      action: DirectAuditAction.THREAD_CREATED,
      entityType: DIRECT_AUDIT_ENTITY.THREAD,
      entityId: thread.id,
      actorId: input.customerUserId,
      actorRole: "USER",
      after: {
        threadNumber: thread.threadNumber,
        businessId: booking.businessId,
        publicationType: booking.publicationType,
        bookingRequestId: booking.id,
        initiatedBy: "CUSTOMER",
      },
    });
    return {
      threadId: thread.id,
      threadNumber: thread.threadNumber,
      created: true,
      firstMessageId: thread.messages[0]?.id ?? null,
      customerUserId: input.customerUserId,
      appendedMessageId: null,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const winner = await prisma.directThread.findUnique({
        where: { bookingRequestId: booking.id },
        select: { id: true, threadNumber: true, customerUserId: true },
      });
      if (winner) return append(winner);
    }
    throw error;
  }
}

// ─── Read side: one query per set of bookings ───────────────────────────────

export interface BookingThreadIndicator {
  threadId: string;
  threadNumber: number;
  status: DirectThreadStatus;
  lastMessageAt: Date;
  lastMessageBy: DirectActorType | null;
}

/**
 * bookingRequestId → thread link for a set of bookings, scoped to the viewer
 * (customer: their own threads; business: their business's threads) so a
 * foreign thread can never be indicated even for a wrong id. One query,
 * message bodies are never selected.
 */
export async function getBookingThreadIndicators(
  bookingRequestIds: string[],
  scope: { customerUserId: string } | { businessId: string },
): Promise<Map<string, BookingThreadIndicator>> {
  const result = new Map<string, BookingThreadIndicator>();
  if (bookingRequestIds.length === 0) return result;
  const rows = await prisma.directThread.findMany({
    where: { bookingRequestId: { in: bookingRequestIds }, ...scope },
    select: {
      id: true,
      threadNumber: true,
      status: true,
      lastMessageAt: true,
      lastMessageBy: true,
      bookingRequestId: true,
    },
  });
  for (const r of rows) {
    if (!r.bookingRequestId) continue;
    result.set(r.bookingRequestId, {
      threadId: r.id,
      threadNumber: r.threadNumber,
      status: r.status,
      lastMessageAt: r.lastMessageAt,
      lastMessageBy: r.lastMessageBy,
    });
  }
  return result;
}

/** For UI gating: can this publication type be used for Direct right now? */
export async function isDirectAvailableForBooking(publicationType: PublicationType): Promise<boolean> {
  return (await getDirectAvailabilityForPublicationType(publicationType)).available;
}

/**
 * Fills directThreadId / directAvailable on the "Мои записи" result:
 * ONE thread query (scoped to the customer) + ONE settings read for the
 * whole list — no per-booking queries. Kept out of parentBookings.service so
 * that module stays free of server-only imports.
 */
export async function attachDirectLinksToParentBookings(
  result: ParentBookingsResult,
  customerUserId: string,
): Promise<ParentBookingsResult> {
  const items = [...result.active, ...result.completed, ...result.cancelled];
  if (items.length === 0) return result;
  const [threads, settings] = await Promise.all([
    getBookingThreadIndicators(items.map((b) => b.id), { customerUserId }),
    getDirectPlatformSettings(),
  ]);
  for (const item of items) {
    item.directThreadId = threads.get(item.id)?.threadId ?? null;
    item.directAvailable = item.directPublicationType
      ? evaluateDirectTypePolicy(settings.publicationTypePolicy[item.directPublicationType]).available
      : false;
  }
  return result;
}

/** Fills directAvailable on business booking items: one settings read per call. */
export async function attachDirectAvailabilityToBusinessBookings<
  T extends { publicationType: string; directAvailable: boolean | null },
>(items: T[]): Promise<T[]> {
  if (items.length === 0) return items;
  const settings = await getDirectPlatformSettings();
  for (const item of items) {
    const type = item.publicationType as "OFFER" | "EVENT" | "PLACE";
    const policy = settings.publicationTypePolicy[type];
    item.directAvailable = policy ? evaluateDirectTypePolicy(policy).available : false;
  }
  return items;
}
