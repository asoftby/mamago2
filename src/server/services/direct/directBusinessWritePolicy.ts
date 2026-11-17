/**
 * Server-side marketplace rule: a Business may answer a current booking or a
 * customer-initiated enquiry, but cannot use an old Direct thread to solicit
 * former customers. This is intentionally independent of UI controls.
 *
 * Customer and explicitly authorized staff messages have different policies.
 */
import { BookingKind, BookingStatus, DirectThreadStatus, PartyRequestStage } from "@prisma/client";

/** Mirrors the planned 30-day inactive Direct archive horizon until its cron exists. */
export const BUSINESS_ENQUIRY_REPLY_DAYS = 30;
const ENQUIRY_WINDOW_MS = BUSINESS_ENQUIRY_REPLY_DAYS * 24 * 60 * 60 * 1000;

export type DirectBookingWriteContext = {
  status: BookingStatus;
  kind: BookingKind;
  partyStage: PartyRequestStage | null;
  businessId: string;
  userId: string | null;
  /** A known service end blocks further commercial messages even before status cleanup. */
  endsAt: Date | null;
};

export type BusinessDirectWriteContext = {
  threadStatus: DirectThreadStatus;
  threadBusinessId: string;
  threadCustomerUserId: string;
  bookingRequestId: string | null;
  booking: DirectBookingWriteContext | null;
  latestCustomerMessageAt: Date | null;
  now: Date;
};

/**
 * Fail closed if a linked booking was deleted or points at another customer/
 * business. A NEW or CONFIRMED booking is actionable; terminal states are not.
 */
export function canBusinessContactForBooking(
  booking: Pick<DirectBookingWriteContext, "status" | "kind" | "partyStage" | "endsAt">,
  now: Date,
): boolean {
  if (booking.status !== BookingStatus.NEW && booking.status !== BookingStatus.CONFIRMED) {
    return false;
  }
  if (booking.kind === BookingKind.PARTY && ![
    PartyRequestStage.SENT,
    PartyRequestStage.QUOTED,
    PartyRequestStage.AWAITING_RECONFIRM,
    PartyRequestStage.CONFIRMED,
  ].some((stage) => stage === booking.partyStage)) return false;
  if (booking.endsAt && booking.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

export function canBusinessWriteDirect(context: BusinessDirectWriteContext): boolean {
  if (context.threadStatus !== DirectThreadStatus.OPEN) return false;

  if (context.bookingRequestId) {
    const booking = context.booking;
    return Boolean(
      booking &&
        booking.userId === context.threadCustomerUserId &&
        booking.businessId === context.threadBusinessId &&
        canBusinessContactForBooking(booking, context.now),
    );
  }

  // Unlinked Direct conversations are enquiries initiated by the customer.
  // A business cannot revive one after the response window without a new
  // inbound customer message or a new booking through mamaGo.
  const latestCustomerAt = context.latestCustomerMessageAt?.getTime();
  if (latestCustomerAt == null || !Number.isFinite(latestCustomerAt)) return false;
  const elapsed = context.now.getTime() - latestCustomerAt;
  return elapsed >= 0 && elapsed < ENQUIRY_WINDOW_MS;
}
